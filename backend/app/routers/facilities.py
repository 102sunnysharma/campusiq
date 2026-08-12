from uuid import UUID
from typing import Optional
from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session, joinedload
from app.database import get_db
from app.models import Facility, Department, User
from app.core.dependencies import get_current_user, require_role
from app.core.exceptions import APIException
from app.schemas.campus import FacilityResponse, FacilityCreate, FacilityUpdate, FacilityListResponse

router = APIRouter(prefix="/facilities", tags=["Facilities"])

@router.get("", response_model=FacilityListResponse)
def list_facilities(
    department_id: Optional[UUID] = Query(default=None, description="Filter by department ID"),
    facility_type: Optional[str] = Query(default=None, description="Filter by facility type (lab/library/auditorium)"),
    include_inactive: bool = Query(default=False, description="Include inactive facilities"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    query = db.query(Facility).options(joinedload(Facility.department))

    if department_id:
        query = query.filter(Facility.department_id == department_id)
    if facility_type:
        query = query.filter(Facility.type.ilike(f"%{facility_type}%"))
    if not include_inactive or current_user.role.name != "admin":
        query = query.filter(Facility.is_active == True)

    facilities = query.order_by(Facility.name.asc()).all()

    items = []
    for fac in facilities:
        res = FacilityResponse.model_validate(fac)
        if fac.department:
            res.department_name = fac.department.name
        items.append(res)

    return FacilityListResponse(items=items, total=len(items))


@router.post("", response_model=FacilityResponse, status_code=status.HTTP_201_CREATED)
def create_facility(
    request: FacilityCreate,
    current_user: User = Depends(require_role(["admin"])),
    db: Session = Depends(get_db)
):
    dept = db.query(Department).filter(Department.id == request.department_id).first()
    if not dept:
        raise APIException(
            status_code=status.HTTP_404_NOT_FOUND,
            code="DEPARTMENT_NOT_FOUND",
            message=f"Department '{request.department_id}' not found."
        )

    facility = Facility(
        name=request.name,
        type=request.type,
        location=request.location,
        department_id=request.department_id,
        capacity=request.capacity,
        is_active=True
    )
    db.add(facility)
    db.commit()
    db.refresh(facility)

    res = FacilityResponse.model_validate(facility)
    res.department_name = dept.name
    return res


@router.put("/{facility_id}", response_model=FacilityResponse)
def update_facility(
    facility_id: UUID,
    request: FacilityUpdate,
    current_user: User = Depends(require_role(["admin"])),
    db: Session = Depends(get_db)
):
    facility = db.query(Facility).options(joinedload(Facility.department)).filter(Facility.id == facility_id).first()
    if not facility:
        raise APIException(
            status_code=status.HTTP_404_NOT_FOUND,
            code="FACILITY_NOT_FOUND",
            message=f"Facility with ID '{facility_id}' not found."
        )

    if request.name is not None:
        facility.name = request.name
    if request.type is not None:
        facility.type = request.type
    if request.location is not None:
        facility.location = request.location
    if request.capacity is not None:
        facility.capacity = request.capacity
    if request.department_id is not None:
        dept = db.query(Department).filter(Department.id == request.department_id).first()
        if not dept:
            raise APIException(status.HTTP_404_NOT_FOUND, "DEPARTMENT_NOT_FOUND", f"Department '{request.department_id}' not found.")
        facility.department_id = request.department_id

    db.commit()
    db.refresh(facility)

    res = FacilityResponse.model_validate(facility)
    if facility.department:
        res.department_name = facility.department.name
    return res
