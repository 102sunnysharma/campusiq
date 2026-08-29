"""
Analytics Service — Phase 8 (Section 12)

Implements the daily aggregation job that populates the operational_metrics table
with one row per (department, category, date) combination.

Key computations:
  - total_feedback:         count of feedback rows for the date
  - negative_feedback:      count where FeedbackAnalysis.sentiment = 'negative'
  - total_grievances:       count of grievances created on the date
  - resolved_grievances:    count of grievances with status in ('resolved','closed') on the date
  - sla_breaches:           count of SLAEvents with status = 'breached' triggered on the date
  - avg_resolution_minutes: average minutes from grievance.created_at to grievance.resolved_at
  - student_satisfaction:   avg(rating) / 5 * 100 (0–100 scale)
  - gap_score:              exact Section 12.3 weighted formula (see _compute_gap_score)

Gap Score formula (Section 12.3):
  Gap Score =
    (NegativeSentimentScore × 0.20) +
    (SLABreachRate          × 0.25) +
    (ResolutionDelayScore   × 0.20) +
    (GrievanceVolumeScore   × 0.15) +
    (DissatisfactionScore   × 0.20)
"""

import uuid
import logging
from datetime import date, datetime, timezone, timedelta
from typing import Optional, List, Dict, Any
from decimal import Decimal

from sqlalchemy.orm import Session
from sqlalchemy import func, and_, case, cast, Float

from app.models import (
    Feedback, FeedbackAnalysis, Grievance, SLAEvent, SLAPolicy,
    Category, Department, OperationalMetric,
)

logger = logging.getLogger(__name__)


# ─── Gap Score Helpers ─────────────────────────────────────────────────────────

def get_gap_score_label(gap_score: float) -> str:
    """Returns Low / Moderate / High / Critical band label per Section 12.3."""
    if gap_score <= 30:
        return "Low"
    elif gap_score <= 60:
        return "Moderate"
    elif gap_score <= 80:
        return "High"
    else:
        return "Critical"


def _compute_gap_score(
    negative_feedback: int,
    total_feedback: int,
    sla_breaches: int,
    total_grievances: int,
    avg_resolution_minutes: int,
    sla_target_minutes: float,
    grievance_volume_score: float,   # pre-computed externally (needs all depts)
    student_satisfaction: float,
) -> float:
    """
    Computes the exact Section 12.3 Gap Score.
    All component scores are in the 0–100 range.
    """
    # Component 1: NegativeSentimentScore
    neg_score = (negative_feedback / total_feedback * 100) if total_feedback > 0 else 0.0

    # Component 2: SLABreachRate
    breach_rate = (sla_breaches / total_grievances * 100) if total_grievances > 0 else 0.0

    # Component 3: ResolutionDelayScore
    if sla_target_minutes > 0 and avg_resolution_minutes > 0:
        delay_score = min(100.0, (avg_resolution_minutes / sla_target_minutes) * 100)
    else:
        delay_score = 0.0

    # Component 4: GrievanceVolumeScore (passed in, pre-computed against max across all depts)
    vol_score = min(100.0, grievance_volume_score)

    # Component 5: DissatisfactionScore
    dissatisfaction = 100.0 - min(100.0, max(0.0, student_satisfaction))

    gap = (
        (neg_score    * 0.20) +
        (breach_rate  * 0.25) +
        (delay_score  * 0.20) +
        (vol_score    * 0.15) +
        (dissatisfaction * 0.20)
    )
    return round(gap, 2)


def _get_avg_sla_target_minutes(db: Session, department_id: uuid.UUID, metric_date: date) -> float:
    """
    Computes the average SLA target duration (minutes) for the priority mix
    of grievances for this department on this date.
    """
    policies = db.query(SLAPolicy).filter(SLAPolicy.is_active == True).all()
    if not policies:
        return 1440.0  # default 24h

    # Weight each policy by how many grievances of that priority were filed today
    weighted_sum = 0.0
    total_weight = 0
    for policy in policies:
        count = db.query(func.count(Grievance.id)).filter(
            Grievance.department_id == department_id,
            Grievance.priority == policy.priority,
            func.date(Grievance.created_at) == metric_date,
        ).scalar() or 0
        weighted_sum += policy.duration_minutes * count
        total_weight += count

    if total_weight == 0:
        # Fall back to medium policy or minimum
        medium = next((p for p in policies if p.priority == "medium"), policies[0])
        return float(medium.duration_minutes)

    return weighted_sum / total_weight


# ─── Core Aggregation ─────────────────────────────────────────────────────────

def aggregate_metrics_for_date(db: Session, target_date: date) -> int:
    """
    Aggregates operational metrics for all (department, category) pairs for
    the given date. Uses UPSERT logic: if a row already exists for
    (department_id, category_id, metric_date), it is updated in place.

    Returns the number of rows created or updated.
    """
    departments = db.query(Department).filter(Department.is_active == True).all()
    if not departments:
        logger.warning(f"[Analytics] No active departments found — skipping aggregation for {target_date}")
        return 0

    # Pre-compute max grievance volume across all departments for this date
    # (used for GrievanceVolumeScore denominator in Section 12.3)
    dept_grievance_counts: Dict[uuid.UUID, int] = {}
    for dept in departments:
        dept_grievance_counts[dept.id] = db.query(func.count(Grievance.id)).filter(
            Grievance.department_id == dept.id,
            func.date(Grievance.created_at) == target_date,
        ).scalar() or 0

    max_grievances = max(dept_grievance_counts.values()) if dept_grievance_counts else 1
    max_grievances = max(max_grievances, 1)  # prevent division-by-zero

    rows_affected = 0

    for dept in departments:
        categories = db.query(Category).filter(
            Category.department_id == dept.id,
            Category.is_active == True,
        ).all()

        # Also handle departments with no categories yet by using a stub
        if not categories:
            continue

        dept_total_grievances = dept_grievance_counts.get(dept.id, 0)
        sla_target_minutes = _get_avg_sla_target_minutes(db, dept.id, target_date)

        for cat in categories:
            try:
                rows_affected += _upsert_metric_row(
                    db=db,
                    dept=dept,
                    cat=cat,
                    target_date=target_date,
                    dept_total_grievances=dept_total_grievances,
                    max_grievances=max_grievances,
                    sla_target_minutes=sla_target_minutes,
                )
            except Exception as exc:
                logger.error(
                    f"[Analytics] Failed for dept={dept.name}, cat={cat.name}, date={target_date}: {exc}",
                    exc_info=True,
                )
                db.rollback()

    db.commit()
    logger.info(f"[Analytics] Aggregation for {target_date} complete — {rows_affected} rows updated")
    return rows_affected


def _upsert_metric_row(
    db: Session,
    dept: Department,
    cat: Category,
    target_date: date,
    dept_total_grievances: int,
    max_grievances: int,
    sla_target_minutes: float,
) -> int:
    """Creates or updates a single (dept, category, date) metric row."""

    # ── Feedback counts ──
    total_feedback = db.query(func.count(Feedback.id)).filter(
        Feedback.category_id == cat.id,
        func.date(Feedback.created_at) == target_date,
    ).scalar() or 0

    negative_feedback = (
        db.query(func.count(Feedback.id))
        .join(FeedbackAnalysis, FeedbackAnalysis.feedback_id == Feedback.id)
        .filter(
            Feedback.category_id == cat.id,
            func.date(Feedback.created_at) == target_date,
            FeedbackAnalysis.sentiment == "negative",
        )
        .scalar() or 0
    )

    # ── Average star rating → satisfaction ──
    avg_rating_row = db.query(func.avg(cast(Feedback.rating, Float))).filter(
        Feedback.category_id == cat.id,
        func.date(Feedback.created_at) == target_date,
    ).scalar()
    avg_rating = float(avg_rating_row) if avg_rating_row else 0.0
    student_satisfaction = round((avg_rating / 5.0) * 100, 2)

    # ── Grievance counts ──
    cat_total_grievances = db.query(func.count(Grievance.id)).filter(
        Grievance.category_id == cat.id,
        Grievance.department_id == dept.id,
        func.date(Grievance.created_at) == target_date,
    ).scalar() or 0

    resolved_grievances = db.query(func.count(Grievance.id)).filter(
        Grievance.category_id == cat.id,
        Grievance.department_id == dept.id,
        Grievance.status.in_(["resolved", "closed"]),
        func.date(Grievance.updated_at) == target_date,
    ).scalar() or 0

    # ── SLA breaches for this category/department ──
    sla_breaches = (
        db.query(func.count(SLAEvent.id))
        .join(Grievance, Grievance.id == SLAEvent.grievance_id)
        .filter(
            Grievance.category_id == cat.id,
            Grievance.department_id == dept.id,
            SLAEvent.status == "breached",
            func.date(SLAEvent.breached_at) == target_date,
        )
        .scalar() or 0
    )

    # ── Average resolution time ──
    resolved_qs = db.query(Grievance.created_at, Grievance.resolved_at).filter(
        Grievance.category_id == cat.id,
        Grievance.department_id == dept.id,
        Grievance.resolved_at.isnot(None),
        func.date(Grievance.resolved_at) == target_date,
    ).all()

    avg_resolution_minutes = 0
    if resolved_qs:
        total_minutes = 0
        valid_count = 0
        for row in resolved_qs:
            created = row.created_at
            resolved = row.resolved_at
            if created.tzinfo is None:
                created = created.replace(tzinfo=timezone.utc)
            if resolved.tzinfo is None:
                resolved = resolved.replace(tzinfo=timezone.utc)
            diff_minutes = max(0, int((resolved - created).total_seconds() // 60))
            total_minutes += diff_minutes
            valid_count += 1
        if valid_count:
            avg_resolution_minutes = total_minutes // valid_count

    # ── GrievanceVolumeScore (vs maximum across all depts) ──
    grievance_volume_score = (dept_total_grievances / max_grievances) * 100

    # ── Gap Score (exact Section 12.3 formula) ──
    gap_score = _compute_gap_score(
        negative_feedback=negative_feedback,
        total_feedback=total_feedback,
        sla_breaches=sla_breaches,
        total_grievances=cat_total_grievances,
        avg_resolution_minutes=avg_resolution_minutes,
        sla_target_minutes=sla_target_minutes,
        grievance_volume_score=grievance_volume_score,
        student_satisfaction=student_satisfaction,
    )

    # ── UPSERT ──
    existing = db.query(OperationalMetric).filter(
        OperationalMetric.department_id == dept.id,
        OperationalMetric.category_id == cat.id,
        OperationalMetric.metric_date == target_date,
    ).first()

    if existing:
        existing.total_feedback = total_feedback
        existing.negative_feedback = negative_feedback
        existing.total_grievances = cat_total_grievances
        existing.resolved_grievances = resolved_grievances
        existing.sla_breaches = sla_breaches
        existing.avg_resolution_minutes = avg_resolution_minutes
        existing.student_satisfaction = student_satisfaction
        existing.gap_score = gap_score
    else:
        new_row = OperationalMetric(
            id=uuid.uuid4(),
            department_id=dept.id,
            category_id=cat.id,
            metric_date=target_date,
            total_feedback=total_feedback,
            negative_feedback=negative_feedback,
            total_grievances=cat_total_grievances,
            resolved_grievances=resolved_grievances,
            sla_breaches=sla_breaches,
            avg_resolution_minutes=avg_resolution_minutes,
            student_satisfaction=student_satisfaction,
            gap_score=gap_score,
        )
        db.add(new_row)

    return 1


def aggregate_metrics_for_yesterday(db: Session) -> int:
    """Convenience wrapper for the daily startup job."""
    yesterday = date.today() - timedelta(days=1)
    return aggregate_metrics_for_date(db, yesterday)


def aggregate_metrics_for_today(db: Session) -> int:
    """Manual trigger for today's data — useful during dev and testing."""
    return aggregate_metrics_for_date(db, date.today())


# ─── Query Helpers for Analytics Endpoints ────────────────────────────────────

def get_summary_kpis(db: Session, date_from: Optional[date], date_to: Optional[date]) -> Dict[str, Any]:
    """
    Aggregates overall KPIs from the operational_metrics table for the given date range.
    Returns all metrics required for Section 12.2 Power BI KPIs.
    """
    q = db.query(OperationalMetric)
    if date_from:
        q = q.filter(OperationalMetric.metric_date >= date_from)
    if date_to:
        q = q.filter(OperationalMetric.metric_date <= date_to)

    rows = q.all()

    if not rows:
        return {
            "total_feedback": 0,
            "negative_feedback": 0,
            "negative_feedback_pct": 0.0,
            "total_grievances": 0,
            "resolved_grievances": 0,
            "open_grievances": 0,
            "sla_breaches": 0,
            "sla_compliance_pct": 0.0,
            "avg_resolution_minutes": 0,
            "student_satisfaction": 0.0,
            "overall_gap_score": 0.0,
            "gap_score_label": "Low",
        }

    total_feedback = sum(r.total_feedback for r in rows)
    negative_feedback = sum(r.negative_feedback for r in rows)
    total_grievances = sum(r.total_grievances for r in rows)
    resolved_grievances = sum(r.resolved_grievances for r in rows)
    sla_breaches = sum(r.sla_breaches for r in rows)

    # Open grievances: query live (not from metrics table since it's a point-in-time snapshot)
    open_grievances = db.query(func.count(Grievance.id)).filter(
        Grievance.status.in_(["open", "in_progress", "reopened"])
    ).scalar() or 0

    neg_pct = round((negative_feedback / total_feedback * 100), 2) if total_feedback > 0 else 0.0
    sla_compliance_pct = round(((total_grievances - sla_breaches) / total_grievances * 100), 2) if total_grievances > 0 else 100.0

    # Weighted avg resolution minutes
    weighted_minutes = sum(r.avg_resolution_minutes * r.total_grievances for r in rows)
    avg_resolution_minutes = int(weighted_minutes / total_grievances) if total_grievances > 0 else 0

    # Weighted avg satisfaction
    weighted_sat = sum(float(r.student_satisfaction) * r.total_feedback for r in rows)
    avg_satisfaction = round(weighted_sat / total_feedback, 2) if total_feedback > 0 else 0.0

    # Weighted avg gap score
    total_entries = len(rows)
    overall_gap = round(sum(float(r.gap_score) for r in rows) / total_entries, 2) if total_entries > 0 else 0.0

    return {
        "total_feedback": total_feedback,
        "negative_feedback": negative_feedback,
        "negative_feedback_pct": neg_pct,
        "total_grievances": total_grievances,
        "resolved_grievances": resolved_grievances,
        "open_grievances": open_grievances,
        "sla_breaches": sla_breaches,
        "sla_compliance_pct": sla_compliance_pct,
        "avg_resolution_minutes": avg_resolution_minutes,
        "student_satisfaction": avg_satisfaction,
        "overall_gap_score": overall_gap,
        "gap_score_label": get_gap_score_label(overall_gap),
    }


def get_department_metrics(db: Session, date_from: Optional[date], date_to: Optional[date]) -> List[Dict[str, Any]]:
    """
    Per-department performance comparison table.
    Groups and aggregates operational_metrics by department.
    """
    q = db.query(OperationalMetric)
    if date_from:
        q = q.filter(OperationalMetric.metric_date >= date_from)
    if date_to:
        q = q.filter(OperationalMetric.metric_date <= date_to)
    rows = q.all()

    dept_map: Dict[uuid.UUID, Dict[str, Any]] = {}
    for r in rows:
        did = r.department_id
        if did not in dept_map:
            dept_map[did] = {
                "department_id": str(did),
                "department_name": r.department.name if r.department else str(did),
                "total_feedback": 0,
                "negative_feedback": 0,
                "total_grievances": 0,
                "resolved_grievances": 0,
                "sla_breaches": 0,
                "avg_resolution_minutes_sum": 0,
                "avg_resolution_count": 0,
                "gap_score_sum": 0.0,
                "gap_score_count": 0,
                "satisfaction_sum": 0.0,
                "satisfaction_count": 0,
            }
        d = dept_map[did]
        d["total_feedback"] += r.total_feedback
        d["negative_feedback"] += r.negative_feedback
        d["total_grievances"] += r.total_grievances
        d["resolved_grievances"] += r.resolved_grievances
        d["sla_breaches"] += r.sla_breaches
        if r.avg_resolution_minutes > 0:
            d["avg_resolution_minutes_sum"] += r.avg_resolution_minutes * r.total_grievances
            d["avg_resolution_count"] += r.total_grievances
        d["gap_score_sum"] += float(r.gap_score)
        d["gap_score_count"] += 1
        if r.total_feedback > 0:
            d["satisfaction_sum"] += float(r.student_satisfaction) * r.total_feedback
            d["satisfaction_count"] += r.total_feedback

    result = []
    for d in dept_map.values():
        total_grv = d["total_grievances"]
        total_fb = d["total_feedback"]
        breaches = d["sla_breaches"]
        gap = round(d["gap_score_sum"] / d["gap_score_count"], 2) if d["gap_score_count"] else 0.0
        avg_res = int(d["avg_resolution_minutes_sum"] / d["avg_resolution_count"]) if d["avg_resolution_count"] else 0
        satisfaction = round(d["satisfaction_sum"] / d["satisfaction_count"], 2) if d["satisfaction_count"] else 0.0

        result.append({
            "department_id": d["department_id"],
            "department_name": d["department_name"],
            "total_feedback": total_fb,
            "negative_feedback": d["negative_feedback"],
            "negative_feedback_pct": round((d["negative_feedback"] / total_fb * 100), 2) if total_fb else 0.0,
            "total_grievances": total_grv,
            "resolved_grievances": d["resolved_grievances"],
            "sla_breaches": breaches,
            "sla_compliance_pct": round(((total_grv - breaches) / total_grv * 100), 2) if total_grv else 100.0,
            "avg_resolution_minutes": avg_res,
            "student_satisfaction": satisfaction,
            "gap_score": gap,
            "gap_score_label": get_gap_score_label(gap),
        })

    result.sort(key=lambda x: x["gap_score"], reverse=True)
    return result


def get_trends(
    db: Session,
    date_from: Optional[date],
    date_to: Optional[date],
    department_id: Optional[uuid.UUID] = None,
) -> List[Dict[str, Any]]:
    """
    Time-series grouped by day for the trend area chart.
    """
    q = db.query(OperationalMetric)
    if date_from:
        q = q.filter(OperationalMetric.metric_date >= date_from)
    if date_to:
        q = q.filter(OperationalMetric.metric_date <= date_to)
    if department_id:
        q = q.filter(OperationalMetric.department_id == department_id)
    rows = q.all()

    day_map: Dict[date, Dict[str, int]] = {}
    for r in rows:
        d = r.metric_date
        if d not in day_map:
            day_map[d] = {"total_feedback": 0, "negative_feedback": 0, "total_grievances": 0, "sla_breaches": 0}
        day_map[d]["total_feedback"] += r.total_feedback
        day_map[d]["negative_feedback"] += r.negative_feedback
        day_map[d]["total_grievances"] += r.total_grievances
        day_map[d]["sla_breaches"] += r.sla_breaches

    return [
        {
            "date": str(d),
            "total_feedback": v["total_feedback"],
            "negative_feedback": v["negative_feedback"],
            "total_grievances": v["total_grievances"],
            "sla_breaches": v["sla_breaches"],
        }
        for d, v in sorted(day_map.items())
    ]


def get_recurring_issues(
    db: Session,
    date_from: Optional[date],
    date_to: Optional[date],
    department_id: Optional[uuid.UUID] = None,
    top_n: int = 10,
) -> List[Dict[str, Any]]:
    """
    Top categories by total feedback + grievance volume for recurring issues chart.
    """
    q = db.query(OperationalMetric)
    if date_from:
        q = q.filter(OperationalMetric.metric_date >= date_from)
    if date_to:
        q = q.filter(OperationalMetric.metric_date <= date_to)
    if department_id:
        q = q.filter(OperationalMetric.department_id == department_id)
    rows = q.all()

    cat_map: Dict[uuid.UUID, Dict[str, Any]] = {}
    for r in rows:
        cid = r.category_id
        if cid not in cat_map:
            cat_map[cid] = {
                "category_id": str(cid),
                "category_name": r.category.name if r.category else str(cid),
                "total_feedback": 0,
                "total_grievances": 0,
            }
        cat_map[cid]["total_feedback"] += r.total_feedback
        cat_map[cid]["total_grievances"] += r.total_grievances

    # Rank by total volume (feedback + grievances)
    all_cats = list(cat_map.values())
    for c in all_cats:
        c["total_volume"] = c["total_feedback"] + c["total_grievances"]
    all_cats.sort(key=lambda x: x["total_volume"], reverse=True)

    total_volume = sum(c["total_volume"] for c in all_cats) or 1
    return [
        {
            **c,
            "percentage": round(c["total_volume"] / total_volume * 100, 2),
        }
        for c in all_cats[:top_n]
    ]
