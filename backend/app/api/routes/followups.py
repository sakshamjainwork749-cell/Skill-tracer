from __future__ import annotations

from typing import Literal

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field

from app.api.deps import CurrentAdmin, DbSession
from app.core.responses import success
from app.services.audit import add_audit_log
from app.services.followup_scheduler import process_due_followups
from app.services.notifications.email import EmailProvider
from app.services.notifications.whatsapp import WhatsAppProvider

router = APIRouter(prefix="/followups", tags=["Followups"])


class FollowupTestRequest(BaseModel):
    channel: Literal["EMAIL", "WHATSAPP"] = "EMAIL"
    to: str = Field(min_length=3, max_length=320)


@router.post("/test", response_model=None)
def test_notification(payload: FollowupTestRequest, request: Request,
                       admin: CurrentAdmin, db: DbSession):
    """Admin-only: test email/WhatsApp/console delivery without a real follow-up."""
    provider = EmailProvider() if payload.channel == "EMAIL" else WhatsAppProvider()
    result = provider.send(to=payload.to, subject="SkillTrace test notification",
                           body="This is a SkillTrace delivery test. No action needed.")
    add_audit_log(db, actor_id=admin.id, action="NOTIFICATION_TEST",
                  entity_type="followup", entity_id=None,
                  details={"channel": payload.channel, "mode": result.mode,
                           "ok": result.ok},
                  ip_address=request.client.host if request.client else None)
    db.commit()
    if not result.ok and result.mode == "real":
        raise HTTPException(status_code=502, detail=result.error or "Delivery failed")
    return success({"success": result.ok, "channel": payload.channel,
                    "mode": result.mode,
                    "message": f"Test {payload.channel} handled in {result.mode} mode"
                               + (" (simulated)" if result.simulated else ""),
                    "provider_message_id": result.provider_message_id})


@router.post("/process-due", response_model=None)
def process_due(admin: CurrentAdmin, db: DbSession):
    """Admin-only: trigger one scheduler pass (useful for demos/tests)."""
    summary = process_due_followups(db)
    return success(summary)
