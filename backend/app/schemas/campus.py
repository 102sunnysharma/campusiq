from uuid import UUID
from datetime import datetime
from typing import Optional, List
from decimal import Decimal
from pydantic import BaseModel, Field, ConfigDict

# --- Department Schemas ---
class DepartmentResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    name: str
    code: str
    description: Optional[str] = None
    hod_staff_id: Optional[UUID] = None
    is_active: bool
    created_at: datetime
    updated_at: datetime

class DepartmentCreate(BaseModel):
    name: str = Field(..., min_length=2, max_length=100)
    code: str = Field(..., min_length=2, max_length=20)
    description: Optional[str] = None
    hod_staff_id: Optional[UUID] = None

class DepartmentUpdate(BaseModel):
    name: Optional[str] = None
    code: Optional[str] = None
    description: Optional[str] = None
    hod_staff_id: Optional[UUID] = None

class DepartmentListResponse(BaseModel):
    items: List[DepartmentResponse]
    total: int


# --- Category Schemas ---
class CategoryResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    name: str
    description: Optional[str] = None
    department_id: UUID
    is_active: bool
    created_at: datetime
    updated_at: datetime
    department_name: Optional[str] = None

class CategoryCreate(BaseModel):
    name: str = Field(..., min_length=2, max_length=100)
    description: Optional[str] = None
    department_id: UUID

class CategoryUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    department_id: Optional[UUID] = None

class CategoryListResponse(BaseModel):
    items: List[CategoryResponse]
    total: int


# --- Facility Schemas ---
class FacilityResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    name: str
    type: str
    location: str
    department_id: UUID
    capacity: Optional[int] = None
    is_active: bool
    created_at: datetime
    department_name: Optional[str] = None

class FacilityCreate(BaseModel):
    name: str = Field(..., min_length=2, max_length=100)
    type: str = Field(..., min_length=2, max_length=50)
    location: str = Field(..., min_length=2, max_length=255)
    department_id: UUID
    capacity: Optional[int] = None

class FacilityUpdate(BaseModel):
    name: Optional[str] = None
    type: Optional[str] = None
    location: Optional[str] = None
    department_id: Optional[UUID] = None
    capacity: Optional[int] = None

class FacilityListResponse(BaseModel):
    items: List[FacilityResponse]
    total: int


# --- Transport Schemas ---
class TransportStopResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    route_id: UUID
    name: str
    latitude: Decimal
    longitude: Decimal
    sequence: int

class TransportStopCreate(BaseModel):
    name: str = Field(..., min_length=2, max_length=100)
    latitude: Decimal = Field(..., ge=-90, le=90)
    longitude: Decimal = Field(..., ge=-180, le=180)
    sequence: int = Field(..., ge=1)

class TransportStopUpdate(BaseModel):
    name: Optional[str] = None
    latitude: Optional[Decimal] = None
    longitude: Optional[Decimal] = None
    sequence: Optional[int] = None

class TransportRouteResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    route_name: str
    route_number: str
    description: Optional[str] = None
    is_active: bool
    created_at: datetime
    stops: List[TransportStopResponse] = []

class TransportRouteCreate(BaseModel):
    route_name: str = Field(..., min_length=2, max_length=100)
    route_number: str = Field(..., min_length=2, max_length=50)
    description: Optional[str] = None
    stops: List[TransportStopCreate] = []

class TransportRouteUpdate(BaseModel):
    route_name: Optional[str] = None
    route_number: Optional[str] = None
    description: Optional[str] = None
    is_active: Optional[bool] = None

class TransportRouteListResponse(BaseModel):
    items: List[TransportRouteResponse]
    total: int
