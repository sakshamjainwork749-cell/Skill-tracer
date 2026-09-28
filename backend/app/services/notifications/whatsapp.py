from __future__ import annotations

import logging
import urllib.parse
import urllib.request

from app.core.config import get_settings
from app.services.notifications.base import NotificationResult

logger = logging.getLogger(__name__)


class WhatsAppProvider:
    name = "whatsapp"

    @staticmethod
    def provider_status() -> dict[str, str]:
        """Describe readiness without leaking secrets. DEMO unless fully configured."""
        settings = get_settings()
        if settings.notification_mode == "disabled":
            return {"provider": "disabled", "mode": "disabled"}
        if settings.notification_mode == "real" and settings.whatsapp_provider == "meta" and settings.whatsapp_access_token \
                and settings.whatsapp_phone_number_id:
            return {"provider": "meta", "mode": settings.notification_mode}
        if settings.notification_mode == "real" and settings.whatsapp_enabled \
                and settings.twilio_account_sid and settings.twilio_auth_token \
                and settings.twilio_whatsapp_from:
            return {"provider": "twilio", "mode": "real"}
        return {"provider": "demo", "mode": "console"}

    @staticmethod
    def _send_meta(*, to: str, body: str) -> NotificationResult:
        """Meta WhatsApp Cloud API delivery. Credentials stay server-side."""
        import json as jsonlib

        settings = get_settings()
        base = (settings.whatsapp_api_url or "https://graph.facebook.com/v21.0").rstrip("/")
        url = f"{base}/{settings.whatsapp_phone_number_id}/messages"
        digits = "".join(ch for ch in to if ch.isdigit())
        payload = {"messaging_product": "whatsapp", "to": digits}
        if settings.whatsapp_template_name:
            # The approved template must have one body variable containing the
            # already privacy-minimised message and its opaque follow-up URL.
            payload.update({
                "type": "template",
                "template": {
                    "name": settings.whatsapp_template_name,
                    "language": {"code": settings.whatsapp_template_language},
                    "components": [{"type": "body", "parameters": [
                        {"type": "text", "text": body}
                    ]}],
                },
            })
        else:
            payload.update({"type": "text", "text": {"body": body}})
        try:
            req = urllib.request.Request(
                url,
                data=jsonlib.dumps(payload).encode(),
                headers={
                    "Authorization": f"Bearer {settings.whatsapp_access_token}",
                    "Content-Type": "application/json",
                },
            )
            with urllib.request.urlopen(req, timeout=20) as resp:
                message_id = jsonlib.loads(resp.read().decode())["messages"][0]["id"]
            return NotificationResult(ok=True, mode="real", provider_message_id=message_id)
        except Exception as exc:  # noqa: BLE001 - surface as delivery failure
            logger.warning("Meta WhatsApp send failed: %s", exc)
            return NotificationResult(ok=False, mode="real", error=str(exc)[:300])

    def send(self, *, to: str, subject: str, body: str) -> NotificationResult:
        settings = get_settings()
        if settings.notification_mode == "disabled":
            return NotificationResult(ok=False, mode="disabled", error="notifications disabled")
        if settings.notification_mode == "real" and settings.whatsapp_provider == "meta" and settings.whatsapp_access_token \
                and settings.whatsapp_phone_number_id:
            return self._send_meta(to=to, body=body)
        if settings.notification_mode != "real" or not settings.whatsapp_enabled:
            reason = "whatsapp not configured" if settings.notification_mode == "real" else "console mode"
            print(f"[SkillTrace:WhatsApp:simulated] to={to} :: {subject} :: {body[:500]}")
            logger.info("Simulated WhatsApp to %s (%s)", to, reason)
            return NotificationResult(ok=True, mode="console", simulated=True,
                                       provider_message_id=f"sim-{abs(hash(to)) % 10**8}")
        if not (settings.twilio_account_sid and settings.twilio_auth_token and settings.twilio_whatsapp_from):
            return NotificationResult(ok=False, mode="real", error="Twilio credentials missing")
        try:
            import base64

            url = (f"https://api.twilio.com/2010-04-01/Accounts/"
                   f"{settings.twilio_account_sid}/Messages.json")
            payload = {
                "From": settings.twilio_whatsapp_from,
                "To": to if to.startswith("whatsapp:") else f"whatsapp:{to}",
                "Body": f"{subject}\n\n{body}" if subject else body,
            }
            if settings.twilio_template_sid:
                payload["ContentSid"] = settings.twilio_template_sid
            data = urllib.parse.urlencode(payload).encode()
            credentials = base64.b64encode(
                f"{settings.twilio_account_sid}:{settings.twilio_auth_token}".encode()
            ).decode()
            req = urllib.request.Request(url, data=data,
                                         headers={"Authorization": f"Basic {credentials}"})
            with urllib.request.urlopen(req, timeout=20) as resp:
                import json

                sid = json.loads(resp.read().decode()).get("sid")
            return NotificationResult(ok=True, mode="real", provider_message_id=sid)
        except Exception as exc:  # noqa: BLE001 - surface as delivery failure
            logger.warning("WhatsApp send failed: %s", exc)
            return NotificationResult(ok=False, mode="real", error=str(exc)[:300])
