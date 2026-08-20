"""
SLA Service — Phase 6 (Section 8)

Handles:
  1. Creating SLAEvent records tied to SLAPolicy durations per priority.
  2. Calculating live SLA progress, remaining time, and warning/breach states.
  3. Completing SLA cycles when grievance is resolved.
  4. Creating new SLAEvent cycles upon grievance reopening (Section 8.3).
  5. Scanning and updating warning/breach states for active tickets.
"""

import uuid
from datetime import datetime, timezone, timedelta
from typing import Optional, Dict, Any, List
from sqlalchemy.orm import Session
from app.models import Grievance, SLAPolicy, SLAEvent


def get_sla_policy_for_priority(db: Session, priority: str) -> SLAPolicy:
    """Fetch active SLA policy matching the grievance priority."""
    policy = (
        db.query(SLAPolicy)
        .filter(SLAPolicy.priority == priority.lower(), SLAPolicy.is_active == True)
        .first()
    )
    if not policy:
        # Fallback defaults if table record not found
        default_durations = {
            "urgent": 240,    # 4 hours
            "high": 1440,     # 24 hours
            "medium": 4320,   # 72 hours (3 days)
            "low": 7200,      # 120 hours (5 days)
        }
        duration = default_durations.get(priority.lower(), 4320)
        policy = SLAPolicy(
            id=uuid.uuid4(),
            priority=priority.lower(),
            duration_minutes=duration,
            warning_percentage=80,
            is_active=True,
        )
        db.add(policy)
        db.flush()
    return policy


def create_sla_event(db: Session, grievance_id: uuid.UUID, priority: str) -> SLAEvent:
    """
    Creates an initial or new SLAEvent for a grievance.
    SLA is continuous in v1 (Section 8.3).
    """
    policy = get_sla_policy_for_priority(db, priority)
    started_at = datetime.now(timezone.utc)
    duration_mins = policy.duration_minutes
    warning_mins = int(duration_mins * (policy.warning_percentage / 100.0))

    deadline_at = started_at + timedelta(minutes=duration_mins)
    warning_at = started_at + timedelta(minutes=warning_mins)

    sla_event = SLAEvent(
        id=uuid.uuid4(),
        grievance_id=grievance_id,
        sla_policy_id=policy.id,
        started_at=started_at,
        deadline_at=deadline_at,
        warning_at=warning_at,
        completed_at=None,
        status="on_track",
        breached_at=None,
    )
    db.add(sla_event)
    db.flush()
    return sla_event


def complete_sla_event(db: Session, grievance_id: uuid.UUID, resolved_at: Optional[datetime] = None) -> Optional[SLAEvent]:
    """
    Stops the active SLA when grievance status becomes 'resolved' (Section 8.3).
    Sets completed_at and status = 'completed'.
    """
    active_event = (
        db.query(SLAEvent)
        .filter(SLAEvent.grievance_id == grievance_id, SLAEvent.completed_at.is_(None))
        .order_by(SLAEvent.started_at.desc())
        .first()
    )
    if active_event:
        now = resolved_at or datetime.now(timezone.utc)
        active_event.completed_at = now
        # If it was already breached before completion, keep breach timestamp but mark completed
        active_event.status = "completed"
        db.flush()
        return active_event
    return None


def reopen_sla_event(db: Session, grievance_id: uuid.UUID, priority: str) -> SLAEvent:
    """
    A reopened grievance starts a brand-new SLA cycle (Section 8.3).
    The previous SLA event remains intact for history/audit.
    """
    return create_sla_event(db, grievance_id, priority)


def calculate_sla_metrics(sla_event: SLAEvent) -> Dict[str, Any]:
    """
    Computes real-time countdown, elapsed percentage, and live status.
    """
    now = datetime.now(timezone.utc)

    # If completed, use completed_at as reference
    end_time = sla_event.completed_at if sla_event.completed_at else now

    # Ensure timezone aware
    started = sla_event.started_at
    if started.tzinfo is None:
        started = started.replace(tzinfo=timezone.utc)

    deadline = sla_event.deadline_at
    if deadline.tzinfo is None:
        deadline = deadline.replace(tzinfo=timezone.utc)

    warning = sla_event.warning_at
    if warning.tzinfo is None:
        warning = warning.replace(tzinfo=timezone.utc)

    total_duration_sec = max((deadline - started).total_seconds(), 1)
    elapsed_sec = max((end_time - started).total_seconds(), 0)
    remaining_sec = (deadline - end_time).total_seconds()

    percentage_elapsed = min(round((elapsed_sec / total_duration_sec) * 100, 1), 100.0)
    time_remaining_minutes = int(remaining_sec // 60)

    # Determine live status if not already completed
    if sla_event.completed_at:
        live_status = "completed"
    elif now >= deadline:
        live_status = "breached"
    elif now >= warning:
        live_status = "warning"
    else:
        live_status = "on_track"

    return {
        "status": live_status,
        "time_remaining_minutes": time_remaining_minutes,
        "percentage_elapsed": percentage_elapsed,
        "is_breached": now >= deadline if not sla_event.completed_at else (sla_event.breached_at is not None),
        "is_warning": now >= warning and now < deadline if not sla_event.completed_at else False,
    }


def scan_and_update_sla_breaches(db: Session) -> Dict[str, int]:
    """
    Scans all active (uncompleted) SLA events and updates status to 'warning' or 'breached'.
    Returns count of warnings and breaches flagged.
    """
    now = datetime.now(timezone.utc)
    active_events = (
        db.query(SLAEvent)
        .join(Grievance, Grievance.id == SLAEvent.grievance_id)
        .filter(
            SLAEvent.completed_at.is_(None),
            Grievance.status.in_(["open", "in_progress", "reopened"])
        )
        .all()
    )

    warnings_count = 0
    breaches_count = 0

    for event in active_events:
        deadline = event.deadline_at
        if deadline.tzinfo is None:
            deadline = deadline.replace(tzinfo=timezone.utc)

        warning = event.warning_at
        if warning.tzinfo is None:
            warning = warning.replace(tzinfo=timezone.utc)

        if now >= deadline:
            if event.status != "breached":
                event.status = "breached"
                event.breached_at = now
                breaches_count += 1
        elif now >= warning:
            if event.status == "on_track":
                event.status = "warning"
                warnings_count += 1

    if warnings_count or breaches_count:
        db.commit()

    return {"warnings_flagged": warnings_count, "breaches_flagged": breaches_count}
