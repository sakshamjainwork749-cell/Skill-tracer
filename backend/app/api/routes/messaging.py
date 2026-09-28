from __future__ import annotations

"""Government outreach: templates, campaigns, automations, trainees, analytics.

Every WhatsApp send path enforces opt-in consent + valid numbers; the UI
states this explicitly and there is no bypass.
"""

from uuid import UUID

from fastapi import APIRouter, HTTPException, Request
from sqlalchemy import func, select

from app.api.deps import CurrentAdmin, DbSession
from app.core.responses import success
from app.models import (
    AutomationRule,
    EmploymentRecord,
    Followup,
    MessageJob,
    MessageTemplate,
    MessagingCampaign,
    Trainee,
    TrainingEnrollment,
    User,
)
from app.models.enums import CampaignStatus, FollowupStatus, MessageStatus
from app.schemas.messaging import (
    AudienceFilter,
    AutomationCreate,
    AutomationResponse,
    AutomationUpdate,
    CampaignCreate,
    CampaignResponse,
    MessageTemplateCreate,
    MessageTemplateResponse,
    OutreachAnalytics,
    SendOneRequest,
    TraineeOutreachRow,
)
from app.services.audit import add_audit_log
from app.services.messaging import (
    BUILTIN_AUTOMATION_NAME,
    ensure_builtin_automation,
    ensure_default_templates,
    process_message_jobs,
    render_body,
    resolve_audience,
    run_due_campaigns,
    schedule_campaign,
    trainee_context,
)
from app.services.whatsapp_templates import normalize_phone, render_template

router = APIRouter(prefix="/admin/messaging", tags=["Messaging"])


def _ip(request: Request) -> str | None:
    return request.client.host if request.client else None


# ---- templates ----

@router.get("/templates", response_model=None)
def list_templates(admin: CurrentAdmin, db: DbSession):
    ensure_default_templates(db)
    db.commit()
    rows = db.scalars(select(MessageTemplate).order_by(MessageTemplate.name.asc())).all()
    return success([MessageTemplateResponse.model_validate(r, from_attributes=True) for r in rows])


@router.post("/templates", response_model=None)
def create_template(payload: MessageTemplateCreate, request: Request,
                    admin: CurrentAdmin, db: DbSession):
    ensure_default_templates(db)
    if db.scalar(select(MessageTemplate).where(
            MessageTemplate.template_key == payload.template_key).limit(1)):
        raise HTTPException(status_code=409, detail="Template key already exists")
    row = MessageTemplate(
        name=payload.name.strip(), template_key=payload.template_key.strip(),
        channel=payload.channel, body=payload.body,
        variables=payload.variables, is_active=True,
    )
    db.add(row)
    db.flush()
    add_audit_log(db, actor_id=admin.id, action="TEMPLATE_CREATED",
                  entity_type="message_template", entity_id=row.id,
                  ip_address=_ip(request))
    db.commit()
    db.refresh(row)
    return success(MessageTemplateResponse.model_validate(row, from_attributes=True))


# ---- audience preview ----

@router.post("/audience/preview", response_model=None)
def audience_preview(payload: AudienceFilter, admin: CurrentAdmin, db: DbSession):
    eligible, counts = resolve_audience(db, payload.model_dump())
    sample = []
    for trainee in eligible[:5]:
        name = (trainee.user.full_name if trainee.user else "Trainee").split()[0]
        sample.append(f"{name} · {trainee.district}")
    return success({**counts, "sample": sample})


# ---- campaigns ----

def _campaign_counts(db: DbSession, campaign_id: UUID) -> dict[str, int]:
    rows = db.execute(
        select(MessageJob.status, func.count()).where(
            MessageJob.campaign_id == campaign_id).group_by(MessageJob.status)
    ).all()
    counts = {"queued": 0, "sent": 0, "delivered": 0, "failed": 0}
    for status, count in rows:
        key = str(status.value if hasattr(status, "value") else status).lower()
        if key in ("sent", "processing"):
            counts["sent"] += int(count)
        elif key == "delivered":
            counts["delivered"] += int(count)
        elif key == "failed":
            counts["failed"] += int(count)
        elif key in ("queued",):
            counts["queued"] += int(count)
    return counts


def _campaign_response(db: DbSession, campaign: MessagingCampaign) -> CampaignResponse:
    template = db.get(MessageTemplate, campaign.template_id) if campaign.template_id else None
    counts = _campaign_counts(db, campaign.id)
    return CampaignResponse(
        id=campaign.id, name=campaign.name,
        template_key=template.template_key if template else None,
        audience_filter=dict(campaign.audience_filter or {}),
        channel=campaign.channel, status=campaign.status.value,
        scheduled_at=campaign.scheduled_at, created_at=campaign.created_at,
        **counts,
    )


@router.get("/campaigns", response_model=None)
def list_campaigns(admin: CurrentAdmin, db: DbSession):
    rows = db.scalars(
        select(MessagingCampaign).order_by(MessagingCampaign.created_at.desc()).limit(50)
    ).all()
    return success([_campaign_response(db, row) for row in rows])


@router.post("/campaigns", response_model=None)
def create_campaign(payload: CampaignCreate, request: Request,
                    admin: CurrentAdmin, db: DbSession):
    ensure_default_templates(db)
    template = db.scalar(select(MessageTemplate).where(
        MessageTemplate.template_key == payload.template_key,
        MessageTemplate.is_active.is_(True)).limit(1))
    if template is None:
        raise HTTPException(status_code=404, detail="Template not found or inactive")
    campaign = MessagingCampaign(
        name=payload.name.strip(), template_id=template.id,
        audience_filter=payload.audience.model_dump(),
        channel=payload.channel, status=CampaignStatus.DRAFT,
        scheduled_at=payload.scheduled_at, created_by_id=admin.id,
    )
    db.add(campaign)
    db.flush()
    add_audit_log(db, actor_id=admin.id, action="CAMPAIGN_CREATED",
                  entity_type="messaging_campaign", entity_id=campaign.id,
                  details={"template": template.template_key},
                  ip_address=_ip(request))
    db.commit()
    return success(_campaign_response(db, campaign))


@router.get("/campaigns/{campaign_id}", response_model=None)
def get_campaign(campaign_id: UUID, admin: CurrentAdmin, db: DbSession):
    campaign = db.get(MessagingCampaign, campaign_id)
    if campaign is None:
        raise HTTPException(status_code=404, detail="Campaign not found")
    return success(_campaign_response(db, campaign))


@router.post("/campaigns/{campaign_id}/schedule", response_model=None)
def schedule_campaign_now(campaign_id: UUID, request: Request,
                          admin: CurrentAdmin, db: DbSession):
    campaign = db.get(MessagingCampaign, campaign_id)
    if campaign is None:
        raise HTTPException(status_code=404, detail="Campaign not found")
    if campaign.status not in (CampaignStatus.DRAFT, CampaignStatus.SCHEDULED):
        raise HTTPException(status_code=409, detail="Only draft/scheduled campaigns can start")
    try:
        result = schedule_campaign(db, campaign, admin.id)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    return success({**result, "campaign": _campaign_response(db, campaign)})


@router.post("/campaigns/{campaign_id}/run-demo", response_model=None)
def run_campaign_demo(campaign_id: UUID, admin: CurrentAdmin, db: DbSession):
    """Process due jobs immediately through the mock worker (SIMULATED)."""
    campaign = db.get(MessagingCampaign, campaign_id)
    if campaign is None:
        raise HTTPException(status_code=404, detail="Campaign not found")
    summary = process_message_jobs(db, limit=500)
    return success({**summary, "campaign": _campaign_response(db, campaign)})


@router.post("/campaigns/{campaign_id}/cancel", response_model=None)
def cancel_campaign(campaign_id: UUID, request: Request,
                    admin: CurrentAdmin, db: DbSession):
    campaign = db.get(MessagingCampaign, campaign_id)
    if campaign is None:
        raise HTTPException(status_code=404, detail="Campaign not found")
    jobs = db.scalars(select(MessageJob).where(
        MessageJob.campaign_id == campaign.id,
        MessageJob.status.in_((MessageStatus.QUEUED, MessageStatus.PROCESSING)))).all()
    for job in jobs:
        job.status = MessageStatus.CANCELLED
        job.last_error = "cancelled by admin"
    campaign.status = CampaignStatus.CANCELLED
    add_audit_log(db, actor_id=admin.id, action="CAMPAIGN_CANCELLED",
                  entity_type="messaging_campaign", entity_id=campaign.id,
                  details={"cancelled_jobs": len(jobs)}, ip_address=_ip(request))
    db.commit()
    return success(_campaign_response(db, campaign))


# ---- automations ----

def _automation_stats(db: Session, rule: AutomationRule) -> AutomationResponse:
    enrolled = db.scalar(select(func.count()).select_from(Trainee)) or 0
    return AutomationResponse(
        id=rule.id, name=rule.name, trigger_type=rule.trigger_type,
        delay_days=list(rule.delay_days or []), is_active=rule.is_active,
        enrolled=int(enrolled),
        scheduled=db.scalar(select(func.count()).select_from(Followup).where(
            Followup.channel == "WHATSAPP")) or 0,
        delivered=db.scalar(select(func.count()).select_from(Followup).where(
            Followup.channel == "WHATSAPP",
            Followup.status == FollowupStatus.DELIVERED)) or 0,
        failed=db.scalar(select(func.count()).select_from(Followup).where(
            Followup.channel == "WHATSAPP",
            Followup.status == FollowupStatus.FAILED)) or 0,
        pending=db.scalar(select(func.count()).select_from(Followup).where(
            Followup.channel == "WHATSAPP",
            Followup.status == FollowupStatus.SCHEDULED)) or 0,
    )


@router.get("/automations", response_model=None)
def list_automations(admin: CurrentAdmin, db: DbSession):
    ensure_builtin_automation(db)
    db.commit()
    rules = db.scalars(select(AutomationRule).order_by(AutomationRule.created_at.asc())).all()
    return success([_automation_stats(db, rule) for rule in rules])


@router.post("/automations", response_model=None)
def create_automation(payload: AutomationCreate, request: Request,
                      admin: CurrentAdmin, db: DbSession):
    ensure_default_templates(db)
    template_id = None
    if payload.template_key:
        template = db.scalar(select(MessageTemplate).where(
            MessageTemplate.template_key == payload.template_key).limit(1))
        if template is None:
            raise HTTPException(status_code=404, detail="Template not found")
        template_id = template.id
    for days in payload.delay_days:
        if days < 0 or days > 365:
            raise HTTPException(status_code=422, detail="Delays must be 0-365 days")
    rule = AutomationRule(
        name=payload.name.strip(), trigger_type=payload.trigger_type,
        delay_days=sorted(payload.delay_days), template_id=template_id,
        audience_filter=payload.audience.model_dump(),
        is_active=True, created_by_id=admin.id,
    )
    db.add(rule)
    db.flush()
    add_audit_log(db, actor_id=admin.id, action="AUTOMATION_CREATED",
                  entity_type="automation_rule", entity_id=rule.id,
                  ip_address=_ip(request))
    db.commit()
    return success(_automation_stats(db, rule))


@router.patch("/automations/{automation_id}", response_model=None)
def update_automation(automation_id: UUID, payload: AutomationUpdate, request: Request,
                      admin: CurrentAdmin, db: DbSession):
    rule = db.get(AutomationRule, automation_id)
    if rule is None:
        raise HTTPException(status_code=404, detail="Automation not found")
    if payload.name is not None:
        rule.name = payload.name.strip()
    if payload.is_active is not None:
        rule.is_active = payload.is_active
    if payload.delay_days is not None:
        for days in payload.delay_days:
            if days < 0 or days > 365:
                raise HTTPException(status_code=422, detail="Delays must be 0-365 days")
        rule.delay_days = sorted(payload.delay_days)
    add_audit_log(db, actor_id=admin.id, action="AUTOMATION_UPDATED",
                  entity_type="automation_rule", entity_id=rule.id,
                  details=payload.model_dump(exclude_none=True),
                  ip_address=_ip(request))
    db.commit()
    return success(_automation_stats(db, rule))


# ---- analytics ----

@router.get("/analytics", response_model=None)
def outreach_analytics(admin: CurrentAdmin, db: DbSession):
    ensure_builtin_automation(db)
    rows = db.execute(
        select(MessageJob.status, func.count()).group_by(MessageJob.status)
    ).all()
    by_status = {str(s.value if hasattr(s, "value") else s): int(c) for s, c in rows}
    simulated = db.scalar(select(func.count()).select_from(MessageJob).where(
        MessageJob.simulated.is_(True))) or 0
    return success(OutreachAnalytics(
        active_automations=db.scalar(select(func.count()).select_from(AutomationRule).where(
            AutomationRule.is_active.is_(True))) or 0,
        total_automations=db.scalar(select(func.count()).select_from(AutomationRule)) or 0,
        enrolled=db.scalar(select(func.count()).select_from(Trainee)) or 0,
        messages_scheduled=sum(by_status.values()),
        delivered=by_status.get("DELIVERED", 0),
        failed=by_status.get("FAILED", 0),
        pending=by_status.get("QUEUED", 0) + by_status.get("PROCESSING", 0),
        simulated=int(simulated),
        next_run="Scheduler tick (~60s) + on-demand demo runs",
    ))


# ---- trainees ----

def _trainee_row(db: DbSession, trainee: Trainee) -> TraineeOutreachRow:
    enrollment = db.scalar(
        select(TrainingEnrollment).where(TrainingEnrollment.trainee_id == trainee.id)
        .order_by(TrainingEnrollment.completed_at.desc().nullslast()).limit(1))
    record = db.scalar(
        select(EmploymentRecord).where(
            EmploymentRecord.trainee_id == trainee.id,
            EmploymentRecord.is_current.is_(True))
        .order_by(EmploymentRecord.submitted_at.desc()).limit(1))
    upcoming = db.scalar(
        select(Followup).where(Followup.trainee_id == trainee.id,
                               Followup.status == FollowupStatus.SCHEDULED)
        .order_by(Followup.scheduled_for.asc()).limit(1))
    phone = trainee.user.phone if trainee.user else None
    digits = normalize_phone(phone)
    bucket = "unemployed"
    if record is not None:
        from app.models.enums import OutcomeType as OT
        bucket = {"SELF_EMPLOYED": "self_employed", "APPRENTICESHIP": "apprenticeship",
                  "SEEKING_JOB": "unemployed"}.get(record.outcome_type.value, "employed")
    return TraineeOutreachRow(
        trainee_id=trainee.id,
        name=trainee.user.full_name if trainee.user else "Trainee",
        district=trainee.district,
        training=enrollment.course.name if enrollment and enrollment.course else None,
        employment=bucket if record is not None else None,
        company=record.company_name if record else None,
        next_followup=upcoming.scheduled_for.isoformat() if upcoming else None,
        whatsapp_consent=bool(trainee.whatsapp_followup_consent),
        phone_masked=f"+{digits[:2]}******{digits[-2:]}" if digits else None,
        last_updated=trainee.updated_at,
        status="active" if trainee.user and trainee.user.is_active else "inactive",
    )


@router.get("/trainees", response_model=None)
def list_outreach_trainees(admin: CurrentAdmin, db: DbSession,
                           district: str | None = None,
                           course: str | None = None,
                           employment_status: str | None = None,
                           consent: str | None = None,
                           followup_due: bool | None = None,
                           search: str | None = None):
    filt = {"district": district, "course": course,
            "employment_status": employment_status, "followup_due": followup_due,
            "search": search}
    if consent == "opted-in":
        filt["consent_given"] = True
    elif consent == "not-given":
        filt["consent_given"] = False
    eligible, counts = resolve_audience(db, {k: v for k, v in filt.items() if v is not None})
    return success({
        "rows": [_trainee_row(db, trainee) for trainee in eligible[:200]],
        "counts": counts,
    })


@router.get("/trainees/{trainee_id}", response_model=None)
def get_outreach_trainee(trainee_id: UUID, admin: CurrentAdmin, db: DbSession):
    trainee = db.get(Trainee, trainee_id)
    if trainee is None:
        raise HTTPException(status_code=404, detail="Trainee not found")
    history = db.scalars(
        select(EmploymentRecord).where(EmploymentRecord.trainee_id == trainee.id)
        .order_by(EmploymentRecord.submitted_at.desc()).limit(10)).all()
    followups = db.scalars(
        select(Followup).where(Followup.trainee_id == trainee.id)
        .order_by(Followup.scheduled_for.desc()).limit(10)).all()
    return success({
        "profile": _trainee_row(db, trainee),
        "outcomes": [{
            "id": r.id, "outcome_type": r.outcome_type.value, "status": r.status.value,
            "role": r.role, "company_name": r.company_name,
            "submitted_at": r.submitted_at.isoformat(),
        } for r in history],
        "followups": [{
            "id": f.id, "channel": f.channel, "template": f.template,
            "status": f.status.value, "scheduled_for": f.scheduled_for.isoformat(),
            "response": f.response,
        } for f in followups],
    })


@router.post("/send-one", response_model=None)
def send_one(payload: SendOneRequest, request: Request,
             admin: CurrentAdmin, db: DbSession):
    """Queue + immediately process one message (consent enforced)."""
    from app.services.messaging import _send_job

    template = db.scalar(select(MessageTemplate).where(
        MessageTemplate.template_key == payload.template_key,
        MessageTemplate.is_active.is_(True)).limit(1))
    if template is None:
        raise HTTPException(status_code=404, detail="Template not found or inactive")
    trainee = db.get(Trainee, payload.trainee_id)
    if trainee is None:
        raise HTTPException(status_code=404, detail="Trainee not found")
    phone = trainee.user.phone if trainee.user else None
    if not trainee.whatsapp_followup_consent or normalize_phone(phone) is None:
        raise HTTPException(
            status_code=422,
            detail="Trainee has not opted in or has no valid number. "
                   "Non-consenting trainees are excluded.",
        )
    job = MessageJob(
        trainee_id=trainee.id, template_id=template.id, channel="WHATSAPP",
        rendered_body=render_body(template.body, trainee_context(db, trainee)),
        status=MessageStatus.QUEUED,
    )
    db.add(job)
    db.flush()
    _send_job(db, job)
    db.commit()
    add_audit_log(db, actor_id=admin.id, action="MESSAGE_SEND_ONE",
                  entity_type="message_job", entity_id=job.id,
                  details={"trainee_id": str(trainee.id)},
                  ip_address=_ip(request))
    db.commit()
    simulated = bool(job.simulated)
    return success({
        "job_id": job.id,
        "status": "SIMULATED" if simulated else job.status.value,
        "simulated": simulated,
        "notice": "Processed immediately through the queue worker. "
                  + ("SIMULATED: no real message left the server."
                     if simulated else "Handed to the configured provider."),
    })


@router.post("/run-scheduler", response_model=None)
def run_scheduler_now(admin: CurrentAdmin, db: DbSession):
    """Process due campaigns + message jobs immediately (demo runs)."""
    started = run_due_campaigns(db)
    summary = process_message_jobs(db, limit=500)
    return success({**started, **summary})
