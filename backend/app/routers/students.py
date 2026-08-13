from uuid import UUID
from math import ceil
from typing import Optional
from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session, joinedload
from app.database import get_db
from app.models import Student, User, Department
from app.core.dependencies import get_current_user, require_role
from app.core.exceptions import APIException
from app.schemas.profile import StudentDetailResponse, StudentProfileUpdate, StudentListResponse

router = APIRouter(prefix="/students", tags=["Students Profile Management"])

def build_student_response(student: Student) -> StudentDetailResponse:
    res = StudentDetailResponse.model_validate(student)
    if student.department:
        res.department_name = student.department.name
        res.department_code = student.department.code
    return res

@router.get("/me", response_model=StudentDetailResponse)
def get_my_student_profile(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    if current_user.role.name != "student":
        raise APIException(
            status_code=status.HTTP_400_BAD_REQUEST,
            code="NOT_A_STUDENT",
            message="Logged in user is not a student."
        )

    student = (
        db.query(Student)
        .options(
            joinedload(Student.user),
            joinedload(Student.department)
        )
        .filter(Student.user_id == current_user.id)
        .first()
    )

    if not student:
        raise APIException(
            status_code=status.HTTP_404_NOT_FOUND,
            code="STUDENT_PROFILE_NOT_FOUND",
            message="Student profile record does not exist."
        )

    return build_student_response(student)


@router.put("/me", response_model=StudentDetailResponse)
def update_my_student_profile(
    request: StudentProfileUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    if current_user.role.name != "student":
        raise APIException(
            status_code=status.HTTP_400_BAD_REQUEST,
            code="NOT_A_STUDENT",
            message="Logged in user is not a student."
        )

    student = (
        db.query(Student)
        .options(joinedload(Student.user), joinedload(Student.department))
        .filter(Student.user_id == current_user.id)
        .first()
    )

    if not student:
        raise APIException(
            status_code=status.HTTP_404_NOT_FOUND,
            code="STUDENT_PROFILE_NOT_FOUND",
            message="Student profile record does not exist."
        )

    # Update User level fields if provided
    if request.full_name is not None:
        current_user.full_name = request.full_name
    if request.phone is not None:
        current_user.phone = request.phone

    # Update Student level fields if provided
    if request.roll_number is not None:
        student.roll_number = request.roll_number
    if request.semester is not None:
        student.semester = request.semester
    if request.program is not None:
        student.program = request.program
    if request.course_name is not None:
        student.course_name = request.course_name
    if request.room_number is not None:
        student.room_number = request.room_number

    db.commit()
    db.refresh(student)
    return build_student_response(student)


@router.get("", response_model=StudentListResponse)
def list_students(
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    department_id: Optional[UUID] = Query(default=None),
    program: Optional[str] = Query(default=None),
    search: Optional[str] = Query(default=None),
    current_user: User = Depends(require_role(["admin", "hod", "staff"])),
    db: Session = Depends(get_db)
):
    query = (
        db.query(Student)
        .join(User)
        .options(
            joinedload(Student.user),
            joinedload(Student.department)
        )
    )

    # HOD scoping: if user is HOD, default to their department if not specified
    if current_user.role.name == "hod" and current_user.staff_profile:
        query = query.filter(Student.department_id == current_user.staff_profile.department_id)
    elif department_id:
        query = query.filter(Student.department_id == department_id)

    if program:
        query = query.filter(Student.program.ilike(f"%{program}%"))

    if search:
        search_pattern = f"%{search}%"
        query = query.filter(
            (User.full_name.ilike(search_pattern)) |
            (User.email.ilike(search_pattern)) |
            (Student.student_id.ilike(search_pattern)) |
            (Student.roll_number.ilike(search_pattern))
        )

    total = query.count()
    total_pages = ceil(total / page_size) if total > 0 else 1

    students = (
        query.order_by(Student.created_at.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
        .all()
    )

    items = [build_student_response(s) for s in students]

    return StudentListResponse(
        items=items,
        page=page,
        page_size=page_size,
        total=total,
        total_pages=total_pages
    )


@router.get("/{student_id}", response_model=StudentDetailResponse)
def get_student_by_id(
    student_id: UUID,
    current_user: User = Depends(require_role(["admin", "hod", "staff"])),
    db: Session = Depends(get_db)
):
    student = (
        db.query(Student)
        .options(joinedload(Student.user), joinedload(Student.department))
        .filter(Student.id == student_id)
        .first()
    )

    if not student:
        raise APIException(
            status_code=status.HTTP_404_NOT_FOUND,
            code="STUDENT_NOT_FOUND",
            message=f"Student record with ID '{student_id}' not found."
        )

    return build_student_response(student)


@router.put("/{student_id}", response_model=StudentDetailResponse)
def admin_update_student(
    student_id: UUID,
    request: StudentProfileUpdate,
    current_user: User = Depends(require_role(["admin"])),
    db: Session = Depends(get_db)
):
    student = (
        db.query(Student)
        .options(joinedload(Student.user), joinedload(Student.department))
        .filter(Student.id == student_id)
        .first()
    )

    if not student:
        raise APIException(
            status_code=status.HTTP_404_NOT_FOUND,
            code="STUDENT_NOT_FOUND",
            message=f"Student record with ID '{student_id}' not found."
        )

    if request.full_name is not None:
        student.user.full_name = request.full_name
    if request.phone is not None:
        student.user.phone = request.phone

    if request.roll_number is not None:
        student.roll_number = request.roll_number
    if request.department_id is not None:
        dept = db.query(Department).filter(Department.id == request.department_id).first()
        if not dept:
            raise APIException(status.HTTP_404_NOT_FOUND, "DEPARTMENT_NOT_FOUND", f"Department '{request.department_id}' not found.")
        student.department_id = request.department_id
    if request.semester is not None:
        student.semester = request.semester
    if request.program is not None:
        student.program = request.program
    if request.course_name is not None:
        student.course_name = request.course_name

    db.commit()
    db.refresh(student)
    return build_student_response(student)
