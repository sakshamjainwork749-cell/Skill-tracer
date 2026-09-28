"""Opaque, expiring links for the existing authenticated follow-up workflow."""
from __future__ import annotations

import hashlib
import hmac
import secrets
from datetime import timedelta

from fastapi import HTTPException, status

from app.core.config import get_settings
from app.models import Followup, Trainee
from app.models.base import utc_now
from app.models.enums import FollowupStatus


def issue_followup_link(followup: Followup) -> str:
    """Replace any previous link with a random token and retain only its hash."""
    token = secrets.token_urlsafe(32)
    followup.access_token_hash = hashlib.sha256(token.encode()).hexdigest()
    followup.access_token_expires_at = utc_now() + timedelta(
        hours=get_settings().followup_link_expire_hours
    )
    followup.accessed_at = None
    return token


def secure_followup_url(token: str) -> str:
    return f"{get_settings().frontend_url.rstrip('/')}/followup/{token}"


def validate_followup_token(*, followup: Followup, token: str, trainee: Trainee) -> None:
    """Require both the opaque link and the trainee's normal JWT identity."""
    expected = followup.access_token_hash
    supplied = hashlib.sha256(token.encode()).hexdigest()
    now = utc_now()
    if (
        not expected
        or not hmac.compare_digest(expected, supplied)
        or followup.trainee_id != trainee.id
        or followup.access_token_expires_at is None
        or followup.access_token_expires_at < now
        or followup.status in (FollowupStatus.CANCELLED, FollowupStatus.COMPLETED)
    ):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="This follow-up link is invalid, expired, or not for this account.",
        )
    followup.accessed_at = now
