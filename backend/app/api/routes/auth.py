from __future__ import annotations

from fastapi import APIRouter, HTTPException, Request, status
from sqlalchemy import select

from app.api.deps import CurrentUser, DbSession
from app.core.responses import success
from app.core.security import create_access_token, verify_password
from app.models import User
from app.models.base import utc_now
from app.schemas.auth import LoginRequest, TokenResponse, UserResponse
from app.services.audit import add_audit_log

router = APIRouter(prefix="/auth", tags=["Authentication"])


@router.post(
    "/login",
    response_model=None,
    description=(
        "JSON login for the prototype. Demo accounts: "
        "trainee@skilltrace.in / Demo@123, "
        "employer@skilltrace.in / Demo@123, "
        "admin@skilltrace.in / Demo@123."
    ),
)
def login(payload: LoginRequest, request: Request, db: DbSession):
    email = payload.email.lower().strip()
    user = db.scalar(select(User).where(User.email == email))
    if (
        user is None
        or not user.is_active
        or not verify_password(payload.password, user.hashed_password)
    ):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    token, expires_at = create_access_token(str(user.id), user.role.value)
    user.last_login_at = utc_now()
    add_audit_log(
        db,
        actor_id=user.id,
        action="AUTH_LOGIN",
        entity_type="user",
        entity_id=user.id,
        ip_address=request.client.host if request.client else None,
    )
    db.commit()
    data = TokenResponse(
        access_token=token,
        token_type="bearer",
        user=UserResponse.model_validate(user),
        expires_at=expires_at,
    )
    return success(data)


@router.get("/me", response_model=None)
def me(current_user: CurrentUser):
    return success(UserResponse.model_validate(current_user))
