from typing import List, Callable
from fastapi import Depends, status, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session, joinedload
from app.database import get_db
from app.models import User
from app.core.security import decode_token
from app.core.exceptions import APIException

security_scheme = HTTPBearer(auto_error=False)

def get_current_user(
    auth: HTTPAuthorizationCredentials = Depends(security_scheme),
    db: Session = Depends(get_db)
) -> User:
    if not auth or not auth.credentials:
        raise APIException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            code="UNAUTHORIZED",
            message="Authentication credentials were not provided."
        )

    token = auth.credentials
    try:
        payload = decode_token(token)
    except ValueError as e:
        raise APIException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            code="INVALID_TOKEN",
            message=str(e)
        )

    token_type = payload.get("type")
    if token_type != "access":
        raise APIException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            code="INVALID_TOKEN_TYPE",
            message="Expected access token, but received different token type."
        )

    user_id = payload.get("sub")
    if not user_id:
        raise APIException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            code="INVALID_TOKEN_PAYLOAD",
            message="Token payload is missing user identification."
        )

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

    if not user:
        raise APIException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            code="USER_NOT_FOUND",
            message="User associated with this token no longer exists."
        )

    if not user.is_active:
        raise APIException(
            status_code=status.HTTP_403_FORBIDDEN,
            code="ACCOUNT_DISABLED",
            message="User account has been disabled."
        )

    return user

def require_role(allowed_roles: List[str]) -> Callable:
    def role_checker(current_user: User = Depends(get_current_user)) -> User:
        if current_user.role.name not in allowed_roles:
            raise APIException(
                status_code=status.HTTP_403_FORBIDDEN,
                code="PERMISSION_DENIED",
                message=f"Access forbidden for role '{current_user.role.name}'. Allowed roles: {', '.join(allowed_roles)}"
            )
        return current_user
    return role_checker
