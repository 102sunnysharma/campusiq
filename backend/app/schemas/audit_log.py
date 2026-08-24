"""
Pydantic Schemas — Audit Logs (Phase 7, Section 16)
"""

from __future__ import annotations
from typing import Optional, List, Any, Dict
from datetime import datetime

from pydantic import BaseModel, ConfigDict


class AuditLogResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    user_id: Optional[str] = None
    action: str
    entity_type: str
    entity_id: str
    old_values: Optional[Dict[str, Any]] = None
    new_values: Optional[Dict[str, Any]] = None
    ip_address: Optional[str] = None
    user_agent: Optional[str] = None
    created_at: datetime

    # Actor user info (populated by router)
    actor_email: Optional[str] = None
    actor_name: Optional[str] = None


class AuditLogListResponse(BaseModel):
    items: List[AuditLogResponse]
    page: int
    page_size: int
    total: int
    total_pages: int
