from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, HTTPException, Request
from sqlalchemy import func, select

from app.api.deps import CurrentUser, DbSession
from app.core.responses import success
from app.models import Notification
from app.schemas.notification import NotificationListResponse, NotificationResponse
from app.services.audit import add_audit_log

router = APIRouter(prefix="/notifications", tags=["Notifications"])


@router.get("", response_model=None)
def list_notifications(current_user: CurrentUser, db: DbSession):
    rows = list(
        db.scalars(
            select(Notification)
            .where(Notification.user_id == current_user.id)
            .order_by(Notification.created_at.desc())
            .limit(50)
        ).all()
    )
    unread = db.scalar(
        select(func.count())
        .select_from(Notification)
        .where(Notification.user_id == current_user.id, Notification.is_read.is_(False))
    ) or 0
    return success(
        NotificationListResponse(
            notifications=[NotificationResponse.model_validate(r, from_attributes=True) for r in rows],
            unread_count=int(unread),
        )
    )


@router.patch("/{notification_id}/read", response_model=None)
def mark_notification_read(
    notification_id: UUID,
    request: Request,
    current_user: CurrentUser,
    db: DbSession,
):
    notification = db.scalar(
        select(Notification).where(
            Notification.id == notification_id,
            Notification.user_id == current_user.id,
        )
    )
    if notification is None:
        raise HTTPException(status_code=404, detail="Notification not found")
    notification.is_read = True
    add_audit_log(
        db,
        actor_id=current_user.id,
        action="NOTIFICATION_READ",
        entity_type="notification",
        entity_id=notification.id,
        ip_address=request.client.host if request.client else None,
    )
    db.commit()
    db.refresh(notification)
    return success(NotificationResponse.model_validate(notification, from_attributes=True))


@router.get("/whatsapp/status", response_model=None)
def whatsapp_status(current_user: CurrentUser, db: DbSession):
    """Trainee WhatsApp state: consent, masked number, next/last follow-up,
    provider readiness. Never exposes tokens or full numbers."""
    from app.models import Followup, Trainee
    from app.services.notifications.whatsapp import WhatsAppProvider
    from app.services.whatsapp_templates import normalize_phone

    trainee = db.scalar(
        select(Trainee).where(Trainee.user_id == current_user.id).limit(1)
    )
    consent = bool(trainee and trainee.whatsapp_followup_consent)
    digits = normalize_phone(
        trainee.user.phone if trainee and trainee.user else None)
    rows = []
    if trainee is not None:
        rows = list(db.scalars(
            select(Followup)
            .where(Followup.trainee_id == trainee.id,
                   ((Followup.channel == "WHATSAPP") | (Followup.template.is_not(None))))
            .order_by(Followup.scheduled_for.asc())
        ).all())
    upcoming = [r for r in rows if r.status.value == "SCHEDULED"]
    sent = [r for r in rows if r.sent_at or r.delivered_at or r.response]
    last = max(sent, key=lambda r: (r.sent_at or r.delivered_at or r.created_at).isoformat()) if sent else None
    status = WhatsAppProvider.provider_status()
    return success({
        "consent": consent,
        "phone_masked": f"+{digits[:2]}******{digits[-2:]}" if digits else None,
        "frequency": "30 · 60 · 90 days",
        "next_followup": min(r.scheduled_for for r in upcoming).isoformat() if upcoming else None,
        "last_message": (
            f"{last.template.replace('_', ' ') if last.template else 'check-in'} — "
            f"{'SIMULATED' if (last.provider_message_id or '').startswith(('sim-', 'mock-')) else last.status.value}"
            if last else None
        ),
        "provider": status["provider"],
    })
