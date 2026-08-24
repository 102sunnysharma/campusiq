"""
Pydantic Schemas — Notifications (Phase 7, Section 13)
"""

from __future__ import annotations
from typing import Optional, List
from datetime import datetime
import uuid

from pydantic import BaseModel, ConfigDict


class NotificationResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    user_id: str
    type: str
    title: str
    message: str
    reference_type: Optional[str] = None
    reference_id: Optional[str] = None
    is_read: bool
    created_at: datetime
    read_at: Optional[datetime] = None


class NotificationListResponse(BaseModel):
    items: List[NotificationResponse]
    page: int
    page_size: int
    total: int
    total_pages: int


class MarkReadRequest(BaseModel):
    notification_ids: List[str]


class UnreadCountResponse(BaseModel):
    count: int
