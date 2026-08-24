"""
Audit Service — Phase 7 (Section 16)

Writes structured audit_logs entries for sensitive write operations.
All functions are non-blocking — errors are caught and logged,
never propagated to the calling router or service.

Sensitive actions tracked:
  - grievance_created, grievance_status_updated, grievance_assigned
  - feedback_submitted, feedback_analysis_failed
  - user_role_changed, user_password_reset, user_deactivated
"""

import uuid
import logging
from typing import Optional, Any, Dict
from datetime import datetime, timezone
from sqlalchemy.orm import Session

from app.models import AuditLog

logger = logging.getLogger(__name__)


def log_audit(
    db: Session,
    action: str,
    entity_type: str,
    entity_id: uuid.UUID,
    user_id: Optional[uuid.UUID] = None,
    old_values: Optional[Dict[str, Any]] = None,
    new_values: Optional[Dict[str, Any]] = None,
    ip_address: Optional[str] = None,
    user_agent: Optional[str] = None,
) -> Optional[AuditLog]:
    """
    Insert an audit log entry. Never raises — errors are caught internally.
    Should be called AFTER the main db.commit() so the log reflects reality.
    """
    try:
        entry = AuditLog(
            id=uuid.uuid4(),
            user_id=user_id,
            action=action,
            entity_type=entity_type,
            entity_id=entity_id,
            old_values=old_values,
            new_values=new_values,
            ip_address=ip_address,
            user_agent=user_agent,
        )
        db.add(entry)
        db.flush()
        return entry
    except Exception as exc:
        logger.error(f"[AuditService] Failed to write audit log (action={action}, entity={entity_id}): {exc}")
        return None


# ─── Convenience Wrappers ─────────────────────────────────────────────────────

def audit_grievance_created(
    db: Session,
    grievance,
    actor_id: Optional[uuid.UUID] = None,
    ip_address: Optional[str] = None,
    user_agent: Optional[str] = None,
) -> None:
    log_audit(
        db=db,
        action="grievance_created",
        entity_type="grievance",
        entity_id=grievance.id,
        user_id=actor_id,
        new_values={
            "ticket_number": grievance.ticket_number,
            "priority": grievance.priority,
            "status": grievance.status,
            "category_id": str(grievance.category_id),
            "department_id": str(grievance.department_id),
        },
        ip_address=ip_address,
        user_agent=user_agent,
    )


def audit_grievance_status_updated(
    db: Session,
    grievance,
    old_status: str,
    new_status: str,
    actor_id: Optional[uuid.UUID] = None,
    comment: Optional[str] = None,
    ip_address: Optional[str] = None,
    user_agent: Optional[str] = None,
) -> None:
    log_audit(
        db=db,
        action="grievance_status_updated",
        entity_type="grievance",
        entity_id=grievance.id,
        user_id=actor_id,
        old_values={"status": old_status},
        new_values={
            "status": new_status,
            "ticket_number": grievance.ticket_number,
            "comment": comment,
        },
        ip_address=ip_address,
        user_agent=user_agent,
    )


def audit_grievance_assigned(
    db: Session,
    grievance,
    old_staff_id: Optional[uuid.UUID],
    new_staff_id: uuid.UUID,
    actor_id: Optional[uuid.UUID] = None,
    ip_address: Optional[str] = None,
    user_agent: Optional[str] = None,
) -> None:
    log_audit(
        db=db,
        action="grievance_assigned",
        entity_type="grievance",
        entity_id=grievance.id,
        user_id=actor_id,
        old_values={"assigned_staff_id": str(old_staff_id) if old_staff_id else None},
        new_values={
            "assigned_staff_id": str(new_staff_id),
            "ticket_number": grievance.ticket_number,
        },
        ip_address=ip_address,
        user_agent=user_agent,
    )


def audit_feedback_submitted(
    db: Session,
    feedback,
    actor_id: Optional[uuid.UUID] = None,
    ip_address: Optional[str] = None,
    user_agent: Optional[str] = None,
) -> None:
    log_audit(
        db=db,
        action="feedback_submitted",
        entity_type="feedback",
        entity_id=feedback.id,
        user_id=actor_id,
        new_values={
            "category_id": str(feedback.category_id),
            "rating": feedback.rating,
            "is_anonymous": feedback.is_anonymous,
        },
        ip_address=ip_address,
        user_agent=user_agent,
    )


def audit_user_role_changed(
    db: Session,
    target_user,
    old_role: str,
    new_role: str,
    actor_id: Optional[uuid.UUID] = None,
    ip_address: Optional[str] = None,
    user_agent: Optional[str] = None,
) -> None:
    log_audit(
        db=db,
        action="user_role_changed",
        entity_type="user",
        entity_id=target_user.id,
        user_id=actor_id,
        old_values={"role": old_role, "email": target_user.email},
        new_values={"role": new_role, "email": target_user.email},
        ip_address=ip_address,
        user_agent=user_agent,
    )


def audit_password_reset(
    db: Session,
    target_user,
    actor_id: Optional[uuid.UUID] = None,
    ip_address: Optional[str] = None,
    user_agent: Optional[str] = None,
) -> None:
    log_audit(
        db=db,
        action="password_reset_by_admin",
        entity_type="user",
        entity_id=target_user.id,
        user_id=actor_id,
        new_values={"email": target_user.email, "reset_by_admin": True},
        ip_address=ip_address,
        user_agent=user_agent,
    )
