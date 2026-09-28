from __future__ import annotations

from decimal import Decimal
from uuid import UUID

from fastapi import APIRouter, HTTPException, Request
from sqlalchemy import select

from app.api.deps import CurrentEmployer, CurrentUser, DbSession
from app.core.responses import success
from app.models import (
    Employer,
    EmploymentRecord,
    Followup,
    Trainee,
    TrainingEnrollment,
    VerificationRecord,
)
from app.models.base import utc_now
from app.models.enums import EmploymentStatus, FollowupStatus
from app.schemas.employer import (
    EmployerProfile,
    EmployerProfileUpdate,
    QueueCourse,
    QueueReported,
    QueueTrainee,
    VerificationDecision,
    VerificationPatch,
    VerificationPatchResponse,
    VerificationQueueRow,
)
from app.services.audit import add_audit_log
from app.services.notifications.store import notify, notify_admins
from app.services.risk import confidence_for_outcome

router = APIRouter(prefix="/employer", tags=["Employer"])


def _wage_band(value: float) -> str:
    if value < 15_000:
        return "Below ₹15k"
    if value < 20_000:
        return "₹15k–₹20k"
    if value < 30_000:
        return "₹20k–₹30k"
    if value < 40_000:
        return "₹30k–₹40k"
    return "₹40k+"


def _latest_enrollment(
    db: DbSession, employment: EmploymentRecord
) -> TrainingEnrollment | None:
    return db.scalar(
        select(TrainingEnrollment)
        .where(TrainingEnrollment.trainee_id == employment.trainee_id)
        .order_by(
            TrainingEnrollment.completed_at.desc().nullslast(),
            TrainingEnrollment.enrolled_at.desc(),
        )
        .limit(1)
    )


@router.get("/verification-queue", response_model=None)
def verification_queue(employer: CurrentEmployer, db: DbSession):
    employments = db.scalars(
        select(EmploymentRecord)
        .join(Trainee, EmploymentRecord.trainee_id == Trainee.id)
        .where(
            EmploymentRecord.employer_id == employer.id,
            Trainee.consent_given.is_(True),
            EmploymentRecord.status.in_(
                [
                    EmploymentStatus.REPORTED,
                    EmploymentStatus.PENDING,
                    EmploymentStatus.NEEDS_CORRECTION,
                ]
            ),
        )
        .order_by(EmploymentRecord.submitted_at.asc())
    ).all()

    rows: list[VerificationQueueRow] = []
    for employment in employments:
        enrollment = _latest_enrollment(db, employment)
        course = enrollment.course if enrollment else None
        proofs = [
            proof
            for proof in employment.trainee.proofs
            if proof.employment_id == employment.id
        ]
        rows.append(
            VerificationQueueRow(
                employment_id=employment.id,
                trainee=QueueTrainee(
                    name=employment.trainee.user.full_name,
                    internal_identifier=employment.trainee.internal_identifier,
                    district=employment.trainee.district,
                ),
                course=QueueCourse(
                    name=course.name if course else "Course not recorded",
                    sector=course.sector if course else "Unknown",
                    pass_year=course.pass_year if course else None,
                ),
                reported=QueueReported(
                    role=employment.role,
                    start_date=employment.start_date,
                    wage_band=employment.wage_band,
                    location=employment.location,
                ),
                status=employment.status.value,
                confidence=confidence_for_outcome(employment, proofs),
                submitted_at=employment.submitted_at.isoformat(),
                employer_confirmed=employment.employer_confirmed_at is not None,
            )
        )
    return success(rows)


def _employer_profile_payload(employer: Employer) -> EmployerProfile:
    return EmployerProfile(
        id=employer.id,
        full_name=employer.user.full_name,
        email=employer.user.email,
        phone=employer.user.phone,
        role=employer.user.role.value,
        organization_name=employer.organization_name,
        organization_type=employer.organization_type,
        registration_number=employer.registration_number,
        district=employer.district,
        address=employer.address,
        website=employer.website,
        is_verified=employer.is_verified,
    )


@router.get("/me", response_model=None)
def get_my_profile(employer: CurrentEmployer):
    """Return the authenticated employer's own profile."""
    return success(_employer_profile_payload(employer))


@router.patch("/me", response_model=None)
def update_my_profile(
    payload: EmployerProfileUpdate,
    request: Request,
    employer: CurrentEmployer,
    db: DbSession,
):
    """Update editable employer profile fields. Email, role, registration
    number and verification status can never be changed here, and an
    employer can only ever modify their own record (from CurrentEmployer)."""
    user = employer.user
    if payload.full_name is not None:
        user.full_name = payload.full_name.strip()
    if payload.phone is not None:
        phone = payload.phone.strip()
        user.phone = phone or None
    if payload.organization_name is not None:
        employer.organization_name = payload.organization_name.strip()
    if payload.district is not None:
        employer.district = payload.district.strip()
    if payload.address is not None:
        address = payload.address.strip()
        employer.address = address or None
    if payload.website is not None:
        website = payload.website.strip()
        employer.website = website or None
    db.add(user)
    db.add(employer)
    db.flush()
    add_audit_log(
        db,
        actor_id=user.id,
        action="EMPLOYER_PROFILE_UPDATED",
        entity_type="employer",
        entity_id=employer.id,
        details={k: v for k, v in payload.model_dump().items() if v is not None},
        ip_address=request.client.host if request.client else None,
    )
    db.commit()
    db.refresh(user)
    db.refresh(employer)
    return success(_employer_profile_payload(employer))


@router.patch("/verifications/{employment_id}", response_model=None)
def update_verification(
    employment_id: UUID,
    payload: VerificationPatch,
    request: Request,
    employer: CurrentEmployer,
    current_user: CurrentUser,
    db: DbSession,
):
    employment = db.scalar(
        select(EmploymentRecord)
        .join(Trainee, EmploymentRecord.trainee_id == Trainee.id)
        .where(
            EmploymentRecord.id == employment_id,
            EmploymentRecord.employer_id == employer.id,
            Trainee.consent_given.is_(True),
        )
    )
    if employment is None:
        raise HTTPException(status_code=404, detail="Verification record not found")

    old_status = employment.status.value
    if payload.status == VerificationDecision.VERIFIED:
        new_status = EmploymentStatus.VERIFIED
    elif payload.status == VerificationDecision.REJECTED:
        new_status = EmploymentStatus.REJECTED
    else:
        new_status = EmploymentStatus.NEEDS_CORRECTION
    changed_fields: dict[str, object] = {}
    for field in (
        "role",
        "company_name",
        "business_type",
        "start_date",
        "wage_band",
        "location",
        "exit_reason",
    ):
        if field in payload.model_fields_set and getattr(payload, field) is not None:
            new_value = getattr(payload, field)
            old_value = getattr(employment, field)
            if old_value != new_value:
                changed_fields[field] = {"from": str(old_value), "to": str(new_value)}
            setattr(employment, field, new_value)
    if "wage_value" in payload.model_fields_set:
        changed_fields["wage_value"] = {
            "from": str(employment.wage_value),
            "to": str(payload.wage_value),
        }
        employment.wage_value = (
            Decimal(str(payload.wage_value)) if payload.wage_value is not None else None
        )
        if "wage_band" not in payload.model_fields_set:
            employment.wage_band = (
                _wage_band(float(employment.wage_value))
                if employment.wage_value is not None
                else None
            )

    now = utc_now()
    employment.status = new_status
    employment.employer_confirmed_at = now
    employment.employer_verified_by_id = current_user.id
    if payload.rating is not None:
        employment.rating = payload.rating
    if payload.skill_alignment_feedback is not None:
        employment.skill_alignment_feedback = (
            payload.skill_alignment_feedback.model_dump()
        )
    employment.correction_notes = payload.notes

    verification = VerificationRecord(
        employment_id=employment.id,
        verifier_id=current_user.id,
        status=new_status,
        rating=payload.rating,
        skill_alignment_feedback=(
            payload.skill_alignment_feedback.model_dump()
            if payload.skill_alignment_feedback
            else None
        ),
        notes=payload.notes,
        evidence={"corrections": changed_fields},
        verified_at=now,
    )
    db.add(verification)
    db.flush()

    # A correction creates a visible trainee follow-up so the trainee knows
    # exactly what to fix, and keeps the existing scheduled one for history.
    if new_status == EmploymentStatus.NEEDS_CORRECTION:
        reason = (payload.notes or "Employer requested a correction to your "
                  "employment information.").strip()
        correction_followup = Followup(
            trainee_id=employment.trainee_id,
            employment_id=employment.id,
            created_by_id=current_user.id,
            status=FollowupStatus.SCHEDULED,
            scheduled_for=now.date(),
            contact_method="PHONE",
            notes=f"Employer requested a correction to your employment "
                  f"information. Reason: {reason} [Update employment details]",
            next_followup_date=None,
        )
        db.add(correction_followup)
        db.flush()
        add_audit_log(
            db,
            actor_id=current_user.id,
            action="FOLLOWUP_CREATED",
            entity_type="followup",
            entity_id=correction_followup.id,
            details={"reason": "employer_correction",
                     "employment_id": str(employment.id)},
            ip_address=request.client.host if request.client else None,
        )

    trainee_owner = db.get(Trainee, employment.trainee_id)
    if trainee_owner is not None:
        if new_status == EmploymentStatus.VERIFIED:
            notify(
                db,
                trainee_owner.user_id,
                "verification",
                "Employment verified",
                f"{employer.organization_name} verified your role as "
                f"{employment.role or 'reported role'}.",
            )
        elif new_status == EmploymentStatus.REJECTED:
            notify(
                db,
                trainee_owner.user_id,
                "verification",
                "Employment not confirmed",
                f"{employer.organization_name} could not confirm your reported "
                f"employment. Please review and update your outcome.",
            )
        else:
            notify(
                db,
                trainee_owner.user_id,
                "verification",
                "Correction requested",
                f"{employer.organization_name} requested a correction to your "
                f"employment information. Please review the follow-up.",
            )
    notify_admins(
        db,
        "verification",
        f"Outcome {new_status.value.lower().replace('_', ' ')}",
        f"{employer.organization_name} set an employment outcome to "
        f"{new_status.value}.",
    )
    add_audit_log(
        db,
        actor_id=current_user.id,
        action="EMPLOYMENT_VERIFICATION_UPDATED",
        entity_type="employment_record",
        entity_id=employment.id,
        details={
            "employer_id": str(employer.id),
            "from_status": old_status,
            "to_status": new_status.value,
            "rating": payload.rating,
            "corrections": changed_fields,
        },
        ip_address=request.client.host if request.client else None,
    )
    db.commit()
    db.refresh(employment)
    db.refresh(verification)

    response = VerificationPatchResponse(
        employment_id=employment.id,
        status=employment.status.value,
        employer_confirmed=employment.employer_confirmed_at is not None,
        verified_at=now.isoformat(),
        employment={
            "outcome_type": employment.outcome_type.value,
            "role": employment.role,
            "company_name": employment.company_name,
            "business_type": employment.business_type,
            "start_date": employment.start_date,
            "wage_value": float(employment.wage_value)
            if employment.wage_value is not None
            else None,
            "wage_band": employment.wage_band,
            "location": employment.location,
            "exit_reason": employment.exit_reason,
            "rating": employment.rating,
            "skill_alignment_feedback": employment.skill_alignment_feedback,
        },
        verification_id=verification.id,
    )
    return success(response)
