"""Idempotent follow-up delivery scheduler (no Celery/Redis needed).

Finds due Followup rows (SCHEDULED/SENT/FAILED with scheduled_for <= today),
checks trainee consent + channels, sends via WhatsApp/email (or console mode),
stores delivery results, retries temporary failures, avoids duplicates.
"""
from __future__ import annotations

import logging
import threading
import time
from datetime import UTC, date, datetime

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.models import Followup, Trainee
from app.models.base import utc_now
from app.models.enums import FollowupStatus
from app.services.audit import add_audit_log
from app.services.followup_links import issue_followup_link, secure_followup_url
from app.services.notifications.service import send_followup_notifications

logger = logging.getLogger(__name__)

MAX_ATTEMPTS = 3


def _first_name(full_name: str) -> str:
    return (full_name or "trainee").split()[0]


def process_due_followups(db: Session, *, limit: int = 50) -> dict:
    """Process due follow-ups idempotently. Returns summary counts."""
    today: date = datetime.now(UTC).date()
    due = db.scalars(
        select(Followup)
        .where(Followup.status.in_([FollowupStatus.SCHEDULED, FollowupStatus.SENT,
                                    FollowupStatus.FAILED]),
               Followup.scheduled_for <= today,
               Followup.attempt_count < MAX_ATTEMPTS)
        .order_by(Followup.scheduled_for.asc())
        .limit(limit)
    ).all()
    summary = {"checked": len(due), "sent": 0, "failed": 0, "skipped": 0}
    for followup in due:
        try:
            _process_one(db, followup)
            if followup.status == FollowupStatus.DELIVERED:
                summary["sent"] += 1
            elif followup.status == FollowupStatus.FAILED:
                summary["failed"] += 1
            else:
                summary["skipped"] += 1
        except Exception as exc:
            logger.exception("Followup %s failed", followup.id)
            followup.attempt_count += 1
            followup.last_error = str(exc)[:500]
            followup.failed_at = utc_now()
            if followup.attempt_count >= MAX_ATTEMPTS:
                followup.status = FollowupStatus.FAILED
            summary["failed"] += 1
    db.commit()
    return summary


def _process_one(db: Session, followup: Followup) -> None:
    trainee: Trainee | None = db.get(Trainee, followup.trainee_id)
    if trainee is None:
        followup.status = FollowupStatus.CANCELLED
        followup.last_error = "trainee not found"
        return
    # Consent gate: never message without explicit opt-in.
    if not trainee.followup_consent:
        followup.status = FollowupStatus.CANCELLED
        followup.last_error = "trainee did not consent to follow-ups"
        add_audit_log(db, actor_id=None, action="FOLLOWUP_SKIPPED",
                      entity_type="followup", entity_id=followup.id,
                      details={"reason": "no followup_consent"})
        return
    wants_email = bool(trainee.email_followup_consent and trainee.user.email)
    wants_wa = bool(trainee.whatsapp_followup_consent and trainee.user.phone)
    if not (wants_email or wants_wa):
        followup.last_error = "no consented channel (email/whatsapp)"
        followup.status = FollowupStatus.CANCELLED
        add_audit_log(db, actor_id=None, action="FOLLOWUP_SKIPPED",
                      entity_type="followup", entity_id=followup.id,
                      details={"reason": "no consented channel"})
        return
    # Duplicate guard: only one in-flight delivery per followup.
    if followup.status == FollowupStatus.DELIVERED:
        return
    followup.attempt_count += 1
    followup.status = FollowupStatus.SENT
    followup.sent_at = utc_now()

    access_token = issue_followup_link(followup)
    results = send_followup_notifications(
        to_email=trainee.user.email if wants_email else None,
        to_phone=trainee.user.phone if wants_wa else None,
        first_name=_first_name(trainee.user.full_name),
        followup_url=secure_followup_url(access_token),
    )
    errors = {k: v.error for k, v in results.items() if not v.ok}
    mids = {k: v.provider_message_id for k, v in results.items() if v.ok}
    channel = "+".join(sorted(results.keys())) or "NONE"
    followup.channel = channel
    if mids:
        followup.provider_message_id = ",".join(f"{k}:{v}" for k, v in mids.items() if v)
    if errors:
        followup.last_error = "; ".join(f"{k}: {v}" for k, v in errors.items())[:500]
        followup.failed_at = utc_now()
        if followup.attempt_count >= MAX_ATTEMPTS:
            followup.status = FollowupStatus.FAILED
            add_audit_log(db, actor_id=None, action="FOLLOWUP_FAILED",
                          entity_type="followup", entity_id=followup.id,
                          details={"errors": errors, "attempt": followup.attempt_count})
        # else stays SENT for retry
    else:
        followup.status = FollowupStatus.DELIVERED
        followup.delivered_at = utc_now()
        followup.last_error = None
        add_audit_log(db, actor_id=None, action="FOLLOWUP_SENT",
                      entity_type="followup", entity_id=followup.id,
                      details={"channels": channel, "simulated":
                               any(v.simulated for v in results.values()),
                               "mode": get_settings().notification_mode})


_scheduler_thread: threading.Thread | None = None


def start_scheduler_loop(interval_seconds: int = 60) -> None:
    """Start a daemon thread that processes due follow-ups periodically."""
    global _scheduler_thread
    if _scheduler_thread is not None and _scheduler_thread.is_alive():
        return

    def _loop() -> None:
        from app.db.session import SessionLocal
        from app.services.messaging import process_message_jobs, run_due_campaigns

        while True:
            try:
                with SessionLocal() as db:
                    process_due_followups(db)
                    run_due_campaigns(db)
                    process_message_jobs(db)
            except Exception:
                logger.exception("Followup scheduler tick failed")
            time.sleep(interval_seconds)

    _scheduler_thread = threading.Thread(target=_loop, name="followup-scheduler",
                                         daemon=True)
    _scheduler_thread.start()
    logger.info("Follow-up scheduler started (interval=%ss)", interval_seconds)
