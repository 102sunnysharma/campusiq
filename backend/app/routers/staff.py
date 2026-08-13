from uuid import UUID
from math import ceil
from typing import Optional
from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session, joinedload
from app.database import get_db
from app.models import Staff, User, Department
from app.core.dependencies import get_current_user, require_role
from app.core.exceptions import APIException
from app.schemas.profile import StaffDetailResponse, StaffProfileUpdate, StaffListResponse

router = APIRouter(prefix="/staff", tags=["Staff Profile Management"])

def build_staff_response(staff: Staff) -> StaffDetailResponse:
    res = StaffDetailResponse.model_validate(staff)
    if staff.department:
        res.department_name = staff.department.name
        res.department_code = staff.department.code
    return res

@router.get("/me", response_model=StaffDetailResponse)
def get_my_staff_profile(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    if current_user.role.name not in ["staff", "hod"]:
        raise APIException(
            status_code=status.HTTP_400_BAD_REQUEST,
            code="NOT_STAFF",
            message="Logged in user is not a staff or HOD member."
        )

    staff = (
        db.query(Staff)
        .options(joinedload(Staff.user), joinedload(Staff.department))
        .filter(Staff.user_id == current_user.id)
        .first()
    )

    if not staff:
        raise APIException(
            status_code=status.HTTP_404_NOT_FOUND,
            code="STAFF_PROFILE_NOT_FOUND",
            message="Staff profile record does not exist."
        )

    return build_staff_response(staff)


@router.put("/me", response_model=StaffDetailResponse)
def update_my_staff_profile(
    request: StaffProfileUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    if current_user.role.name not in ["staff", "hod"]:
        raise APIException(
            status_code=status.HTTP_400_BAD_REQUEST,
            code="NOT_STAFF",
            message="Logged in user is not a staff member."
        )

    staff = (
        db.query(Staff)
        .options(joinedload(Staff.user), joinedload(Staff.department))
        .filter(Staff.user_id == current_user.id)
        .first()
    )

    if not staff:
        raise APIException(
            status_code=status.HTTP_404_NOT_FOUND,
            code="STAFF_PROFILE_NOT_FOUND",
            message="Staff profile record does not exist."
        )

    if request.full_name is not None:
        current_user.full_name = request.full_name
    if request.phone is not None:
        current_user.phone = request.phone
    if request.designation is not None:
        staff.designation = request.designation

    db.commit()
    db.refresh(staff)
    return build_staff_response(staff)


@router.get("", response_model=StaffListResponse)
def list_staff(
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    department_id: Optional[UUID] = Query(default=None),
    search: Optional[str] = Query(default=None),
    current_user: User = Depends(require_role(["admin", "hod", "staff"])),
    db: Session = Depends(get_db)
):
    query = (
        db.query(Staff)
        .join(User)
        .options(joinedload(Staff.user), joinedload(Staff.department))
    )

    if current_user.role.name == "hod" and current_user.staff_profile:
        query = query.filter(Staff.department_id == current_user.staff_profile.department_id)
    elif department_id:
        query = query.filter(Staff.department_id == department_id)

    if search:
        search_pattern = f"%{search}%"
        query = query.filter(
            (User.full_name.ilike(search_pattern)) |
            (User.email.ilike(search_pattern)) |
            (Staff.employee_id.ilike(search_pattern))
        )

    total = query.count()
    total_pages = ceil(total / page_size) if total > 0 else 1

    staff_members = (
        query.order_by(Staff.created_at.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
        .all()
    )

    items = [build_staff_response(s) for s in staff_members]

    return StaffListResponse(
        items=items,
        page=page,
        page_size=page_size,
        total=total,
        total_pages=total_pages
    )


@router.get("/{staff_id}", response_model=StaffDetailResponse)
def get_staff_by_id(
    staff_id: UUID,
    current_user: User = Depends(require_role(["admin", "hod"])),
    db: Session = Depends(get_db)
):
    staff = (
        db.query(Staff)
        .options(joinedload(Staff.user), joinedload(Staff.department))
        .filter(Staff.id == staff_id)
        .first()
    )

    if not staff:
        raise APIException(
            status_code=status.HTTP_404_NOT_FOUND,
            code="STAFF_NOT_FOUND",
            message=f"Staff record with ID '{staff_id}' not found."
        )

    return build_staff_response(staff)


@router.put("/{staff_id}", response_model=StaffDetailResponse)
def admin_update_staff(
    staff_id: UUID,
    request: StaffProfileUpdate,
    current_user: User = Depends(require_role(["admin"])),
    db: Session = Depends(get_db)
):
    staff = (
        db.query(Staff)
        .options(joinedload(Staff.user), joinedload(Staff.department))
        .filter(Staff.id == staff_id)
        .first()
    )

    if not staff:
        raise APIException(
            status_code=status.HTTP_404_NOT_FOUND,
            code="STAFF_NOT_FOUND",
            message=f"Staff record with ID '{staff_id}' not found."
        )

    if request.full_name is not None:
        staff.user.full_name = request.full_name
    if request.phone is not None:
        staff.user.phone = request.phone

    if request.employee_id is not None:
        staff.employee_id = request.employee_id
    if request.designation is not None:
        staff.designation = request.designation
    if request.department_id is not None:
        dept = db.query(Department).filter(Department.id == request.department_id).first()
        if not dept:
            raise APIException(status.HTTP_404_NOT_FOUND, "DEPARTMENT_NOT_FOUND", f"Department '{request.department_id}' not found.")
        staff.department_id = request.department_id

    db.commit()
    db.refresh(staff)
    return build_staff_response(staff)
