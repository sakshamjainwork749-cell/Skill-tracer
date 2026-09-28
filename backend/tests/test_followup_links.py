from datetime import timedelta
from uuid import uuid4

import pytest
from fastapi import HTTPException

from app.models import Followup, Trainee
from app.models.base import utc_now
from app.services.followup_links import (
    issue_followup_link,
    secure_followup_url,
    validate_followup_token,
)


def test_followup_link_is_opaque_and_requires_the_matching_trainee():
    trainee = Trainee(id=uuid4(), user_id=uuid4(), internal_identifier="LINK-TEST", district="Pune")
    followup = Followup(trainee_id=trainee.id, scheduled_for=utc_now().date())

    token = issue_followup_link(followup)

    assert token not in (followup.access_token_hash or "")
    assert secure_followup_url(token).endswith(f"/followup/{token}")
    validate_followup_token(followup=followup, token=token, trainee=trainee)
    assert followup.accessed_at is not None

    other = Trainee(id=uuid4(), user_id=uuid4(), internal_identifier="LINK-OTHER", district="Pune")
    with pytest.raises(HTTPException, match="invalid, expired, or not for this account"):
        validate_followup_token(followup=followup, token=token, trainee=other)


def test_followup_link_rejects_expired_or_changed_tokens():
    trainee = Trainee(id=uuid4(), user_id=uuid4(), internal_identifier="LINK-EXPIRED", district="Pune")
    followup = Followup(trainee_id=trainee.id, scheduled_for=utc_now().date())
    token = issue_followup_link(followup)
    followup.access_token_expires_at = utc_now() - timedelta(seconds=1)

    with pytest.raises(HTTPException):
        validate_followup_token(followup=followup, token=token, trainee=trainee)
