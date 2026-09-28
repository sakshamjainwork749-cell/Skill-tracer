from __future__ import annotations

import logging
import smtplib
from email.message import EmailMessage

from app.core.config import get_settings
from app.services.notifications.base import NotificationResult

logger = logging.getLogger(__name__)


class EmailProvider:
    name = "email"

    def send(self, *, to: str, subject: str, body: str) -> NotificationResult:
        settings = get_settings()
        if settings.notification_mode == "disabled":
            return NotificationResult(ok=False, mode="disabled", error="notifications disabled")
        if settings.notification_mode != "real" or not settings.email_enabled:
            print(f"[SkillTrace:Email:simulated] to={to} :: subject={subject} :: {body[:800]}")
            logger.info("Simulated email to %s", to)
            return NotificationResult(ok=True, mode="console", simulated=True,
                                       provider_message_id=f"sim-{abs(hash(to)) % 10**8}")
        # Real mode without a full SMTP config: log + fail gracefully (no crash).
        if not settings.email_from:
            return NotificationResult(ok=False, mode="real", error="EMAIL_FROM not configured")
        try:
            msg = EmailMessage()
            msg["From"] = settings.email_from
            msg["To"] = to
            msg["Subject"] = subject
            msg.set_content(body)
            # NOTE: production deployments should point EMAIL_PROVIDER at an
            # SMTP relay; default localhost keeps local dev dependency-free.
            host = settings.email_provider or "localhost"
            with smtplib.SMTP(host, timeout=20) as smtp:
                smtp.send_message(msg)
            return NotificationResult(ok=True, mode="real", provider_message_id=f"smtp-{to}")
        except Exception as exc:  # noqa: BLE001
            logger.warning("Email send failed: %s", exc)
            return NotificationResult(ok=False, mode="real", error=str(exc)[:300])
