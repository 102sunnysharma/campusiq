"""
Audit Logs Router — Phase 7 (Section 16)

Endpoints:
  GET /audit-logs — Admin only, paginated, filterable audit trail
"""

import uuid
import math
import logging
from typing import Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import desc, and_

from app.database import get_db
from app.models import AuditLog, User
from app.schemas.audit_log import AuditLogResponse, AuditLogListResponse
from app.core.dependencies import require_role

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/audit-logs", tags=["Audit Logs"])


@router.get("", response_model=AuditLogListResponse)
def list_audit_logs(
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=25, ge=1, le=100),
    entity_type: Optional[str] = Query(default=None),
    action: Optional[str] = Query(default=None),
    user_id: Optional[str] = Query(default=None, description="Filter by actor user UUID"),
    date_from: Optional[str] = Query(default=None),
    date_to: Optional[str] = Query(default=None),
    db: Session = Depends(get_db),
    current_user=Depends(require_role(["admin"])),
):
    """Admin-only paginated audit log viewer."""
    from datetime import datetime

    query = db.query(AuditLog).options(joinedload(AuditLog.user))

    filters = []
    if entity_type:
        filters.append(AuditLog.entity_type == entity_type)
    if action:
        filters.append(AuditLog.action == action)
    if user_id:
        try:
            filters.append(AuditLog.user_id == uuid.UUID(user_id))
        except ValueError:
            pass
    if date_from:
        try:
            filters.append(AuditLog.created_at >= datetime.fromisoformat(date_from))
        except ValueError:
            pass
    if date_to:
        try:
            filters.append(AuditLog.created_at <= datetime.fromisoformat(date_to + "T23:59:59"))
        except ValueError:
            pass

    if filters:
        query = query.filter(and_(*filters))

    query = query.order_by(desc(AuditLog.created_at))
    total = query.count()
    items = query.offset((page - 1) * page_size).limit(page_size).all()

    responses = []
    for log in items:
        responses.append(AuditLogResponse(
            id=str(log.id),
            user_id=str(log.user_id) if log.user_id else None,
            action=log.action,
            entity_type=log.entity_type,
            entity_id=str(log.entity_id),
            old_values=log.old_values,
            new_values=log.new_values,
            ip_address=str(log.ip_address) if log.ip_address else None,
            user_agent=log.user_agent,
            created_at=log.created_at,
            actor_email=log.user.email if log.user else None,
            actor_name=log.user.full_name if log.user else None,
        ))

    return AuditLogListResponse(
        items=responses,
        page=page,
        page_size=page_size,
        total=total,
        total_pages=math.ceil(total / page_size) if total else 1,
    )
