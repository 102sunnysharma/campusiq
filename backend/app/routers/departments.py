from uuid import UUID
from typing import Optional
from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session
from app.database import get_db
from app.models import Department, User
from app.core.dependencies import get_current_user, require_role
from app.core.exceptions import APIException
from app.schemas.campus import DepartmentResponse, DepartmentCreate, DepartmentUpdate, DepartmentListResponse

router = APIRouter(prefix="/departments", tags=["Departments"])

@router.get("", response_model=DepartmentListResponse)
def list_departments(
    include_inactive: bool = Query(default=False, description="Include inactive departments (Admin only)"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    query = db.query(Department)
    if not include_inactive or current_user.role.name != "admin":
        query = query.filter(Department.is_active == True)

    departments = query.order_by(Department.name.asc()).all()
    items = [DepartmentResponse.model_validate(d) for d in departments]
    return DepartmentListResponse(items=items, total=len(items))


@router.get("/{department_id}", response_model=DepartmentResponse)
def get_department(
    department_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    department = db.query(Department).filter(Department.id == department_id).first()
    if not department:
        raise APIException(
            status_code=status.HTTP_404_NOT_FOUND,
            code="DEPARTMENT_NOT_FOUND",
            message=f"Department with ID '{department_id}' not found."
        )
    return DepartmentResponse.model_validate(department)


@router.post("", response_model=DepartmentResponse, status_code=status.HTTP_201_CREATED)
def create_department(
    request: DepartmentCreate,
    current_user: User = Depends(require_role(["admin"])),
    db: Session = Depends(get_db)
):
    # Check code or name uniqueness
    existing = db.query(Department).filter(
        (Department.code == request.code.upper()) | (Department.name == request.name)
    ).first()
    if existing:
        raise APIException(
            status_code=status.HTTP_409_CONFLICT,
            code="DEPARTMENT_ALREADY_EXISTS",
            message=f"Department with code '{request.code}' or name '{request.name}' already exists."
        )

    dept = Department(
        name=request.name,
        code=request.code.upper(),
        description=request.description,
        hod_staff_id=request.hod_staff_id,
        is_active=True
    )
    db.add(dept)
    db.commit()
    db.refresh(dept)
    return DepartmentResponse.model_validate(dept)


@router.put("/{department_id}", response_model=DepartmentResponse)
def update_department(
    department_id: UUID,
    request: DepartmentUpdate,
    current_user: User = Depends(require_role(["admin"])),
    db: Session = Depends(get_db)
):
    dept = db.query(Department).filter(Department.id == department_id).first()
    if not dept:
        raise APIException(
            status_code=status.HTTP_404_NOT_FOUND,
            code="DEPARTMENT_NOT_FOUND",
            message=f"Department with ID '{department_id}' not found."
        )

    if request.name is not None:
        dept.name = request.name
    if request.code is not None:
        dept.code = request.code.upper()
    if request.description is not None:
        dept.description = request.description
    if request.hod_staff_id is not None:
        dept.hod_staff_id = request.hod_staff_id

    db.commit()
    db.refresh(dept)
    return DepartmentResponse.model_validate(dept)


@router.patch("/{department_id}/deactivate", response_model=DepartmentResponse)
def deactivate_department(
    department_id: UUID,
    current_user: User = Depends(require_role(["admin"])),
    db: Session = Depends(get_db)
):
    dept = db.query(Department).filter(Department.id == department_id).first()
    if not dept:
        raise APIException(
            status_code=status.HTTP_404_NOT_FOUND,
            code="DEPARTMENT_NOT_FOUND",
            message=f"Department with ID '{department_id}' not found."
        )

    dept.is_active = False
    db.commit()
    db.refresh(dept)
    return DepartmentResponse.model_validate(dept)


@router.patch("/{department_id}/activate", response_model=DepartmentResponse)
def activate_department(
    department_id: UUID,
    current_user: User = Depends(require_role(["admin"])),
    db: Session = Depends(get_db)
):
    dept = db.query(Department).filter(Department.id == department_id).first()
    if not dept:
        raise APIException(
            status_code=status.HTTP_404_NOT_FOUND,
            code="DEPARTMENT_NOT_FOUND",
            message=f"Department with ID '{department_id}' not found."
        )

    dept.is_active = True
    db.commit()
    db.refresh(dept)
    return DepartmentResponse.model_validate(dept)
