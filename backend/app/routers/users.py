from uuid import UUID
from math import ceil
from typing import Optional
from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session, joinedload
from app.database import get_db
from app.models import User, Role
from app.core.security import hash_password
from app.core.dependencies import get_current_user, require_role
from app.core.exceptions import APIException
from app.schemas.auth import UserResponse, UserUpdateRequest, AdminPasswordResetRequest, UserListResponse

router = APIRouter(prefix="/users", tags=["Users & RBAC"])

@router.get("/me", response_model=UserResponse)
def get_my_profile(current_user: User = Depends(get_current_user)):
    return UserResponse.model_validate(current_user)


@router.put("/me", response_model=UserResponse)
def update_my_profile(
    request: UserUpdateRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    if request.full_name is not None:
        current_user.full_name = request.full_name
    if request.phone is not None:
        current_user.phone = request.phone

    db.commit()
    db.refresh(current_user)
    return UserResponse.model_validate(current_user)


@router.get("", response_model=UserListResponse)
def list_users(
    page: int = Query(default=1, ge=1, description="Page number"),
    page_size: int = Query(default=20, ge=1, le=100, description="Items per page"),
    role: Optional[str] = Query(default=None, description="Filter by role name (student/staff/hod/admin)"),
    search: Optional[str] = Query(default=None, description="Search by full_name or email"),
    current_user: User = Depends(require_role(["admin"])),
    db: Session = Depends(get_db)
):
    query = (
        db.query(User)
        .options(
            joinedload(User.role),
            joinedload(User.student_profile),
            joinedload(User.staff_profile)
        )
    )

    if role:
        query = query.join(Role).filter(Role.name == role.lower())

    if search:
        search_pattern = f"%{search}%"
        query = query.filter(
            (User.full_name.ilike(search_pattern)) | (User.email.ilike(search_pattern))
        )

    total = query.count()
    total_pages = ceil(total / page_size) if total > 0 else 1

    users = (
        query.order_by(User.created_at.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
        .all()
    )

    items = [UserResponse.model_validate(u) for u in users]

    return UserListResponse(
        items=items,
        page=page,
        page_size=page_size,
        total=total,
        total_pages=total_pages
    )


@router.post("/{user_id}/reset-password")
def admin_reset_password(
    user_id: UUID,
    request: AdminPasswordResetRequest,
    current_user: User = Depends(require_role(["admin"])),
    db: Session = Depends(get_db)
):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise APIException(
            status_code=status.HTTP_404_NOT_FOUND,
            code="USER_NOT_FOUND",
            message=f"User with ID '{user_id}' does not exist."
        )

    user.password_hash = hash_password(request.new_password)
    db.commit()

    return {
        "success": True,
        "message": f"Password for user '{user.email}' has been reset successfully."
    }
