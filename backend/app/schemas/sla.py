"""
Pydantic Schemas — SLA Policies & Events (Phase 6)
"""

from __future__ import annotations
from typing import Optional
from datetime import datetime
from pydantic import BaseModel, ConfigDict, Field


class SLAPolicyResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    priority: str
    duration_minutes: int
    warning_percentage: int
    is_active: bool
    created_at: datetime


class SLAPolicyUpdate(BaseModel):
    duration_minutes: Optional[int] = Field(None, ge=1, description="Duration in minutes")
    warning_percentage: Optional[int] = Field(None, ge=1, le=99, description="Warning threshold percentage (e.g. 80)")
    is_active: Optional[bool] = None


class SLAEventResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    grievance_id: str
    sla_policy_id: str
    priority: Optional[str] = None
    started_at: datetime
    deadline_at: datetime
    warning_at: datetime
    completed_at: Optional[datetime] = None
    status: str  # on_track / warning / breached / completed
    breached_at: Optional[datetime] = None
    time_remaining_minutes: Optional[int] = None
    percentage_elapsed: Optional[float] = None
