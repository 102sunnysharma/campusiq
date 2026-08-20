"""
Pydantic Schemas — Grievance Management Module (Phase 6)

Covers:
  - GrievanceCreate          : Student submission payload
  - GrievanceStatusUpdate    : State change with optional comment
  - GrievanceAssign          : Staff assignment
  - GrievancePriorityUpdate  : Priority adjustment
  - GrievanceUpdateResponse  : Audit log row for status change
  - GrievanceResponse        : Full ticket detail with nested relations & SLA
  - GrievanceListResponse    : Standard paginated wrapper (Section 14.3)
"""

from __future__ import annotations
from typing import Optional, List
from datetime import datetime
from pydantic import BaseModel, ConfigDict, Field, field_validator
from app.schemas.sla import SLAEventResponse


class DepartmentSummary(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    code: str
    name: str


class CategorySummary(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    name: str
    department_id: str


class StudentSummary(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    student_id: str
    user_full_name: Optional[str] = None
    user_email: Optional[str] = None
    program: Optional[str] = None
    course_name: Optional[str] = None
    semester: Optional[int] = None
    roll_number: Optional[str] = None


class StaffSummary(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    employee_id: str
    user_full_name: Optional[str] = None
    user_email: Optional[str] = None
    designation: Optional[str] = None


class GrievanceUpdateResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    grievance_id: str
    updated_by: str
    updater_name: Optional[str] = None
    updater_role: Optional[str] = None
    old_status: str
    new_status: str
    comment: Optional[str] = None
    created_at: datetime


class GrievanceCreate(BaseModel):
    category_id: str = Field(..., description="UUID of the category for this grievance")
    title: str = Field(..., min_length=3, max_length=200, description="Short summary of the grievance")
    description: str = Field(..., min_length=10, max_length=10000, description="Detailed explanation of the grievance")
    priority: str = Field(default="medium", description="Priority: low / medium / high / urgent")

    @field_validator("title")
    @classmethod
    def validate_title(cls, v: str) -> str:
        if not v.strip():
            raise ValueError("Title cannot be blank.")
        return v.strip()

    @field_validator("description")
    @classmethod
    def validate_description(cls, v: str) -> str:
        if not v.strip():
            raise ValueError("Description cannot be blank.")
        return v.strip()

    @field_validator("priority")
    @classmethod
    def validate_priority(cls, v: str) -> str:
        val = v.lower().strip()
        if val not in ("low", "medium", "high", "urgent"):
            raise ValueError("Priority must be one of: low, medium, high, urgent")
        return val


class GrievanceStatusUpdate(BaseModel):
    status: str = Field(..., description="Target status: in_progress, resolved, closed, reopened")
    comment: Optional[str] = Field(None, max_length=2000, description="Optional explanation or resolution remarks")

    @field_validator("status")
    @classmethod
    def validate_status(cls, v: str) -> str:
        val = v.lower().strip()
        if val not in ("in_progress", "resolved", "closed", "reopened"):
            raise ValueError("Status must be one of: in_progress, resolved, closed, reopened")
        return val


class GrievanceAssign(BaseModel):
    assigned_staff_id: str = Field(..., description="UUID of staff to assign")
    comment: Optional[str] = Field(None, max_length=1000, description="Optional assignment notes")


class GrievancePriorityUpdate(BaseModel):
    priority: str = Field(..., description="New priority: low, medium, high, urgent")
    comment: Optional[str] = Field(None, max_length=1000, description="Reason for priority change")

    @field_validator("priority")
    @classmethod
    def validate_priority(cls, v: str) -> str:
        val = v.lower().strip()
        if val not in ("low", "medium", "high", "urgent"):
            raise ValueError("Priority must be one of: low, medium, high, urgent")
        return val


class GrievanceResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    ticket_number: str
    student_id: str
    category_id: str
    department_id: str
    assigned_staff_id: Optional[str] = None
    title: str
    description: str
    priority: str
    status: str
    source: str
    created_at: datetime
    updated_at: datetime
    resolved_at: Optional[datetime] = None
    closed_at: Optional[datetime] = None

    # Nested related objects
    category: Optional[CategorySummary] = None
    department: Optional[DepartmentSummary] = None
    student: Optional[StudentSummary] = None
    assigned_staff: Optional[StaffSummary] = None
    updates: Optional[List[GrievanceUpdateResponse]] = None
    current_sla: Optional[SLAEventResponse] = None
    sla_events: Optional[List[SLAEventResponse]] = None


class GrievanceListResponse(BaseModel):
    items: List[GrievanceResponse]
    page: int
    page_size: int
    total: int
    total_pages: int
