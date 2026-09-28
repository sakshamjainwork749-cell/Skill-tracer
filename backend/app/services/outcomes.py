from __future__ import annotations

from datetime import UTC, datetime, timedelta
from decimal import Decimal
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import Employer, EmploymentRecord, Followup, Proof, Trainee
from app.models.base import utc_now
from app.models.enums import EmploymentStatus, FollowupStatus, OutcomeType, ProofStatus
from app.schemas.trainee import OutcomeRequest
from app.services.audit import add_audit_log
from app.services.notifications.store import notify, notify_admins
from app.services.whatsapp_templates import SCHEDULE, normalize_phone


def _find_matching_employer(db: Session, company_name: str | None) -> Employer | None:
    if not company_name:
        return None
    normalized = company_name.strip().casefold()
    employers = db.scalars(select(Employer)).all()
    return next(
        (
            employer
            for employer in employers
            if employer.organization_name.strip().casefold() == normalized
        ),
        None,
    )


CONDITIONAL_FIELDS = (
    "role",
    "company_name",
    "start_date",
    "wage_value",
    "wage_band",
    "location",
    "business_type",
    "monthly_revenue",
    "employees_created",
    "exit_reason",
)


def _derive_wage_band(value: Decimal) -> str:
    if value < 15_000:
        return "Below ₹15k"
    if value < 20_000:
        return "₹15k–₹20k"
    if value < 30_000:
        return "₹20k–₹30k"
    if value < 40_000:
        return "₹30k–₹40k"
    return "₹40k+"


def _validate_conditional_payload(
    payload: OutcomeRequest,
    employment: EmploymentRecord | None,
) -> None:
    validation_payload = payload
    if employment is not None:
        merged = payload.model_dump()
        for field in CONDITIONAL_FIELDS:
            if field not in payload.model_fields_set:
                value = getattr(employment, field)
                if isinstance(value, Decimal):
                    value = float(value)
                merged[field] = value
        validation_payload = OutcomeRequest.model_validate(merged)
    validation_payload.validate_conditional_fields()


def _validate_proof(
    db: Session, trainee: Trainee, proof_id: UUID | None
) -> Proof | None:
    if proof_id is None:
        return None
    proof = db.get(Proof, proof_id)
    if proof is None or proof.trainee_id != trainee.id:
        raise ValueError("Proof does not belong to the authenticated trainee")
    if proof.status == ProofStatus.REJECTED:
        raise ValueError("Rejected proof cannot be attached to an outcome")
    return proof


def _schedule_followup(
    db: Session,
    trainee: Trainee,
    employment: EmploymentRecord,
    actor_id: UUID,
) -> Followup:
    today = datetime.now(UTC).date()
    from app.core.config import get_settings

    settings = get_settings()
    interval = (
        settings.followup_seeking_job_days
        if employment.outcome_type == OutcomeType.SEEKING_JOB
        else settings.followup_employed_days
    )
    scheduled_for = today + timedelta(days=interval)
    followup = db.scalar(
        select(Followup)
        .where(
            Followup.trainee_id == trainee.id,
            Followup.status == FollowupStatus.SCHEDULED,
            Followup.scheduled_for >= today,
        )
        .order_by(Followup.scheduled_for.asc())
        .limit(1)
    )
    if followup is None:
        followup = Followup(
            trainee_id=trainee.id,
            employment_id=employment.id,
            created_by_id=actor_id,
            status=FollowupStatus.SCHEDULED,
            scheduled_for=scheduled_for,
            contact_method="PHONE",
        )
        db.add(followup)
    else:
        followup.employment_id = employment.id
        followup.scheduled_for = scheduled_for
        followup.status = FollowupStatus.SCHEDULED
    return followup


def _schedule_whatsapp_followups(
    db: Session,
    trainee: Trainee,
    employment: EmploymentRecord,
    actor_id: UUID,
    is_update: bool,
) -> None:
    """Schedule 30/60/90-day WhatsApp check-ins for a new outcome.

    Consent-gated: nothing is scheduled unless the trainee opted in to
    WhatsApp follow-ups AND has a usable phone number. Never schedules on
    plain outcome edits (prevents duplicate series).
    """
    if is_update:
        return
    from app.services.messaging import is_builtin_automation_active
    if not is_builtin_automation_active(db):
        return
    if not trainee.whatsapp_followup_consent:
        return
    phone = trainee.user.phone if trainee.user else None
    if normalize_phone(phone) is None:
        return
    today = datetime.now(UTC).date()
    scheduled_any = False
    for template, days in SCHEDULE:
        scheduled_for = today + timedelta(days=days)
        exists = db.scalar(
            select(Followup)
            .where(
                Followup.trainee_id == trainee.id,
                Followup.employment_id == employment.id,
                Followup.template == template,
                Followup.status.in_(
                    (FollowupStatus.SCHEDULED, FollowupStatus.SENT,
                     FollowupStatus.DELIVERED, FollowupStatus.RESPONDED)
                ),
            )
            .limit(1)
        )
        if exists is not None:
            continue
        db.add(Followup(
            trainee_id=trainee.id,
            employment_id=employment.id,
            created_by_id=actor_id,
            status=FollowupStatus.SCHEDULED,
            scheduled_for=scheduled_for,
            contact_method="WHATSAPP",
            channel="WHATSAPP",
            template=template,
            notes=f"WhatsApp {template.replace('_', ' ')} check-in",
        ))
        scheduled_any = True
    db.flush()
    if scheduled_any:
        notify(
            db,
            trainee.user_id,
            "followup",
            "WhatsApp follow-ups scheduled",
            "30, 60 and 90-day WhatsApp check-ins were scheduled. "
            "You can opt out anytime from Privacy & consent.",
        )


def save_outcome(
    db: Session,
    trainee: Trainee,
    actor_id: UUID,
    payload: OutcomeRequest,
    *,
    employment: EmploymentRecord | None = None,
    ip_address: str | None = None,
) -> EmploymentRecord:
    is_update = employment is not None
    if employment is not None and employment.trainee_id != trainee.id:
        raise PermissionError("Outcome does not belong to the authenticated trainee")
    _validate_conditional_payload(payload, employment)

    today = datetime.now(UTC).date()
    if not is_update:
        previous = db.scalar(
            select(EmploymentRecord)
            .where(
                EmploymentRecord.trainee_id == trainee.id,
                EmploymentRecord.is_current.is_(True),
            )
            .order_by(EmploymentRecord.submitted_at.desc())
            .limit(1)
        )
        if previous is not None:
            previous.is_current = False
            previous.ended_at = previous.ended_at or today
            if payload.exit_reason:
                previous.exit_reason = payload.exit_reason.strip()
        employment = EmploymentRecord(
            trainee_id=trainee.id,
            outcome_type=payload.outcome_type,
            submitted_at=utc_now(),
        )

    assert employment is not None
    fields_set = payload.model_fields_set
    employment.outcome_type = payload.outcome_type
    employment.status = EmploymentStatus.REPORTED
    employment.employer_confirmed_at = None
    employment.employer_verified_by_id = None
    employment.rating = None
    employment.skill_alignment_feedback = None
    employment.correction_notes = None

    simple_fields = (
        "role",
        "company_name",
        "start_date",
        "wage_band",
        "location",
        "business_type",
        "exit_reason",
    )
    for field in simple_fields:
        if is_update and field not in fields_set:
            continue
        value = getattr(payload, field)
        if isinstance(value, str):
            value = value.strip() or None
        setattr(employment, field, value)

    if not is_update or "wage_value" in fields_set:
        employment.wage_value = (
            Decimal(str(payload.wage_value)) if payload.wage_value is not None else None
        )
    if not is_update or "monthly_revenue" in fields_set:
        employment.monthly_revenue = (
            Decimal(str(payload.monthly_revenue))
            if payload.monthly_revenue is not None
            else None
        )
    if not is_update or "employees_created" in fields_set:
        employment.employees_created = payload.employees_created

    if (
        payload.outcome_type
        in {OutcomeType.EMPLOYED, OutcomeType.APPRENTICESHIP, OutcomeType.SELF_EMPLOYED}
        and not employment.location
    ):
        employment.location = trainee.district

    if (
        payload.outcome_type in {OutcomeType.EMPLOYED, OutcomeType.APPRENTICESHIP}
        and employment.wage_value is not None
        and "wage_band" not in fields_set
        and (not is_update or "wage_value" in fields_set or not employment.wage_band)
    ):
        employment.wage_band = _derive_wage_band(employment.wage_value)

    if payload.outcome_type in {OutcomeType.EMPLOYED, OutcomeType.APPRENTICESHIP}:
        matching_employer = _find_matching_employer(db, employment.company_name)
        employment.employer_id = matching_employer.id if matching_employer else None
        employment.is_current = True
        employment.ended_at = None
    elif payload.outcome_type == OutcomeType.SELF_EMPLOYED:
        employment.employer_id = None
        employment.is_current = True
        employment.ended_at = None
    else:
        employment.employer_id = None
        employment.is_current = False
        employment.ended_at = employment.ended_at or today

    db.add(employment)
    db.flush()

    proof = _validate_proof(db, trainee, payload.proof_id)
    if proof is not None:
        proof.employment_id = employment.id
        proof.status = ProofStatus.VERIFIED
        proof.verified_at = utc_now()

    followup = _schedule_followup(db, trainee, employment, actor_id)
    db.flush()
    _schedule_whatsapp_followups(db, trainee, employment, actor_id, is_update)
    notify(
        db,
        trainee.user_id,
        "outcome",
        "Outcome update received",
        f"Your {employment.outcome_type.value.lower().replace('_', ' ')} update "
        f"was recorded and is waiting for verification.",
    )
    if employment.employer_id is not None:
        matched = db.get(Employer, employment.employer_id)
        if matched is not None:
            notify(
                db,
                matched.user_id,
                "verification",
                "New outcome to verify",
                f"{trainee.user.full_name} reported a new outcome at "
                f"{employment.company_name or matched.organization_name}.",
            )
    if not is_update:
        notify_admins(
            db,
            "verification",
            "Verification backlog increased",
            f"{trainee.user.full_name} submitted a new outcome for verification. "
            f"Review pending employer confirmations.",
        )
    add_audit_log(
        db,
        actor_id=actor_id,
        action="OUTCOME_UPDATED" if is_update else "OUTCOME_CREATED",
        entity_type="employment_record",
        entity_id=employment.id,
        details={
            "outcome_type": employment.outcome_type.value,
            "proof_attached": proof is not None,
            "followup_id": str(followup.id),
        },
        ip_address=ip_address,
    )
    db.commit()
    db.refresh(employment)
    return employment
