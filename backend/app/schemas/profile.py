from uuid import UUID
from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, Field, ConfigDict

class ProfileUserSummary(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    email: str
    full_name: str
    phone: Optional[str] = None
    is_active: bool
    is_verified: bool
    created_at: datetime
    last_login_at: Optional[datetime] = None

# --- Student Profile Schemas ---
class StudentDetailResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    user_id: UUID
    student_id: str
    roll_number: Optional[str] = None
    department_id: UUID
    department_name: Optional[str] = None
    department_code: Optional[str] = None
    semester: Optional[int] = None
    program: Optional[str] = None
    course_name: Optional[str] = None
    hostel_id: Optional[UUID] = None
    room_number: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    user: ProfileUserSummary

class StudentProfileUpdate(BaseModel):
    roll_number: Optional[str] = None
    department_id: Optional[UUID] = None
    semester: Optional[int] = Field(default=None, ge=1, le=12)
    program: Optional[str] = None
    course_name: Optional[str] = None
    hostel_id: Optional[UUID] = None
    room_number: Optional[str] = None
    full_name: Optional[str] = None
    phone: Optional[str] = None

class StudentListResponse(BaseModel):
    items: List[StudentDetailResponse]
    page: int
    page_size: int
    total: int
    total_pages: int


# --- Staff Profile Schemas ---
class StaffDetailResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    user_id: UUID
    employee_id: str
    department_id: UUID
    department_name: Optional[str] = None
    department_code: Optional[str] = None
    designation: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    user: ProfileUserSummary

class StaffProfileUpdate(BaseModel):
    employee_id: Optional[str] = None
    department_id: Optional[UUID] = None
    designation: Optional[str] = None
    full_name: Optional[str] = None
    phone: Optional[str] = None

class StaffListResponse(BaseModel):
    items: List[StaffDetailResponse]
    page: int
    page_size: int
    total: int
    total_pages: int
