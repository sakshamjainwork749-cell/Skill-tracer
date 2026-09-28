"""Notification provider abstraction (WhatsApp / Email).

Modes (NOTIFICATION_MODE):
  console  - print to backend terminal, mark as simulated (default, safe for demos)
  real     - use configured providers (Twilio WhatsApp / SMTP-or-API email)
  disabled - send nothing, record as skipped
"""
from __future__ import annotations

from dataclasses import dataclass
from typing import Protocol


@dataclass
class NotificationResult:
    ok: bool
    mode: str
    provider_message_id: str | None = None
    error: str | None = None
    simulated: bool = False


class NotificationProvider(Protocol):
    name: str

    def send(self, *, to: str, subject: str, body: str) -> NotificationResult:
        ...
