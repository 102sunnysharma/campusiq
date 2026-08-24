"""
Notifications Router — Phase 7 (Section 13)

Endpoints:
  GET    /notifications               — Paginated list of caller's notifications
  GET    /notifications/unread-count  — Count of unread notifications (for badge)
  PATCH  /notifications/mark-read     — Mark multiple notifications as read
  PATCH  /notifications/{id}/mark-read — Mark single notification as read
"""

import uuid
import math
import logging
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session
from sqlalchemy import desc, and_

from app.database import get_db
from app.models import Notification
from app.schemas.notification import (
    NotificationResponse,
    NotificationListResponse,
    MarkReadRequest,
    UnreadCountResponse,
)
from app.core.dependencies import get_current_user
from app.core.exceptions import APIException

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/notifications", tags=["Notifications"])


def _to_response(n: Notification) -> NotificationResponse:
    return NotificationResponse(
        id=str(n.id),
        user_id=str(n.user_id),
        type=n.type,
        title=n.title,
        message=n.message,
        reference_type=n.reference_type,
        reference_id=str(n.reference_id) if n.reference_id else None,
        is_read=n.is_read,
        created_at=n.created_at,
        read_at=n.read_at,
    )


# ─── GET /notifications ────────────────────────────────────────────────────────

@router.get("", response_model=NotificationListResponse)
def list_notifications(
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    is_read: Optional[bool] = Query(default=None, description="Filter by read/unread status"),
    type: Optional[str] = Query(default=None, description="Filter by notification type"),
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """Returns the authenticated user's notifications, newest first."""
    query = (
        db.query(Notification)
        .filter(Notification.user_id == current_user.id)
    )

    if is_read is not None:
        query = query.filter(Notification.is_read == is_read)
    if type:
        query = query.filter(Notification.type == type)

    query = query.order_by(desc(Notification.created_at))

    total = query.count()
    items = query.offset((page - 1) * page_size).limit(page_size).all()

    return NotificationListResponse(
        items=[_to_response(n) for n in items],
        page=page,
        page_size=page_size,
        total=total,
        total_pages=math.ceil(total / page_size) if total else 1,
    )


# ─── GET /notifications/unread-count ──────────────────────────────────────────

@router.get("/unread-count", response_model=UnreadCountResponse)
def get_unread_count(
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """Returns the count of unread notifications for the bell badge."""
    count = (
        db.query(Notification)
        .filter(Notification.user_id == current_user.id, Notification.is_read == False)
        .count()
    )
    return UnreadCountResponse(count=count)


# ─── PATCH /notifications/mark-read (bulk) ────────────────────────────────────

@router.patch("/mark-read")
def mark_multiple_read(
    payload: MarkReadRequest,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """Marks one or more notifications as read. User can only mark their own."""
    if not payload.notification_ids:
        return {"success": True, "updated": 0}

    try:
        ids = [uuid.UUID(nid) for nid in payload.notification_ids]
    except ValueError:
        raise APIException(
            status_code=status.HTTP_400_BAD_REQUEST,
            code="INVALID_ID",
            message="One or more notification IDs are invalid.",
        )

    now = datetime.now(timezone.utc)
    updated = (
        db.query(Notification)
        .filter(
            Notification.id.in_(ids),
            Notification.user_id == current_user.id,
            Notification.is_read == False,
        )
        .all()
    )

    count = 0
    for n in updated:
        n.is_read = True
        n.read_at = now
        count += 1

    db.commit()
    return {"success": True, "updated": count}


# ─── PATCH /notifications/mark-all-read ───────────────────────────────────────

@router.patch("/mark-all-read")
def mark_all_read(
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """Marks ALL of the current user's unread notifications as read."""
    now = datetime.now(timezone.utc)
    unread = (
        db.query(Notification)
        .filter(Notification.user_id == current_user.id, Notification.is_read == False)
        .all()
    )

    count = 0
    for n in unread:
        n.is_read = True
        n.read_at = now
        count += 1

    db.commit()
    return {"success": True, "updated": count}


# ─── PATCH /notifications/{id}/mark-read ──────────────────────────────────────

@router.patch("/{notification_id}/mark-read", response_model=NotificationResponse)
def mark_single_read(
    notification_id: str,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """Marks a single notification as read."""
    try:
        nid = uuid.UUID(notification_id)
    except ValueError:
        raise APIException(
            status_code=status.HTTP_400_BAD_REQUEST,
            code="INVALID_ID",
            message="Invalid notification ID format.",
        )

    notif = (
        db.query(Notification)
        .filter(Notification.id == nid, Notification.user_id == current_user.id)
        .first()
    )

    if not notif:
        raise APIException(
            status_code=status.HTTP_404_NOT_FOUND,
            code="NOTIFICATION_NOT_FOUND",
            message="Notification not found or does not belong to you.",
        )

    if not notif.is_read:
        notif.is_read = True
        notif.read_at = datetime.now(timezone.utc)
        db.commit()
        db.refresh(notif)

    return _to_response(notif)
