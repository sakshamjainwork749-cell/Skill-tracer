from __future__ import annotations

from collections.abc import Callable
from typing import Annotated
from uuid import UUID

import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.security import decode_access_token
from app.db.session import get_db
from app.models import Employer, Trainee, User
from app.models.enums import UserRole

bearer_scheme = HTTPBearer(auto_error=False)
DbSession = Annotated[Session, Depends(get_db)]


def get_current_user(
    db: DbSession,
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(bearer_scheme)],
) -> User:
    unauthorized = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Invalid or expired authentication token",
        headers={"WWW-Authenticate": "Bearer"},
    )
    if credentials is None or credentials.scheme.casefold() != "bearer":
        raise unauthorized
    try:
        payload = decode_access_token(credentials.credentials)
        if payload.get("type") != "access":
            raise unauthorized
        subject = UUID(str(payload.get("sub")))
    except (jwt.PyJWTError, TypeError, ValueError):
        raise unauthorized from None

    user = db.get(User, subject)
    if user is None or not user.is_active:
        raise unauthorized
    return user


CurrentUser = Annotated[User, Depends(get_current_user)]


def require_roles(*roles: UserRole) -> Callable[[User], User]:
    allowed = set(roles)

    def dependency(current_user: CurrentUser) -> User:
        if current_user.role not in allowed:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You do not have permission to perform this action",
            )
        return current_user

    return dependency


def get_current_trainee(
    current_user: Annotated[User, Depends(require_roles(UserRole.TRAINEE))],
    db: DbSession,
) -> Trainee:
    trainee = db.scalar(select(Trainee).where(Trainee.user_id == current_user.id))
    if trainee is None:
        raise HTTPException(status_code=404, detail="Trainee profile not found")
    return trainee


def get_current_employer(
    current_user: Annotated[User, Depends(require_roles(UserRole.EMPLOYER))],
    db: DbSession,
) -> Employer:
    employer = db.scalar(select(Employer).where(Employer.user_id == current_user.id))
    if employer is None:
        raise HTTPException(status_code=404, detail="Employer profile not found")
    return employer


def get_current_admin(
    current_user: Annotated[User, Depends(require_roles(UserRole.GOVERNMENT_ADMIN))],
) -> User:
    return current_user


CurrentTrainee = Annotated[Trainee, Depends(get_current_trainee)]
CurrentEmployer = Annotated[Employer, Depends(get_current_employer)]
CurrentAdmin = Annotated[User, Depends(get_current_admin)]
