"""
Analytics Router — Phase 8 (Section 12)

Endpoints:
  POST /analytics/aggregate            — Admin: trigger aggregation for a date
  GET  /analytics/summary              — Admin/HOD: KPI summary cards
  GET  /analytics/departments          — Admin/HOD: department comparison table
  GET  /analytics/trends               — Admin/HOD: time-series trend data
  GET  /analytics/recurring-issues     — Admin/HOD: top categories by volume
"""

import uuid
import logging
from datetime import date
from typing import Optional

from fastapi import APIRouter, Depends, Query, BackgroundTasks
from sqlalchemy.orm import Session

from app.database import get_db
from app.core.dependencies import require_role
from app.schemas.analytics import (
    AggregateRequest,
    AggregateResponse,
    MetricsSummary,
    DepartmentListResponse,
    TrendsResponse,
    RecurringIssuesResponse,
)
from app.services.analytics_service import (
    aggregate_metrics_for_date,
    aggregate_metrics_for_today,
    get_summary_kpis,
    get_department_metrics,
    get_trends,
    get_recurring_issues,
)

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/analytics", tags=["Analytics"])


# ─── POST /analytics/aggregate ────────────────────────────────────────────────

@router.post("/aggregate", response_model=AggregateResponse)
def trigger_aggregation(
    payload: AggregateRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user=Depends(require_role(["admin"])),
):
    """
    Admin only. Triggers the operational_metrics aggregation job for a given date.
    Defaults to today if no date is provided. Runs synchronously (fast enough for admin use).
    """
    target = payload.target_date or date.today()
    logger.info(f"[Analytics] Manual aggregation triggered by {current_user.email} for {target}")
    rows = aggregate_metrics_for_date(db, target)

    return AggregateResponse(
        success=True,
        rows_updated=rows,
        target_date=str(target),
        message=f"Aggregation complete. {rows} metric rows created/updated for {target}.",
    )


# ─── GET /analytics/summary ───────────────────────────────────────────────────

@router.get("/summary", response_model=MetricsSummary)
def get_kpi_summary(
    date_from: Optional[date] = Query(default=None, description="Start date (YYYY-MM-DD)"),
    date_to: Optional[date] = Query(default=None, description="End date (YYYY-MM-DD)"),
    db: Session = Depends(get_db),
    current_user=Depends(require_role(["admin", "hod"])),
):
    """
    Overall KPI summary from the operational_metrics table.
    Covers all Section 12.2 Power BI KPIs in a single response.
    """
    data = get_summary_kpis(db, date_from, date_to)
    return MetricsSummary(**data)


# ─── GET /analytics/departments ───────────────────────────────────────────────

@router.get("/departments", response_model=DepartmentListResponse)
def get_department_comparison(
    date_from: Optional[date] = Query(default=None),
    date_to: Optional[date] = Query(default=None),
    db: Session = Depends(get_db),
    current_user=Depends(require_role(["admin", "hod"])),
):
    """
    Per-department performance comparison table.
    Sorted by gap_score descending (worst performers first).
    """
    rows = get_department_metrics(db, date_from, date_to)
    return DepartmentListResponse(items=rows)


# ─── GET /analytics/trends ────────────────────────────────────────────────────

@router.get("/trends", response_model=TrendsResponse)
def get_trend_data(
    date_from: Optional[date] = Query(default=None),
    date_to: Optional[date] = Query(default=None),
    department_id: Optional[str] = Query(default=None),
    db: Session = Depends(get_db),
    current_user=Depends(require_role(["admin", "hod"])),
):
    """
    Time-series trend data grouped by day for the area chart.
    Optionally filterable by department.
    """
    dept_uuid = None
    if department_id:
        try:
            dept_uuid = uuid.UUID(department_id)
        except ValueError:
            dept_uuid = None

    points = get_trends(db, date_from, date_to, department_id=dept_uuid)
    return TrendsResponse(items=points)


# ─── GET /analytics/recurring-issues ──────────────────────────────────────────

@router.get("/recurring-issues", response_model=RecurringIssuesResponse)
def get_recurring_issue_data(
    date_from: Optional[date] = Query(default=None),
    date_to: Optional[date] = Query(default=None),
    department_id: Optional[str] = Query(default=None),
    top_n: int = Query(default=10, ge=1, le=50),
    db: Session = Depends(get_db),
    current_user=Depends(require_role(["admin", "hod"])),
):
    """
    Top categories by feedback + grievance volume.
    Used for the recurring issues doughnut chart and Section 12.2 Recurring Issues KPI.
    """
    dept_uuid = None
    if department_id:
        try:
            dept_uuid = uuid.UUID(department_id)
        except ValueError:
            dept_uuid = None

    rows = get_recurring_issues(db, date_from, date_to, department_id=dept_uuid, top_n=top_n)
    return RecurringIssuesResponse(items=rows)
