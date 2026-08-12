from uuid import UUID
from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, EmailStr, Field, ConfigDict

class RoleResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    name: str
    description: Optional[str] = None

class StudentProfileResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    student_id: str
    roll_number: Optional[str] = None
    department_id: UUID
    semester: Optional[int] = None
    program: Optional[str] = None
    course_name: Optional[str] = None
    hostel_id: Optional[UUID] = None
    room_number: Optional[str] = None

class StaffProfileResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    employee_id: str
    department_id: UUID
    designation: Optional[str] = None

class UserResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    email: str
    full_name: str
    phone: Optional[str] = None
    role: RoleResponse
    is_active: bool
    is_verified: bool
    created_at: datetime
    last_login_at: Optional[datetime] = None
    student_profile: Optional[StudentProfileResponse] = None
    staff_profile: Optional[StaffProfileResponse] = None

class RegisterRequest(BaseModel):
    email: EmailStr
    password: str = Field(..., min_length=6, description="Password must be at least 6 characters")
    full_name: str
    phone: Optional[str] = None
    role_name: str = Field(default="student", description="One of: student, staff, hod, admin")

    # Student specific fields
    student_id: Optional[str] = None
    roll_number: Optional[str] = None
    department_id: Optional[UUID] = None
    semester: Optional[int] = None
    program: Optional[str] = None
    course_name: Optional[str] = None

    # Staff specific fields
    employee_id: Optional[str] = None
    designation: Optional[str] = None

class LoginRequest(BaseModel):
    email: EmailStr
    password: str

class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    user: UserResponse

class RefreshTokenRequest(BaseModel):
    refresh_token: str

class AdminPasswordResetRequest(BaseModel):
    new_password: str = Field(..., min_length=6, description="New password must be at least 6 characters")

class UserUpdateRequest(BaseModel):
    full_name: Optional[str] = None
    phone: Optional[str] = None

class UserListResponse(BaseModel):
    items: List[UserResponse]
    page: int
    page_size: int
    total: int
    total_pages: int
