from __future__ import annotations

from datetime import date, datetime
from typing import Self
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field

from app.models.enums import OutcomeType, ProofStatus


class OutcomeRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    outcome_type: OutcomeType
    role: str | None = Field(default=None, max_length=160)
    company_name: str | None = Field(default=None, max_length=200)
    start_date: date | None = None
    wage_value: float | None = Field(default=None, ge=0, le=100_000_000)
    wage_band: str | None = Field(default=None, max_length=80)
    location: str | None = Field(default=None, max_length=200)
    business_type: str | None = Field(default=None, max_length=120)
    monthly_revenue: float | None = Field(default=None, ge=0, le=10_000_000_000)
    employees_created: int | None = Field(default=None, ge=0, le=1_000_000)
    exit_reason: str | None = Field(default=None, max_length=300)
    proof_id: UUID | None = None

    def validate_conditional_fields(self) -> Self:
        if self.outcome_type in {OutcomeType.EMPLOYED, OutcomeType.APPRENTICESHIP}:
            missing = [
                name
                for name, value in (
                    ("role", self.role),
                    ("company_name", self.company_name),
                    ("start_date", self.start_date),
                )
                if value is None or (isinstance(value, str) and not value.strip())
            ]
            if self.wage_value is None and not self.wage_band:
                missing.append("wage_value or wage_band")
            if missing:
                raise ValueError(
                    f"{self.outcome_type.value} requires: {', '.join(missing)}"
                )
        elif self.outcome_type == OutcomeType.SELF_EMPLOYED:
            missing = [
                name
                for name, value in (
                    ("role", self.role),
                    ("business_type", self.business_type),
                    ("start_date", self.start_date),
                )
                if value is None or (isinstance(value, str) and not value.strip())
            ]
            if self.monthly_revenue is None and self.employees_created is None:
                missing.append("monthly_revenue or employees_created")
            if missing:
                raise ValueError(f"SELF_EMPLOYED requires: {', '.join(missing)}")
        return self


class TrainingSummary(BaseModel):
    id: UUID
    course_name: str
    course_code: str
    sector: str
    institution: str
    district: str
    duration_weeks: int
    training_hours: int
    taught_skills: list[str]
    enrollment_status: str
    pass_year: int | None
    completed_at: date | None
    final_score: float | None
    certificate_number: str | None


class TraineeProfile(BaseModel):
    id: UUID
    full_name: str
    email: str
    phone: str | None
    internal_identifier: str
    district: str
    state: str
    address: str | None
    latitude: float | None
    longitude: float | None
    consent_given: bool
    data_processing_allowed: bool
    employer_verification_consent: bool = False
    followup_consent: bool = False
    email_followup_consent: bool = False
    whatsapp_followup_consent: bool = False


class ConsentUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    data_processing_allowed: bool | None = None
    consent_given: bool | None = None
    employer_verification_consent: bool | None = None
    followup_consent: bool | None = None
    email_followup_consent: bool | None = None
    whatsapp_followup_consent: bool | None = None


class ProfileUpdate(BaseModel):
    """Editable profile fields. Email, role and identifiers are identity and
    can never be changed through this endpoint."""

    model_config = ConfigDict(extra="forbid")

    full_name: str | None = Field(default=None, min_length=2, max_length=160)
    phone: str | None = Field(default=None, max_length=32)
    district: str | None = Field(default=None, max_length=100)
    address: str | None = Field(default=None, max_length=500)


class FollowupResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    employment_id: UUID | None
    status: str
    scheduled_for: date
    completed_at: datetime | None = None
    contact_method: str | None = None
    channel: str | None = None
    notes: str | None = None
    next_followup_date: date | None = None
    attempt_count: int = 0
    sent_at: datetime | None = None
    delivered_at: datetime | None = None
    last_error: str | None = None
    template: str | None = None
    response: str | None = None
    responded_at: datetime | None = None
    provider_message_id: str | None = None


class OutcomeSummary(BaseModel):
    id: UUID
    outcome_type: OutcomeType
    status: str
    role: str | None
    company_name: str | None
    start_date: date | None
    ended_at: date | None
    wage_value: float | None
    wage_band: str | None
    location: str | None
    business_type: str | None
    monthly_revenue: float | None
    employees_created: int | None
    exit_reason: str | None
    correction_notes: str | None
    submitted_at: datetime


class RetentionSummary(BaseModel):
    status: str
    is_retained: bool
    months_in_role: int
    eligible_for_6m: bool
    followup_count: int
    last_followup_date: date | None
    next_followup_date: date | None


class WageProgressionPoint(BaseModel):
    employment_id: UUID
    start_date: date | None
    ended_at: date | None
    wage_value: float | None
    wage_band: str | None
    outcome_type: OutcomeType


class RetentionMilestone(BaseModel):
    label: str
    status: str
    due_date: date | None = None
    evidence_date: date | None = None
    evidence: str | None = None


class PassportResponse(BaseModel):
    trainee: TraineeProfile
    training: TrainingSummary | None
    current_outcome: OutcomeSummary | None
    confidence_score: int
    confidence_label: str
    skill_relevance_score: int
    risk_level: str
    risk_reasons: list[str]
    retention: RetentionSummary
    retention_milestones: list[RetentionMilestone]
    wage_progression: list[WageProgressionPoint]
    next_followup: date | None
    proof_status: str
    last_updated: datetime


class ProofResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    original_filename: str
    mime_type: str
    file_size: int
    status: ProofStatus
    description: str | None
    uploaded_at: datetime
