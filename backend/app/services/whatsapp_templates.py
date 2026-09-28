from __future__ import annotations

"""Consent-based WhatsApp follow-up message templates (30/60/90-day).

Templates are rendered server-side with the trainee's first name only.
No message is ever sent unless the trainee opted in via
``whatsapp_followup_consent`` and the scheduler resolves a real provider;
otherwise the provider layer stays in demo/console mode.
"""

TEMPLATE_30_DAY = "day_30"
TEMPLATE_60_DAY = "day_60"
TEMPLATE_90_DAY = "day_90"

SCHEDULE = (
    (TEMPLATE_30_DAY, 30),
    (TEMPLATE_60_DAY, 60),
    (TEMPLATE_90_DAY, 90),
)


def render_template(template: str, first_name: str) -> str:
    name = (first_name or "trainee").split()[0]
    if template == TEMPLATE_60_DAY:
        return (
            f"Hello {name},\n"
            "How is your current work going?\n\n"
            "Please update your:\n"
            "- Employment status\n"
            "- Role\n"
            "- Employer\n"
            "- Monthly income\n\n"
            "Your information helps improve skill-development programs."
        )
    if template == TEMPLATE_90_DAY:
        return (
            "SkillTrace follow-up\n\n"
            "We would like to know whether your employment is continuing.\n\n"
            "Are you still working in your current role?\n\n"
            "1. Yes\n"
            "2. No\n"
            "3. Changed employer\n"
            "4. Self-employed"
        )
    return (
        f"Hello {name},\n"
        "This is SkillTrace.\n\n"
        "We are checking in to understand your employment journey after training.\n\n"
        "Are you currently employed?\n\n"
        "1. Yes\n"
        "2. No\n"
        "3. Self-employed\n"
        "4. Apprenticeship\n\n"
        "Reply with the option that applies to you."
    )


def normalize_phone(value: str | None) -> str | None:
    """Return digits-only phone number, or None when unusable for wa.me links."""
    if not value:
        return None
    digits = "".join(ch for ch in value if ch.isdigit())
    if len(digits) < 7 or len(digits) > 15:
        return None
    return digits


def wa_link(phone_digits: str, message: str) -> str:
    import urllib.parse

    return f"https://wa.me/{phone_digits}?text={urllib.parse.quote(message)}"


# Webhook reply vocabulary: free-text answer -> canonical response code.
RESPONSE_VOCABULARY: dict[str, str] = {
    "1": "YES",
    "yes": "YES",
    "y": "YES",
    "haan": "YES",
    "ho": "YES",
    "2": "NO",
    "no": "NO",
    "n": "NO",
    "nahi": "NO",
    "3": "SELF_EMPLOYED",
    "self-employed": "SELF_EMPLOYED",
    "self employed": "SELF_EMPLOYED",
    "selfemployed": "SELF_EMPLOYED",
    "4": "APPRENTICESHIP",
    "apprenticeship": "APPRENTICESHIP",
    "apprentice": "APPRENTICESHIP",
    "changed employer": "CHANGED_JOB",
    "changed job": "CHANGED_JOB",
    "new employer": "CHANGED_JOB",
    "new job": "CHANGED_JOB",
}


def parse_response(text: str | None) -> str | None:
    if not text:
        return None
    return RESPONSE_VOCABULARY.get(text.strip().casefold())
