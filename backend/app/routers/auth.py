from datetime import datetime, timezone
from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session, joinedload
from app.database import get_db
from app.models import User, Role, Student, Staff, Department
from app.core.security import hash_password, verify_password, create_access_token, create_refresh_token, decode_token
from app.core.exceptions import APIException
from app.schemas.auth import RegisterRequest, LoginRequest, TokenResponse, RefreshTokenRequest, UserResponse

router = APIRouter(prefix="/auth", tags=["Authentication"])

@router.post("/register", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
def register(request: RegisterRequest, db: Session = Depends(get_db)):
    # 1. Check if user already exists
    existing_user = db.query(User).filter(User.email == request.email.lower()).first()
    if existing_user:
        raise APIException(
            status_code=status.HTTP_409_CONFLICT,
            code="EMAIL_ALREADY_REGISTERED",
            message="An account with this email address already exists."
        )

    # 2. Validate role
    role = db.query(Role).filter(Role.name == request.role_name.lower()).first()
    if not role:
        raise APIException(
            status_code=status.HTTP_400_BAD_REQUEST,
            code="INVALID_ROLE",
            message=f"Role '{request.role_name}' is invalid. Allowed roles: student, staff, hod, admin."
        )

    # 3. Create User
    hashed_pwd = hash_password(request.password)
    user = User(
        email=request.email.lower(),
        password_hash=hashed_pwd,
        full_name=request.full_name,
        phone=request.phone,
        role_id=role.id,
        is_active=True,
        is_verified=True,
        last_login_at=datetime.now(timezone.utc)
    )
    db.add(user)
    db.flush()

    # 4. Create Student or Staff profile if applicable
    if role.name == "student":
        # Check if department_id is provided or get default
        dept_id = request.department_id
        if not dept_id:
            default_dept = db.query(Department).first()
            if not default_dept:
                raise APIException(status.HTTP_500_INTERNAL_SERVER_ERROR, "NO_DEPARTMENT", "No department available in database.")
            dept_id = default_dept.id

        student_id_str = request.student_id or f"STU-{user.id.hex[:8].upper()}"
        # Check uniqueness of student_id
        existing_student = db.query(Student).filter(Student.student_id == student_id_str).first()
        if existing_student:
            student_id_str = f"STU-{user.id.hex[:8].upper()}"

        student_profile = Student(
            user_id=user.id,
            student_id=student_id_str,
            roll_number=request.roll_number or f"ROLL-{user.id.hex[:6].upper()}",
            department_id=dept_id,
            semester=request.semester or 1,
            program=request.program or "B.Tech",
            course_name=request.course_name or "Computer Science Engineering"
        )
        db.add(student_profile)

    elif role.name in ["staff", "hod"]:
        dept_id = request.department_id
        if not dept_id:
            default_dept = db.query(Department).first()
            if not default_dept:
                raise APIException(status.HTTP_500_INTERNAL_SERVER_ERROR, "NO_DEPARTMENT", "No department available in database.")
            dept_id = default_dept.id

        emp_id_str = request.employee_id or f"EMP-{user.id.hex[:8].upper()}"
        existing_staff = db.query(Staff).filter(Staff.employee_id == emp_id_str).first()
        if existing_staff:
            emp_id_str = f"EMP-{user.id.hex[:8].upper()}"

        staff_profile = Staff(
            user_id=user.id,
            employee_id=emp_id_str,
            department_id=dept_id,
            designation=request.designation or ("Head of Department" if role.name == "hod" else "Assistant Professor")
        )
        db.add(staff_profile)

    db.commit()
    db.refresh(user)

    # Re-fetch user with relationships loaded
    full_user = (
        db.query(User)
        .options(
            joinedload(User.role),
            joinedload(User.student_profile),
            joinedload(User.staff_profile)
        )
        .filter(User.id == user.id)
        .first()
    )

    token_data = {"sub": str(user.id), "email": user.email, "role": role.name}
    access_token = create_access_token(token_data)
    refresh_token = create_refresh_token(token_data)

    return TokenResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        token_type="bearer",
        user=UserResponse.model_validate(full_user)
    )


@router.post("/login", response_model=TokenResponse)
def login(request: LoginRequest, db: Session = Depends(get_db)):
    user = (
        db.query(User)
        .options(
            joinedload(User.role),
            joinedload(User.student_profile),
            joinedload(User.staff_profile)
        )
        .filter(User.email == request.email.lower())
        .first()
    )

    if not user or not verify_password(request.password, user.password_hash):
        raise APIException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            code="INVALID_CREDENTIALS",
            message="Invalid email address or password."
        )

    if not user.is_active:
        raise APIException(
            status_code=status.HTTP_403_FORBIDDEN,
            code="ACCOUNT_DISABLED",
            message="Your account has been disabled. Please contact system administrator."
        )

    # Update last_login_at timestamp
    user.last_login_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(user)

    token_data = {"sub": str(user.id), "email": user.email, "role": user.role.name}
    access_token = create_access_token(token_data)
    refresh_token = create_refresh_token(token_data)

    return TokenResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        token_type="bearer",
        user=UserResponse.model_validate(user)
    )


@router.post("/refresh", response_model=TokenResponse)
def refresh_token_endpoint(request: RefreshTokenRequest, db: Session = Depends(get_db)):
    try:
        payload = decode_token(request.refresh_token)
    except ValueError as e:
        raise APIException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            code="INVALID_REFRESH_TOKEN",
            message=f"Invalid refresh token: {str(e)}"
        )

    if payload.get("type") != "refresh":
        raise APIException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            code="INVALID_TOKEN_TYPE",
            message="Provided token is not a refresh token."
        )

    user_id = payload.get("sub")
    user = (
        db.query(User)
        .options(
            joinedload(User.role),
            joinedload(User.student_profile),
            joinedload(User.staff_profile)
        )
        .filter(User.id == user_id)
        .first()
    )

    if not user or not user.is_active:
        raise APIException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            code="USER_INACTIVE",
            message="User account is inactive or no longer exists."
        )

    token_data = {"sub": str(user.id), "email": user.email, "role": user.role.name}
    new_access_token = create_access_token(token_data)
    new_refresh_token = create_refresh_token(token_data)

    return TokenResponse(
        access_token=new_access_token,
        refresh_token=new_refresh_token,
        token_type="bearer",
        user=UserResponse.model_validate(user)
    )


@router.post("/logout")
def logout():
    return {
        "success": True,
        "message": "Successfully logged out."
    }
