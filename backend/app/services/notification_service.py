"""
Notification Service — Phase 7 (Section 13)

Provides:
  - create_notification(): Core insert function for any notification type.
  - Event-specific helpers called by routers and sla_service:
      notify_grievance_submitted()     → Student confirmation
      notify_grievance_assigned()      → Assigned staff
      notify_grievance_status_changed() → Grievance owner (student)
      notify_sla_warning()             → Assigned staff + HOD
      notify_sla_breach()              → Assigned staff + HOD + all Admins
      notify_feedback_acknowledged()   → Student (NLP analysis done)
"""

import uuid
import logging
from typing import Optional, List
from sqlalchemy.orm import Session

from app.models import Notification, User, Staff, Grievance, Feedback, SLAEvent

logger = logging.getLogger(__name__)


# ─── Core Insert ──────────────────────────────────────────────────────────────

def create_notification(
    db: Session,
    user_id: uuid.UUID,
    type: str,
    title: str,
    message: str,
    reference_type: Optional[str] = None,
    reference_id: Optional[uuid.UUID] = None,
) -> Optional[Notification]:
    """
    Creates and persists a single in-app notification.
    Errors are caught and logged — never propagated to callers.
    """
    try:
        notif = Notification(
            id=uuid.uuid4(),
            user_id=user_id,
            type=type,
            title=title,
            message=message,
            reference_type=reference_type,
            reference_id=reference_id,
            is_read=False,
        )
        db.add(notif)
        db.flush()  # flush only — caller is responsible for commit
        return notif
    except Exception as exc:
        logger.error(f"[NotificationService] Failed to create notification for user {user_id}: {exc}")
        return None


def _bulk_create(db: Session, notif_defs: List[dict]) -> None:
    """Creates multiple notifications in one shot."""
    for nd in notif_defs:
        create_notification(db, **nd)


# ─── Event Helpers ────────────────────────────────────────────────────────────

def notify_grievance_submitted(db: Session, grievance: Grievance) -> None:
    """Notifies the student their grievance was received with a ticket number."""
    try:
        student_user_id = grievance.student.user_id if grievance.student else None
        if not student_user_id:
            return

        create_notification(
            db=db,
            user_id=student_user_id,
            type="grievance_submitted",
            title="Grievance Filed Successfully",
            message=(
                f"Your grievance '{grievance.title}' has been received and assigned "
                f"ticket number {grievance.ticket_number}. Our team will review it shortly."
            ),
            reference_type="grievance",
            reference_id=grievance.id,
        )
    except Exception as exc:
        logger.error(f"[NotificationService] notify_grievance_submitted error: {exc}")


def notify_grievance_assigned(db: Session, grievance: Grievance) -> None:
    """Notifies the assigned staff member about a new ticket assignment."""
    try:
        if not grievance.assigned_staff:
            return

        staff_user_id = grievance.assigned_staff.user_id
        staff_name = (
            grievance.assigned_staff.user.full_name
            if grievance.assigned_staff.user
            else grievance.assigned_staff.employee_id
        )

        create_notification(
            db=db,
            user_id=staff_user_id,
            type="grievance_assigned",
            title=f"New Ticket Assigned — {grievance.ticket_number}",
            message=(
                f"Grievance '{grievance.title}' (Priority: {grievance.priority.upper()}) "
                f"has been assigned to you. Please review and begin work."
            ),
            reference_type="grievance",
            reference_id=grievance.id,
        )
    except Exception as exc:
        logger.error(f"[NotificationService] notify_grievance_assigned error: {exc}")


def notify_grievance_status_changed(
    db: Session,
    grievance: Grievance,
    old_status: str,
    new_status: str,
    actor_name: Optional[str] = None,
) -> None:
    """
    Notifies the grievance owner (student) when status changes.
    Also notifies assigned staff when grievance is reopened by student.
    """
    try:
        # Status display labels
        status_labels = {
            "open": "Open",
            "in_progress": "In Progress",
            "resolved": "Resolved",
            "closed": "Closed",
            "reopened": "Reopened",
        }
        new_label = status_labels.get(new_status, new_status.replace("_", " ").title())
        actor_phrase = f" by {actor_name}" if actor_name else ""

        # Always notify the student (ticket owner)
        if grievance.student and grievance.student.user_id:
            student_messages = {
                "in_progress": f"Your grievance {grievance.ticket_number} is now being investigated by our staff.",
                "resolved": (
                    f"Your grievance {grievance.ticket_number} has been marked as Resolved{actor_phrase}. "
                    f"Please review the resolution and either accept to close, or reopen if unsatisfied."
                ),
                "closed": f"Your grievance {grievance.ticket_number} has been closed. Thank you for your patience.",
                "reopened": f"Your grievance {grievance.ticket_number} has been reopened and sent back to staff for further action.",
            }
            msg = student_messages.get(
                new_status,
                f"Your grievance {grievance.ticket_number} status changed to {new_label}{actor_phrase}."
            )

            create_notification(
                db=db,
                user_id=grievance.student.user_id,
                type="grievance_status_changed",
                title=f"Grievance Update — {grievance.ticket_number}",
                message=msg,
                reference_type="grievance",
                reference_id=grievance.id,
            )

        # Also notify assigned staff when grievance is reopened
        if new_status == "reopened" and grievance.assigned_staff:
            create_notification(
                db=db,
                user_id=grievance.assigned_staff.user_id,
                type="grievance_reopened",
                title=f"Grievance Reopened — {grievance.ticket_number}",
                message=(
                    f"The student has reopened grievance '{grievance.title}' ({grievance.ticket_number}). "
                    f"A new SLA cycle has started. Please re-investigate."
                ),
                reference_type="grievance",
                reference_id=grievance.id,
            )

    except Exception as exc:
        logger.error(f"[NotificationService] notify_grievance_status_changed error: {exc}")


def notify_sla_warning(db: Session, grievance: Grievance, sla_event: SLAEvent) -> None:
    """
    SLA Warning (80%+ elapsed) — notifies assigned staff + HOD.
    Section 8.2.
    """
    try:
        recipients: List[uuid.UUID] = []

        if grievance.assigned_staff:
            recipients.append(grievance.assigned_staff.user_id)

        # Find HOD for the grievance's department
        hod_staff = (
            db.query(Staff)
            .join(Staff.user)
            .filter(Staff.department_id == grievance.department_id)
            .filter(User.role_id.isnot(None))
            .all()
        )
        for s in hod_staff:
            if s.user and s.user.role and s.user.role.name == "hod":
                if s.user_id not in recipients:
                    recipients.append(s.user_id)

        policy = sla_event.sla_policy
        sla_label = f"{policy.priority.upper()}" if policy else "this ticket"

        for user_id in recipients:
            create_notification(
                db=db,
                user_id=user_id,
                type="sla_warning",
                title=f"⚠️ SLA Warning — {grievance.ticket_number}",
                message=(
                    f"Grievance '{grievance.title}' ({grievance.ticket_number}) has consumed "
                    f"over 80% of its SLA window ({sla_label} priority). "
                    f"Deadline approaching — please act immediately."
                ),
                reference_type="grievance",
                reference_id=grievance.id,
            )

    except Exception as exc:
        logger.error(f"[NotificationService] notify_sla_warning error: {exc}")


def notify_sla_breach(db: Session, grievance: Grievance, sla_event: SLAEvent) -> None:
    """
    SLA Breach — notifies assigned staff + HOD + all Admins.
    Section 8.2.
    """
    try:
        recipients: List[uuid.UUID] = []

        if grievance.assigned_staff:
            recipients.append(grievance.assigned_staff.user_id)

        # HOD in the department
        dept_staff = (
            db.query(Staff)
            .join(Staff.user)
            .filter(Staff.department_id == grievance.department_id)
            .all()
        )
        for s in dept_staff:
            if s.user and s.user.role and s.user.role.name == "hod":
                if s.user_id not in recipients:
                    recipients.append(s.user_id)

        # All Admins
        admins = (
            db.query(User)
            .join(User.role)
            .filter(User.role.has(name="admin"), User.is_active == True)
            .all()
        )
        for admin_user in admins:
            if admin_user.id not in recipients:
                recipients.append(admin_user.id)

        for user_id in recipients:
            create_notification(
                db=db,
                user_id=user_id,
                type="sla_breached",
                title=f"🔴 SLA BREACHED — {grievance.ticket_number}",
                message=(
                    f"URGENT: Grievance '{grievance.title}' ({grievance.ticket_number}) "
                    f"has exceeded its SLA deadline and is now in breach. "
                    f"Immediate escalation and resolution is required."
                ),
                reference_type="grievance",
                reference_id=grievance.id,
            )

    except Exception as exc:
        logger.error(f"[NotificationService] notify_sla_breach error: {exc}")


def notify_feedback_acknowledged(db: Session, feedback: Feedback) -> None:
    """
    Notifies the student that their feedback NLP analysis is complete.
    (Only sent when analysis succeeds — not on failure.)
    """
    try:
        if not feedback.student or not feedback.student.user_id:
            return

        create_notification(
            db=db,
            user_id=feedback.student.user_id,
            type="feedback_analyzed",
            title="Feedback Analysis Complete",
            message=(
                "Your feedback has been received and analyzed. "
                "You can view the sentiment insights in your My Feedback section."
            ),
            reference_type="feedback",
            reference_id=feedback.id,
        )
    except Exception as exc:
        logger.error(f"[NotificationService] notify_feedback_acknowledged error: {exc}")
