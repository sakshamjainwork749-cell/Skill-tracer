from __future__ import annotations

"""Bulk outreach engine: templates, audiences, campaigns, queue, automations.

Consent is enforced at every layer: WhatsApp jobs are only created for
opted-in trainees with a valid number, and consent is re-checked at send
time (revocation cancels future jobs). Nothing here ever bypasses consent.
"""

import logging
import re
from datetime import UTC, datetime, timedelta
from uuid import UUID

from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session
from sqlalchemy.orm import Session

from app.models import (
    AutomationRule,
    Employer,
    EmploymentRecord,
    Followup,
    MessageJob,
    MessageTemplate,
    MessagingCampaign,
    Trainee,
    TrainingEnrollment,
    User,
)
from app.models.base import utc_now
from app.models.enums import (
    CampaignStatus,
    EmploymentStatus,
    FollowupStatus,
    MessageStatus,
    OutcomeType,
)
from app.services.audit import add_audit_log
from app.services.notifications.store import notify, notify_admins
from app.services.whatsapp_templates import normalize_phone

logger = logging.getLogger(__name__)

MAX_JOB_ATTEMPTS = 3

# Canonical variable templates. Bodies contain only {{variables}} — never
# personal data. Rendered server-side from real trainee context.
DEFAULT_TEMPLATES: list[dict] = [
    {
        "name": "30-Day Employment Check-in",
        "template_key": "EMPLOYMENT_30_DAY",
        "body": (
            "Hi {{first_name}}, this is your 30-day SkillTrace employment check-in "
            "for your role as {{job_role}} at {{company_name}}.\n\n"
            "How is your employment going?\n\n"
            "1. Still employed\n2. Changed job\n3. No longer employed\n"
            "4. Self-employed\n5. Need support\n\n"
            "Reply with the option number or update your SkillTrace profile."
        ),
        "variables": ["first_name", "job_role", "company_name", "followup_date", "district"],
    },
    {
        "name": "60-Day Employment Check-in",
        "template_key": "EMPLOYMENT_60_DAY",
        "body": (
            "Hi {{first_name}}, your 60-day SkillTrace check-in is due.\n\n"
            "Please confirm: are you still working as {{job_role}}?\n"
            "Employer on record: {{company_name}}.\n\n"
            "Reply 1 for yes, 2 if anything changed."
        ),
        "variables": ["first_name", "job_role", "company_name", "followup_date"],
    },
    {
        "name": "90-Day Employment Check-in",
        "template_key": "EMPLOYMENT_90_DAY",
        "body": (
            "Hi {{first_name}}, final check-in for this cycle (day 90).\n\n"
            "Is your employment with {{company_name}} continuing?\n\n"
            "1. Yes, continuing\n2. Changed employer\n3. Self-employed now\n4. Need support"
        ),
        "variables": ["first_name", "company_name", "followup_date"],
    },
    {
        "name": "Employment Verification Notice",
        "template_key": "EMPLOYMENT_VERIFICATION",
        "body": (
            "Hi {{first_name}}, {{company_name}} has {{verification_result}} "
            "your role as {{job_role}}. Your SkillTrace passport is updated."
        ),
        "variables": ["first_name", "company_name", "job_role", "verification_result"],
    },
    {
        "name": "Employment Update Reminder",
        "template_key": "EMPLOYMENT_UPDATE_REMINDER",
        "body": (
            "Hi {{first_name}}, your SkillTrace 30-day employment check-in is due.\n\n"
            "Please update your employment status."
        ),
        "variables": ["first_name", "followup_date"],
    },
    {
        "name": "Training Completion",
        "template_key": "TRAINING_COMPLETION",
        "body": (
            "Congratulations {{first_name}}! You completed {{training_name}}. "
            "Your SkillTrace passport is ready. Keep it updated as your career grows."
        ),
        "variables": ["first_name", "training_name"],
    },
    {
        "name": "Profile Update Reminder",
        "template_key": "PROFILE_UPDATE_REMINDER",
        "body": (
            "Hi {{first_name}}, is your SkillTrace profile still current? "
            "A fresh profile helps employers find you for roles matching {{skill_name}}."
        ),
        "variables": ["first_name", "skill_name"],
    },
]

BUILTIN_AUTOMATION_NAME = "Employment Follow-up"


def render_body(body: str, context: dict[str, str | None]) -> str:
    def replace(match: re.Match) -> str:
        return str(context.get(match.group(1).strip(), "") or "")

    return re.sub(r"\{\{\s*([a-zA-Z0-9_]+)\s*\}\}", replace, body)


def trainee_context(db: Session, trainee: Trainee,
                    employment: EmploymentRecord | None = None) -> dict[str, str]:
    user = trainee.user
    record = employment
    if record is None:
        record = db.scalar(
            select(EmploymentRecord)
            .where(EmploymentRecord.trainee_id == trainee.id,
                   EmploymentRecord.is_current.is_(True))
            .order_by(EmploymentRecord.submitted_at.desc())
            .limit(1)
        )
    enrollment = db.scalar(
        select(TrainingEnrollment)
        .where(TrainingEnrollment.trainee_id == trainee.id)
        .order_by(TrainingEnrollment.completed_at.desc().nullslast())
        .limit(1)
    )
    skills = list(enrollment.course.taught_skills) if enrollment and enrollment.course else []
    return {
        "first_name": ((user.full_name if user else "") or "trainee").split()[0],
        "company_name": (record.company_name if record else "") or "",
        "job_role": (record.role if record else "") or "",
        "training_name": (enrollment.course.name if enrollment and enrollment.course else "") or "",
        "followup_date": "",
        "district": trainee.district or "",
        "skill_name": skills[0] if skills else "",
        "verification_result": "",
    }


def ensure_default_templates(db: Session) -> list[MessageTemplate]:
    existing = {t.template_key for t in db.scalars(select(MessageTemplate)).all()}
    created: list[MessageTemplate] = []
    for item in DEFAULT_TEMPLATES:
        if item["template_key"] in existing:
            continue
        row = MessageTemplate(
            name=item["name"], template_key=item["template_key"],
            channel="WHATSAPP", body=item["body"], variables=item["variables"],
            is_active=True,
        )
        db.add(row)
        created.append(row)
    if created:
        db.flush()
    return db.scalars(select(MessageTemplate).where(MessageTemplate.is_active.is_(True))).all()


def ensure_builtin_automation(db: Session) -> AutomationRule:
    rule = db.scalar(
        select(AutomationRule).where(AutomationRule.name == BUILTIN_AUTOMATION_NAME).limit(1)
    )
    if rule is None:
        template = db.scalar(
            select(MessageTemplate).where(MessageTemplate.template_key == "EMPLOYMENT_30_DAY").limit(1)
        )
        rule = AutomationRule(
            name=BUILTIN_AUTOMATION_NAME,
            trigger_type="OUTCOME_SUBMITTED",
            delay_days=[30, 60, 90],
            template_id=template.id if template else None,
            audience_filter={"consent_given": True},
            is_active=True,
        )
        db.add(rule)
        db.flush()
    return rule


def is_builtin_automation_active(db: Session) -> bool:
    rule = db.scalar(
        select(AutomationRule).where(AutomationRule.name == BUILTIN_AUTOMATION_NAME).limit(1)
    )
    return True if rule is None else bool(rule.is_active)


def _current_outcome_map(db: Session, trainee_ids: set[UUID]) -> dict[UUID, EmploymentRecord]:
    if not trainee_ids:
        return {}
    rows = db.scalars(
        select(EmploymentRecord)
        .where(EmploymentRecord.trainee_id.in_(trainee_ids),
               EmploymentRecord.is_current.is_(True))
        .order_by(EmploymentRecord.submitted_at.desc())
    ).all()
    latest: dict[UUID, EmploymentRecord] = {}
    for record in rows:
        latest.setdefault(record.trainee_id, record)
    return latest


def _employment_bucket(record: EmploymentRecord | None) -> str:
    if record is None:
        return "unemployed"
    if record.outcome_type == OutcomeType.SELF_EMPLOYED:
        return "self_employed"
    if record.outcome_type == OutcomeType.APPRENTICESHIP:
        return "apprenticeship"
    if record.outcome_type == OutcomeType.SEEKING_JOB:
        return "unemployed"
    return "employed"


def resolve_audience(db: Session, filt: dict | None) -> tuple[list[Trainee], dict]:
    """Return (eligible_trainees, counts). WhatsApp eligibility always
    requires opt-in consent + valid number; others are counted as excluded."""
    filt = filt or {}
    query = select(Trainee).join(User, Trainee.user_id == User.id).where(User.is_active.is_(True))
    if filt.get("trainee_ids"):
        try:
            ids = [UUID(str(value)) for value in filt["trainee_ids"][:500]]
        except ValueError:
            ids = []
        query = query.where(Trainee.id.in_(ids))
    if filt.get("district"):
        query = query.where(Trainee.district == filt["district"])
    if filt.get("search"):
        needle = f"%{filt['search'].strip()}%"
        query = query.where(or_(User.full_name.ilike(needle), User.email.ilike(needle)))
    trainees = list(db.scalars(query.order_by(User.full_name.asc()).limit(5000)).all())

    if filt.get("course"):
        needle = filt["course"].strip().casefold()
        keep: list[Trainee] = []
        for trainee in trainees:
            enrollment = db.scalar(
                select(TrainingEnrollment)
                .where(TrainingEnrollment.trainee_id == trainee.id)
                .order_by(TrainingEnrollment.completed_at.desc().nullslast())
                .limit(1)
            )
            if enrollment and enrollment.course and needle in enrollment.course.name.casefold():
                keep.append(trainee)
        trainees = keep

    outcomes = _current_outcome_map(db, {t.id for t in trainees})
    wanted_status = (filt.get("employment_status") or "").strip().casefold()
    if wanted_status:
        trainees = [t for t in trainees if _employment_bucket(outcomes.get(t.id)) == wanted_status]

    if filt.get("followup_due"):
        horizon = utc_now().date() + timedelta(days=30)
        due_ids = set(db.scalars(
            select(Followup.trainee_id).where(
                Followup.status == FollowupStatus.SCHEDULED,
                Followup.scheduled_for <= horizon)
        ).all())
        trainees = [t for t in trainees if t.id in due_ids]

    total = len(trainees)
    eligible: list[Trainee] = []
    excluded = 0
    for trainee in trainees:
        if filt.get("consent_given") is False:
            eligible.append(trainee)
            continue
        phone_ok = normalize_phone(trainee.user.phone if trainee.user else None) is not None
        if trainee.whatsapp_followup_consent and phone_ok:
            eligible.append(trainee)
        else:
            excluded += 1
    if filt.get("consent_given") is False:
        excluded = 0
    return eligible, {
        "eligible": len(eligible),
        "consent_available": len(eligible) if filt.get("consent_given") is not False else 0,
        "excluded": excluded,
        "total": total,
    }


def schedule_campaign(db: Session, campaign: MessagingCampaign, actor_id: UUID | None) -> dict:
    """Create QUEUED jobs for every eligible trainee. Consent enforced."""
    ensure_default_templates(db)
    template = db.get(MessageTemplate, campaign.template_id) if campaign.template_id else None
    if template is None or not template.is_active:
        raise ValueError("Campaign template is missing or inactive")
    eligible, counts = resolve_audience(db, dict(campaign.audience_filter or {}))
    created = 0
    for trainee in eligible:
        context = trainee_context(db, trainee)
        db.add(MessageJob(
            campaign_id=campaign.id,
            trainee_id=trainee.id,
            template_id=template.id,
            channel=campaign.channel or "WHATSAPP",
            scheduled_at=campaign.scheduled_at or utc_now(),
            status=MessageStatus.QUEUED,
            rendered_body=render_body(template.body, context),
        ))
        created += 1
    campaign.status = CampaignStatus.RUNNING
    db.flush()
    add_audit_log(db, actor_id=actor_id, action="CAMPAIGN_SCHEDULED",
                  entity_type="messaging_campaign", entity_id=campaign.id,
                  details={"jobs": created, **counts})
    db.commit()
    return {"jobs": created, **counts}


def _send_job(db: Session, job: MessageJob | Followup) -> None:
    from app.services.notifications.whatsapp import WhatsAppProvider

    trainee = db.get(Trainee, job.trainee_id) if job.trainee_id else None
    if trainee is None:
        job.status = MessageStatus.CANCELLED if isinstance(job, MessageJob) else FollowupStatus.CANCELLED
        job.last_error = "trainee not found"
        return
    # Consent re-check at send time: revocation cancels the job.
    phone = trainee.user.phone if trainee.user else None
    if not trainee.whatsapp_followup_consent or normalize_phone(phone) is None:
        job.status = MessageStatus.CANCELLED if isinstance(job, MessageJob) else FollowupStatus.CANCELLED
        job.last_error = "consent revoked or number missing at send time"
        add_audit_log(db, actor_id=None, action="MESSAGE_CANCELLED",
                      entity_type="message_job" if isinstance(job, MessageJob) else "followup",
                      entity_id=job.id,
                      details={"reason": job.last_error})
        return
    in_progress = MessageStatus.PROCESSING if isinstance(job, MessageJob) else FollowupStatus.SENT
    terminal_fail = MessageStatus.FAILED if isinstance(job, MessageJob) else FollowupStatus.FAILED
    job.status = in_progress
    if hasattr(job, "attempt_count"):
        job.attempt_count += 1
    db.flush()
    context = trainee_context(db, trainee)
    template_ref = getattr(job, "template", None)
    if isinstance(template_ref, str):
        # Followup rows store a legacy template key, not a relationship.
        from app.services.whatsapp_templates import render_template as render_legacy

        body = getattr(job, "rendered_body", None) or render_legacy(
            template_ref, context.get("first_name", "trainee"))
    else:
        body = getattr(job, "rendered_body", None) or render_body(
            template_ref.body if template_ref is not None else "", context)
    if isinstance(job, Followup):
        # Campaign jobs deliberately do not receive a follow-up access token.
        from app.services.followup_links import issue_followup_link, secure_followup_url

        body = f"{body}\n\nUpdate securely: {secure_followup_url(issue_followup_link(job))}"
    result = WhatsAppProvider().send(to=phone or "", subject="", body=body)
    sent_status = MessageStatus.SENT if isinstance(job, MessageJob) else FollowupStatus.SENT
    if result.simulated:
        # Honest demo path: the provider id prefix (sim-/mock-) is what the
        # UI maps to SIMULATED. Followup rows carry no simulated column.
        if isinstance(job, MessageJob):
            job.simulated = True
        job.status = sent_status
        job.sent_at = utc_now()
        job.provider_message_id = result.provider_message_id
        job.last_error = None
        _notify_trainee(db, trainee.user_id, "queued")
        return
    if result.ok:
        if isinstance(job, MessageJob):
            job.simulated = False
        job.status = sent_status
        job.sent_at = utc_now()
        job.provider_message_id = result.provider_message_id
        job.last_error = None
        # Real providers confirm delivery asynchronously via webhook.
        return
    job.last_error = (result.error or "provider failure")[:500]
    if getattr(job, "attempt_count", 0) >= MAX_JOB_ATTEMPTS:
        job.status = terminal_fail
        _notify_trainee(db, trainee.user_id, "failed")
        add_audit_log(db, actor_id=None, action="MESSAGE_FAILED",
                      entity_type="message_job" if isinstance(job, MessageJob) else "followup",
                      entity_id=job.id,
                      details={"error": job.last_error,
                               "attempt": getattr(job, "attempt_count", 0)})


def _notify_trainee(db: Session, user_id: UUID, event: str) -> None:
    from app.services.notifications.store import notify as create_notification

    if event == "queued":
        create_notification(
            db, user_id, "followup", "Follow-up message queued",
            "Your employment follow-up message was queued for delivery.")
    elif event == "failed":
        create_notification(
            db, user_id, "followup", "Follow-up message failed",
            "A scheduled follow-up message could not be delivered. "
            "Your record is unchanged.")


def process_message_jobs(db: Session, *, limit: int = 100) -> dict:
    """Process due QUEUED jobs (queue worker; also used for demo runs)."""
    now = utc_now()
    due = db.scalars(
        select(MessageJob)
        .where(MessageJob.status == MessageStatus.QUEUED,
               (MessageJob.scheduled_at.is_(None)) | (MessageJob.scheduled_at <= now))
        .order_by(MessageJob.scheduled_at.asc().nullsfirst())
        .limit(limit)
    ).all()
    summary = {"checked": len(due), "sent": 0, "failed": 0, "cancelled": 0}
    for job in due:
        try:
            _send_job(db, job)
            if job.status == MessageStatus.SENT:
                summary["sent"] += 1
            elif job.status == MessageStatus.FAILED:
                summary["failed"] += 1
            elif job.status == MessageStatus.CANCELLED:
                summary["cancelled"] += 1
        except Exception as exc:
            logger.exception("Message job %s failed", job.id)
            job.attempt_count += 1
            job.last_error = str(exc)[:500]
            if job.attempt_count >= MAX_JOB_ATTEMPTS:
                job.status = MessageStatus.FAILED
                summary["failed"] += 1
    # Complete campaigns whose jobs are all terminal.
    running = db.scalars(
        select(MessagingCampaign).where(MessagingCampaign.status == CampaignStatus.RUNNING)
    ).all()
    for campaign in running:
        open_jobs = db.scalar(
            select(func.count()).select_from(MessageJob).where(
                MessageJob.campaign_id == campaign.id,
                MessageJob.status.in_((MessageStatus.QUEUED, MessageStatus.PROCESSING)))
        ) or 0
        if open_jobs == 0:
            campaign.status = CampaignStatus.COMPLETED
            totals = db.execute(
                select(MessageJob.status, func.count()).where(
                    MessageJob.campaign_id == campaign.id).group_by(MessageJob.status)
            ).all()
            breakdown = {str(status): count for status, count in totals}
            notify_admins(
                db, "campaign", f"Campaign completed: {campaign.name}",
                "Jobs finished. " + ", ".join(f"{k}: {v}" for k, v in sorted(breakdown.items())))
    db.commit()
    return summary


def run_due_campaigns(db: Session) -> dict:
    """Start SCHEDULED campaigns whose time has come."""
    now = utc_now()
    due = db.scalars(
        select(MessagingCampaign).where(
            MessagingCampaign.status == CampaignStatus.SCHEDULED,
            MessagingCampaign.scheduled_at.is_not(None),
            MessagingCampaign.scheduled_at <= now)
    ).all()
    started = 0
    for campaign in due:
        try:
            schedule_campaign(db, campaign, campaign.created_by_id)
            started += 1
        except Exception:
            logger.exception("Campaign %s failed to start", campaign.id)
            campaign.status = CampaignStatus.CANCELLED
            db.commit()
    return {"started": started}


def revoke_whatsapp_followups(db: Session, trainee: Trainee, actor_id: UUID | None) -> int:
    """Cancel all future WhatsApp follow-ups + message jobs on opt-out."""
    horizon = utc_now().date()
    cancelled = 0
    rows = db.scalars(
        select(Followup).where(
            Followup.trainee_id == trainee.id,
            Followup.status == FollowupStatus.SCHEDULED,
            Followup.scheduled_for >= horizon,
            or_(Followup.channel == "WHATSAPP", Followup.template.is_not(None)))
    ).all()
    for row in rows:
        row.status = FollowupStatus.CANCELLED
        row.last_error = "cancelled: WhatsApp consent revoked"
        cancelled += 1
    jobs = db.scalars(
        select(MessageJob).where(
            MessageJob.trainee_id == trainee.id,
            MessageJob.status.in_((MessageStatus.QUEUED, MessageStatus.PROCESSING)))
    ).all()
    for job in jobs:
        job.status = MessageStatus.CANCELLED
        job.last_error = "cancelled: WhatsApp consent revoked"
        cancelled += 1
    if cancelled:
        add_audit_log(db, actor_id=actor_id, action="WHATSAPP_CONSENT_REVOKED",
                      entity_type="trainee", entity_id=trainee.id,
                      details={"cancelled": cancelled})
        from app.services.notifications.store import notify as create_notification
        create_notification(
            db, trainee.user_id, "followup", "WhatsApp follow-ups paused",
            f"{cancelled} scheduled message(s) were cancelled after you opted out.")
    return cancelled
