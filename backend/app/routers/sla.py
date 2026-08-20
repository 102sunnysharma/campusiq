"""
SLA Router — Phase 6 (Section 8)

Endpoints:
  GET  /sla/policies       — List all SLA policies (Admin, HOD, Staff)
  PUT  /sla/policies/{id}  — Update SLA policy duration/warning (Admin only)
  POST /sla/check-breaches — Trigger active SLA breach and warning scan
"""

import uuid
from typing import List
from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import SLAPolicy
from app.schemas.sla import SLAPolicyResponse, SLAPolicyUpdate
from app.core.dependencies import require_role
from app.core.exceptions import APIException
from app.services.sla_service import scan_and_update_sla_breaches

router = APIRouter(prefix="/sla", tags=["SLA Engine"])


@router.get("/policies", response_model=List[SLAPolicyResponse])
def list_sla_policies(
    db: Session = Depends(get_db),
    current_user=Depends(require_role(["admin", "hod", "staff", "student"])),
):
    """List all SLA duration policies."""
    policies = db.query(SLAPolicy).order_by(SLAPolicy.duration_minutes.asc()).all()
    return [
        SLAPolicyResponse(
            id=str(p.id),
            priority=p.priority,
            duration_minutes=p.duration_minutes,
            warning_percentage=p.warning_percentage,
            is_active=p.is_active,
            created_at=p.created_at,
        )
        for p in policies
    ]


@router.put("/policies/{policy_id}", response_model=SLAPolicyResponse)
def update_sla_policy(
    policy_id: str,
    payload: SLAPolicyUpdate,
    db: Session = Depends(get_db),
    current_user=Depends(require_role(["admin"])),
):
    """Admin updates SLA policy durations or warning thresholds."""
    try:
        pid = uuid.UUID(policy_id)
    except ValueError:
        raise APIException(
            status_code=status.HTTP_400_BAD_REQUEST,
            code="INVALID_ID",
            message="Invalid SLA policy ID format.",
        )

    policy = db.query(SLAPolicy).filter(SLAPolicy.id == pid).first()
    if not policy:
        raise APIException(
            status_code=status.HTTP_404_NOT_FOUND,
            code="POLICY_NOT_FOUND",
            message="SLA policy not found.",
        )

    if payload.duration_minutes is not None:
        policy.duration_minutes = payload.duration_minutes
    if payload.warning_percentage is not None:
        policy.warning_percentage = payload.warning_percentage
    if payload.is_active is not None:
        policy.is_active = payload.is_active

    db.commit()
    db.refresh(policy)

    return SLAPolicyResponse(
        id=str(policy.id),
        priority=policy.priority,
        duration_minutes=policy.duration_minutes,
        warning_percentage=policy.warning_percentage,
        is_active=policy.is_active,
        created_at=policy.created_at,
    )


@router.post("/check-breaches")
def check_sla_breaches_endpoint(
    db: Session = Depends(get_db),
    current_user=Depends(require_role(["admin", "hod", "staff"])),
):
    """Scans all active grievances and updates SLA warnings & breaches."""
    results = scan_and_update_sla_breaches(db)
    return {
        "success": True,
        "message": "SLA scan completed successfully.",
        **results,
    }
