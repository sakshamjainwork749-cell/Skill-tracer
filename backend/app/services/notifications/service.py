from __future__ import annotations

from app.core.config import get_settings
from app.services.notifications.base import NotificationResult
from app.services.notifications.email import EmailProvider
from app.services.notifications.whatsapp import WhatsAppProvider


def followup_whatsapp_body(first_name: str, followup_url: str) -> str:
    return (
        f"Hi {first_name}, this is SkillTrace.\n\n"
        "We are checking in on your training outcome.\n\n"
        "Are you currently:\n"
        "1. Working\n"
        "2. Self-employed\n"
        "3. Doing an apprenticeship\n"
        "4. Looking for work\n\n"
        "Reply with the option that matches your current situation.\n\n"
        "You can also update your outcome securely here:\n"
        f"{followup_url}"
    )


def followup_email_subject() -> str:
    return "SkillTrace — quick employment outcome update"


def followup_email_body(first_name: str, followup_url: str) -> str:
    return (
        f"Hello {first_name},\n\n"
        "We are checking in on your SkillTrace employment outcome.\n\n"
        "Please update your current status:\n\n"
        f"{followup_url}\n\n"
        "Your response helps measure how training outcomes change over time.\n\n"
        "Thank you,\nSkillTrace"
    )


def send_followup_notifications(*, to_email: str | None, to_phone: str | None,
                                 first_name: str, followup_url: str) -> dict[str, NotificationResult]:
    results: dict[str, NotificationResult] = {}
    if to_email:
        results["EMAIL"] = EmailProvider().send(
            to=to_email, subject=followup_email_subject(),
            body=followup_email_body(first_name, followup_url))
    if to_phone:
        results["WHATSAPP"] = WhatsAppProvider().send(
            to=to_phone, subject="SkillTrace follow-up",
            body=followup_whatsapp_body(first_name, followup_url))
    return results
