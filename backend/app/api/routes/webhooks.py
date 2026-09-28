from __future__ import annotations

"""Inbound WhatsApp webhook interface (provider-ready, demo-safe).

A real provider (Meta/Twilio) can POST delivery replies here. Requests are
gated by a shared webhook secret that never leaves the server. Replies are
normalised through the response vocabulary and recorded on the trainee's
latest open follow-up; unknown senders/texts are logged, never applied.
"""

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, ConfigDict
from sqlalchemy import select

from app.api.deps import DbSession
from app.core.config import get_settings
from app.models import Followup, Trainee, User
from app.models.base import utc_now
from app.models.enums import FollowupStatus
from app.core.responses import success
from app.services.audit import add_audit_log
from app.services.whatsapp_templates import normalize_phone, parse_response

router = APIRouter(prefix="/webhooks", tags=["Webhooks"])


class WhatsAppInbound(BaseModel):
    model_config = ConfigDict(extra="ignore")

    sender: str
    text: str | None = None
    provider_message_id: str | None = None


def _check_secret(request: Request) -> None:
    settings = get_settings()
    if not settings.whatsapp_webhook_secret:
        raise HTTPException(status_code=403, detail="WhatsApp webhook is not configured")
    provided = request.headers.get("x-webhook-secret", "")
    if provided != settings.whatsapp_webhook_secret:
        raise HTTPException(status_code=403, detail="Invalid webhook secret")


@router.post("/whatsapp", response_model=None)
def whatsapp_inbound(payload: WhatsAppInbound, request: Request, db: DbSession):
    _check_secret(request)
    digits = normalize_phone(payload.sender)
    if digits is None:
        raise HTTPException(status_code=422, detail="Unusable sender number")
    code = parse_response(payload.text)
    if code is None:
        add_audit_log(db, actor_id=None, action="WHATSAPP_UNMATCHED_REPLY",
                      entity_type="followup", entity_id=None,
                      details={"sender_suffix": digits[-4:]})
        db.commit()
        return success({"recorded": False, "reason": "unrecognised reply"})
    # Suffix-match the sender against stored phone numbers (numbers may carry
    # different country-code prefixes across providers).
    match: Trainee | None = None
    candidates = db.scalars(select(Trainee).join(User, Trainee.user_id == User.id)).all()
    for candidate in candidates:
        stored = normalize_phone(candidate.user.phone if candidate.user else None)
        if stored and (stored.endswith(digits[-10:]) or digits.endswith(stored[-10:])):
            match = candidate
            break
    if match is None:
        raise HTTPException(status_code=404, detail="No trainee found for sender")
    followup = db.scalar(
        select(Followup)
        .where(Followup.trainee_id == match.id,
               Followup.status.in_((FollowupStatus.SENT, FollowupStatus.DELIVERED,
                                    FollowupStatus.SCHEDULED)))
        .order_by(Followup.scheduled_for.desc())
        .limit(1)
    )
    if followup is None:
        return success({"recorded": False, "reason": "no open follow-up"})
    followup.response = code
    followup.responded_at = utc_now()
    followup.status = FollowupStatus.RESPONDED
    add_audit_log(db, actor_id=match.user_id, action="WHATSAPP_RESPONSE",
                  entity_type="followup", entity_id=followup.id,
                  details={"response": code})
    db.commit()
    return success({"recorded": True, "response": code})


class DeliveryUpdate(BaseModel):
    model_config = ConfigDict(extra="ignore")

    provider_message_id: str
    status: str  # SENT | DELIVERED | READ | FAILED
    error: str | None = None


@router.post("/whatsapp/status", response_model=None)
def whatsapp_delivery(payload: DeliveryUpdate, request: Request, db: DbSession):
    """Provider delivery receipts: SENT -> DELIVERED -> READ (or FAILED).
    Updates the message job + linked follow-up, notifies the trainee on
    terminal states."""
    from app.models import MessageJob
    from app.models.enums import MessageStatus
    from app.services.notifications.store import notify as create_notification

    _check_secret(request)
    job = db.scalar(
        select(MessageJob).where(
            MessageJob.provider_message_id == payload.provider_message_id).limit(1)
    )
    if job is None:
        raise HTTPException(status_code=404, detail="Unknown message")
    wanted = payload.status.strip().upper()
    if wanted not in ("SENT", "DELIVERED", "READ", "FAILED"):
        raise HTTPException(status_code=422, detail="Unsupported status")
    job.status = MessageStatus[wanted]
    if wanted == "DELIVERED":
        job.delivered_at = utc_now()
    elif wanted == "READ":
        job.read_at = utc_now()
        job.delivered_at = job.delivered_at or utc_now()
    elif wanted == "FAILED":
        job.last_error = (payload.error or "provider reported failure")[:500]
    if job.trainee_id is not None:
        trainee_user = db.scalar(
            select(Trainee.user_id).where(Trainee.id == job.trainee_id).limit(1))
        if trainee_user is not None and wanted in ("DELIVERED", "FAILED"):
            create_notification(
                db, trainee_user,
                "followup",
                "Follow-up message delivered" if wanted == "DELIVERED"
                else "Follow-up message failed",
                "Your employment follow-up message was delivered."
                if wanted == "DELIVERED"
                else "A scheduled follow-up message could not be delivered. "
                     "Your record is unchanged.")
    db.commit()
    return success({"updated": True, "status": job.status.value})
