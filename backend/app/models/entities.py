from __future__ import annotations

import uuid
from datetime import date, datetime
from decimal import Decimal
from typing import Any

from sqlalchemy import (
    JSON,
    Boolean,
    CheckConstraint,
    Date,
    DateTime,
    Float,
    ForeignKey,
    Index,
    Integer,
    Numeric,
    String,
    Text,
    UniqueConstraint,
    Uuid,
)
from sqlalchemy import (
    Enum as SAEnum,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.session import Base
from app.models.base import TimestampMixin, utc_now
from app.models.enums import (
    CampaignStatus,
    DemandStatus,
    EmploymentStatus,
    EnrollmentStatus,
    FollowupStatus,
    MessageStatus,
    OutcomeType,
    ProofStatus,
    UserRole,
)

JSON_TYPE = JSON().with_variant(JSONB(), "postgresql")


def enum_column(enum_cls: type, name: str, length: int = 32) -> SAEnum:
    return SAEnum(
        enum_cls,
        name=name,
        native_enum=False,
        create_constraint=True,
        validate_strings=True,
        values_callable=lambda cls: [member.value for member in cls],
        length=length,
    )


class User(TimestampMixin, Base):
    __tablename__ = "users"
    __table_args__ = (Index("ix_users_role_active", "role", "is_active"),)

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    email: Mapped[str] = mapped_column(
        String(320), unique=True, index=True, nullable=False
    )
    hashed_password: Mapped[str] = mapped_column(String(255), nullable=False)
    full_name: Mapped[str] = mapped_column(String(160), nullable=False)
    role: Mapped[UserRole] = mapped_column(
        enum_column(UserRole, "user_role"), nullable=False
    )
    phone: Mapped[str | None] = mapped_column(String(32))
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    last_login_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    trainee_profile: Mapped[Trainee | None] = relationship(
        back_populates="user", cascade="all, delete-orphan", uselist=False
    )
    employer_profile: Mapped[Employer | None] = relationship(
        back_populates="user", cascade="all, delete-orphan", uselist=False
    )
    audit_logs: Mapped[list[AuditLog]] = relationship(back_populates="actor")
    notifications: Mapped[list[Notification]] = relationship(
        back_populates="user", cascade="all, delete-orphan"
    )
    verifications: Mapped[list[VerificationRecord]] = relationship(
        back_populates="verifier"
    )
    created_followups: Mapped[list[Followup]] = relationship(
        back_populates="created_by"
    )
    created_campaigns: Mapped[list[MessagingCampaign]] = relationship(
        back_populates="created_by"
    )
    created_automations: Mapped[list[AutomationRule]] = relationship(
        back_populates="created_by"
    )
    posted_demands: Mapped[list[JobPostingDemand]] = relationship(
        back_populates="posted_by"
    )


class Trainee(TimestampMixin, Base):
    __tablename__ = "trainees"
    __table_args__ = (
        CheckConstraint(
            "latitude IS NULL OR (latitude >= -90 AND latitude <= 90)",
            name="latitude_range",
        ),
        CheckConstraint(
            "longitude IS NULL OR (longitude >= -180 AND longitude <= 180)",
            name="longitude_range",
        ),
        Index("ix_trainees_district_consent", "district", "consent_given"),
    )

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("users.id", ondelete="CASCADE"), unique=True, nullable=False
    )
    internal_identifier: Mapped[str] = mapped_column(
        String(64), unique=True, index=True, nullable=False
    )
    district: Mapped[str] = mapped_column(String(100), index=True, nullable=False)
    state: Mapped[str] = mapped_column(
        String(100), default="Maharashtra", nullable=False
    )
    address: Mapped[str | None] = mapped_column(String(500))
    latitude: Mapped[float | None] = mapped_column(Float)
    longitude: Mapped[float | None] = mapped_column(Float)
    date_of_birth: Mapped[date | None] = mapped_column(Date)
    gender: Mapped[str | None] = mapped_column(String(40))
    preferred_language: Mapped[str | None] = mapped_column(String(40))
    consent_given: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    consent_given_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    consent_version: Mapped[str | None] = mapped_column(String(32))
    data_processing_allowed: Mapped[bool] = mapped_column(
        Boolean, default=False, nullable=False
    )
    employer_verification_consent: Mapped[bool] = mapped_column(
        Boolean, default=False, nullable=False
    )
    followup_consent: Mapped[bool] = mapped_column(
        Boolean, default=False, nullable=False
    )
    email_followup_consent: Mapped[bool] = mapped_column(
        Boolean, default=False, nullable=False
    )
    whatsapp_followup_consent: Mapped[bool] = mapped_column(
        Boolean, default=False, nullable=False
    )

    user: Mapped[User] = relationship(back_populates="trainee_profile")
    enrollments: Mapped[list[TrainingEnrollment]] = relationship(
        back_populates="trainee", cascade="all, delete-orphan"
    )
    employments: Mapped[list[EmploymentRecord]] = relationship(
        back_populates="trainee", cascade="all, delete-orphan"
    )
    proofs: Mapped[list[Proof]] = relationship(
        back_populates="trainee", cascade="all, delete-orphan"
    )
    followups: Mapped[list[Followup]] = relationship(
        back_populates="trainee", cascade="all, delete-orphan"
    )
    message_jobs: Mapped[list[MessageJob]] = relationship(back_populates="trainee")


class Employer(TimestampMixin, Base):
    __tablename__ = "employers"
    __table_args__ = (Index("ix_employers_district_active", "district", "is_active"),)

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("users.id", ondelete="CASCADE"), unique=True, nullable=False
    )
    organization_name: Mapped[str] = mapped_column(
        String(200), index=True, nullable=False
    )
    organization_type: Mapped[str | None] = mapped_column(String(100))
    registration_number: Mapped[str | None] = mapped_column(String(80), unique=True)
    district: Mapped[str] = mapped_column(String(100), index=True, nullable=False)
    state: Mapped[str] = mapped_column(
        String(100), default="Maharashtra", nullable=False
    )
    address: Mapped[str | None] = mapped_column(String(500))
    latitude: Mapped[float | None] = mapped_column(Float)
    longitude: Mapped[float | None] = mapped_column(Float)
    website: Mapped[str | None] = mapped_column(String(300))
    is_verified: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    user: Mapped[User] = relationship(back_populates="employer_profile")
    employments: Mapped[list[EmploymentRecord]] = relationship(
        back_populates="employer"
    )
    job_demands: Mapped[list[JobPostingDemand]] = relationship(
        back_populates="employer"
    )


class Course(TimestampMixin, Base):
    __tablename__ = "courses"
    __table_args__ = (
        CheckConstraint("duration_weeks > 0", name="duration_weeks_positive"),
        CheckConstraint("training_hours > 0", name="training_hours_positive"),
        CheckConstraint(
            "end_date IS NULL OR start_date <= end_date", name="course_date_order"
        ),
        Index("ix_courses_sector_active", "sector", "is_active"),
    )

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    course_code: Mapped[str] = mapped_column(
        String(50), unique=True, index=True, nullable=False
    )
    name: Mapped[str] = mapped_column(String(180), nullable=False)
    sector: Mapped[str] = mapped_column(String(120), index=True, nullable=False)
    description: Mapped[str | None] = mapped_column(Text)
    institution_name: Mapped[str] = mapped_column(String(200), nullable=False)
    district: Mapped[str] = mapped_column(String(100), index=True, nullable=False)
    duration_weeks: Mapped[int] = mapped_column(Integer, nullable=False)
    training_hours: Mapped[int] = mapped_column(Integer, nullable=False)
    taught_skills: Mapped[list[str]] = mapped_column(
        JSON_TYPE, default=list, nullable=False
    )
    qualification_level: Mapped[str | None] = mapped_column(String(80))
    pass_year: Mapped[int | None] = mapped_column(Integer, index=True)
    start_date: Mapped[date | None] = mapped_column(Date)
    end_date: Mapped[date | None] = mapped_column(Date)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    enrollments: Mapped[list[TrainingEnrollment]] = relationship(
        back_populates="course", cascade="all, delete-orphan"
    )


class TrainingEnrollment(TimestampMixin, Base):
    __tablename__ = "training_enrollments"
    __table_args__ = (
        UniqueConstraint(
            "trainee_id", "course_id", name="uq_enrollment_trainee_course"
        ),
        CheckConstraint(
            "final_score IS NULL OR (final_score >= 0 AND final_score <= 100)",
            name="final_score_range",
        ),
        Index("ix_enrollments_course_status", "course_id", "status"),
    )

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    trainee_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("trainees.id", ondelete="CASCADE"), nullable=False, index=True
    )
    course_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("courses.id", ondelete="CASCADE"), nullable=False, index=True
    )
    enrollment_code: Mapped[str] = mapped_column(
        String(64), unique=True, index=True, nullable=False
    )
    status: Mapped[EnrollmentStatus] = mapped_column(
        enum_column(EnrollmentStatus, "enrollment_status"),
        default=EnrollmentStatus.ENROLLED,
        nullable=False,
    )
    enrolled_at: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    started_at: Mapped[date | None] = mapped_column(Date)
    completed_at: Mapped[date | None] = mapped_column(Date, index=True)
    final_score: Mapped[float | None] = mapped_column(Float)
    certificate_number: Mapped[str | None] = mapped_column(String(100), unique=True)
    is_verified: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    trainee: Mapped[Trainee] = relationship(back_populates="enrollments")
    course: Mapped[Course] = relationship(back_populates="enrollments")


class EmploymentRecord(TimestampMixin, Base):
    __tablename__ = "employment_records"
    __table_args__ = (
        CheckConstraint(
            "wage_value IS NULL OR wage_value >= 0", name="wage_nonnegative"
        ),
        CheckConstraint(
            "monthly_revenue IS NULL OR monthly_revenue >= 0",
            name="revenue_nonnegative",
        ),
        CheckConstraint(
            "employees_created IS NULL OR employees_created >= 0",
            name="employees_nonnegative",
        ),
        CheckConstraint(
            "ended_at IS NULL OR start_date <= ended_at", name="employment_date_order"
        ),
        Index("ix_employments_employer_status", "employer_id", "status"),
        Index("ix_employments_trainee_current", "trainee_id", "is_current"),
    )

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    trainee_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("trainees.id", ondelete="CASCADE"), nullable=False, index=True
    )
    employer_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid, ForeignKey("employers.id", ondelete="SET NULL"), index=True
    )
    outcome_type: Mapped[OutcomeType] = mapped_column(
        enum_column(OutcomeType, "outcome_type"), nullable=False
    )
    status: Mapped[EmploymentStatus] = mapped_column(
        enum_column(EmploymentStatus, "employment_status"),
        default=EmploymentStatus.REPORTED,
        nullable=False,
    )
    role: Mapped[str | None] = mapped_column(String(160), index=True)
    company_name: Mapped[str | None] = mapped_column(String(200), index=True)
    start_date: Mapped[date | None] = mapped_column(Date, index=True)
    ended_at: Mapped[date | None] = mapped_column(Date)
    is_current: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    wage_value: Mapped[Decimal | None] = mapped_column(Numeric(12, 2))
    wage_band: Mapped[str | None] = mapped_column(String(80))
    location: Mapped[str | None] = mapped_column(String(200))
    business_type: Mapped[str | None] = mapped_column(String(120))
    monthly_revenue: Mapped[Decimal | None] = mapped_column(Numeric(14, 2))
    employees_created: Mapped[int | None] = mapped_column(Integer)
    exit_reason: Mapped[str | None] = mapped_column(String(300))
    submitted_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utc_now, nullable=False
    )
    employer_confirmed_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True)
    )
    employer_verified_by_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid, ForeignKey("users.id", ondelete="SET NULL")
    )
    rating: Mapped[int | None] = mapped_column(Integer)
    skill_alignment_feedback: Mapped[dict[str, Any] | None] = mapped_column(JSON_TYPE)
    correction_notes: Mapped[str | None] = mapped_column(Text)

    trainee: Mapped[Trainee] = relationship(back_populates="employments")
    employer: Mapped[Employer | None] = relationship(back_populates="employments")
    proofs: Mapped[list[Proof]] = relationship(back_populates="employment")
    verification_records: Mapped[list[VerificationRecord]] = relationship(
        back_populates="employment", cascade="all, delete-orphan"
    )
    followups: Mapped[list[Followup]] = relationship(back_populates="employment")


class Proof(TimestampMixin, Base):
    __tablename__ = "proofs"
    __table_args__ = (
        CheckConstraint("file_size > 0", name="file_size_positive"),
        CheckConstraint("file_size <= 52428800", name="file_size_maximum"),
    )

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    trainee_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("trainees.id", ondelete="CASCADE"), nullable=False, index=True
    )
    employment_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid, ForeignKey("employment_records.id", ondelete="SET NULL"), index=True
    )
    original_filename: Mapped[str] = mapped_column(String(255), nullable=False)
    stored_filename: Mapped[str] = mapped_column(
        String(255), unique=True, nullable=False
    )
    storage_path: Mapped[str] = mapped_column(String(500), nullable=False)
    mime_type: Mapped[str] = mapped_column(String(100), nullable=False)
    file_size: Mapped[int] = mapped_column(Integer, nullable=False)
    sha256: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    status: Mapped[ProofStatus] = mapped_column(
        enum_column(ProofStatus, "proof_status"),
        default=ProofStatus.UPLOADED,
        nullable=False,
    )
    description: Mapped[str | None] = mapped_column(String(500))
    uploaded_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utc_now, nullable=False
    )
    verified_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    trainee: Mapped[Trainee] = relationship(back_populates="proofs")
    employment: Mapped[EmploymentRecord | None] = relationship(back_populates="proofs")


class VerificationRecord(TimestampMixin, Base):
    __tablename__ = "verification_records"
    __table_args__ = (
        CheckConstraint(
            "rating IS NULL OR (rating >= 1 AND rating <= 5)", name="rating_range"
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    employment_id: Mapped[uuid.UUID] = mapped_column(
        Uuid,
        ForeignKey("employment_records.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    verifier_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid, ForeignKey("users.id", ondelete="SET NULL"), index=True
    )
    status: Mapped[EmploymentStatus] = mapped_column(
        enum_column(EmploymentStatus, "verification_status"), nullable=False
    )
    rating: Mapped[int | None] = mapped_column(Integer)
    skill_alignment_feedback: Mapped[dict[str, Any] | None] = mapped_column(JSON_TYPE)
    notes: Mapped[str | None] = mapped_column(Text)
    evidence: Mapped[dict[str, Any] | None] = mapped_column(JSON_TYPE)
    verified_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    employment: Mapped[EmploymentRecord] = relationship(
        back_populates="verification_records"
    )
    verifier: Mapped[User | None] = relationship(back_populates="verifications")


class Followup(TimestampMixin, Base):
    __tablename__ = "followups"
    __table_args__ = (
        CheckConstraint(
            "completed_at IS NULL OR scheduled_for <= completed_at",
            name="followup_date_order",
        ),
        Index("ix_followups_trainee_scheduled", "trainee_id", "scheduled_for"),
        Index("ix_followups_status_scheduled", "status", "scheduled_for"),
    )

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    trainee_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("trainees.id", ondelete="CASCADE"), nullable=False, index=True
    )
    employment_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid, ForeignKey("employment_records.id", ondelete="SET NULL"), index=True
    )
    created_by_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid, ForeignKey("users.id", ondelete="SET NULL")
    )
    status: Mapped[FollowupStatus] = mapped_column(
        enum_column(FollowupStatus, "followup_status"),
        default=FollowupStatus.SCHEDULED,
        nullable=False,
    )
    scheduled_for: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    contact_method: Mapped[str | None] = mapped_column(String(40))
    contact_outcome: Mapped[str | None] = mapped_column(String(300))
    notes: Mapped[str | None] = mapped_column(Text)
    next_followup_date: Mapped[date | None] = mapped_column(Date)
    channel: Mapped[str | None] = mapped_column(String(20))
    message_template: Mapped[str | None] = mapped_column(String(120))
    template: Mapped[str | None] = mapped_column(String(40))
    response: Mapped[str | None] = mapped_column(String(40))
    responded_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    attempt_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    sent_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    delivered_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    failed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    provider_message_id: Mapped[str | None] = mapped_column(String(160))
    last_error: Mapped[str | None] = mapped_column(String(500))
    # An opaque, short-lived token is generated only when a follow-up is sent.
    # Store its digest, never the value that appears in a WhatsApp URL.
    access_token_hash: Mapped[str | None] = mapped_column(String(64), index=True)
    access_token_expires_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    accessed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    trainee: Mapped[Trainee] = relationship(back_populates="followups")
    employment: Mapped[EmploymentRecord | None] = relationship(
        back_populates="followups"
    )
    created_by: Mapped[User | None] = relationship(back_populates="created_followups")


class JobPostingDemand(TimestampMixin, Base):
    __tablename__ = "job_postings_demand"
    __table_args__ = (
        CheckConstraint("headcount > 0", name="headcount_positive"),
        CheckConstraint(
            "max_monthly_wage IS NULL OR min_monthly_wage IS NULL OR min_monthly_wage <= max_monthly_wage",
            name="demand_wage_order",
        ),
        Index("ix_demand_sector_district_status", "sector", "district", "status"),
    )

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    employer_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid, ForeignKey("employers.id", ondelete="SET NULL"), index=True
    )
    posted_by_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid, ForeignKey("users.id", ondelete="SET NULL")
    )
    title: Mapped[str] = mapped_column(String(180), nullable=False)
    sector: Mapped[str] = mapped_column(String(120), index=True, nullable=False)
    description: Mapped[str | None] = mapped_column(Text)
    district: Mapped[str] = mapped_column(String(100), index=True, nullable=False)
    skills_required: Mapped[list[str]] = mapped_column(
        JSON_TYPE, default=list, nullable=False
    )
    headcount: Mapped[int] = mapped_column(Integer, nullable=False)
    min_monthly_wage: Mapped[Decimal | None] = mapped_column(Numeric(12, 2))
    max_monthly_wage: Mapped[Decimal | None] = mapped_column(Numeric(12, 2))
    work_mode: Mapped[str | None] = mapped_column(String(50))
    status: Mapped[DemandStatus] = mapped_column(
        enum_column(DemandStatus, "demand_status"),
        default=DemandStatus.ACTIVE,
        nullable=False,
    )
    posted_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utc_now, nullable=False
    )
    closes_at: Mapped[date | None] = mapped_column(Date)

    employer: Mapped[Employer | None] = relationship(back_populates="job_demands")
    posted_by: Mapped[User | None] = relationship(back_populates="posted_demands")


class AuditLog(Base):
    __tablename__ = "audit_logs"
    __table_args__ = (Index("ix_audit_entity", "entity_type", "entity_id"),)

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    actor_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid, ForeignKey("users.id", ondelete="SET NULL"), index=True
    )
    action: Mapped[str] = mapped_column(String(100), index=True, nullable=False)
    entity_type: Mapped[str] = mapped_column(String(100), nullable=False)
    entity_id: Mapped[str | None] = mapped_column(String(100))
    details: Mapped[dict[str, Any] | None] = mapped_column(JSON_TYPE)
    ip_address: Mapped[str | None] = mapped_column(String(64))
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utc_now, nullable=False, index=True
    )

    actor: Mapped[User | None] = relationship(back_populates="audit_logs")


class Notification(TimestampMixin, Base):
    """User-visible notifications generated by backend workflows.

    Created server-side only (outcome submitted/verified, correction
    requested). Read state is per-user; no frontend input is trusted.
    """

    __tablename__ = "notifications"
    __table_args__ = (Index("ix_notifications_user_read", "user_id", "is_read"),)

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    type: Mapped[str] = mapped_column(String(40), default="info", nullable=False)
    title: Mapped[str] = mapped_column(String(160), nullable=False)
    body: Mapped[str] = mapped_column(String(500), nullable=False)
    is_read: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    user: Mapped[User] = relationship(back_populates="notifications")


class MessageTemplate(TimestampMixin, Base):
    """Reusable, variable-based message template (WhatsApp-first).

    Bodies use {{variable}} placeholders rendered server-side from real
    trainee context. No personal data is ever stored in the template.
    """

    __tablename__ = "message_templates"
    __table_args__ = (UniqueConstraint("template_key", name="uq_message_templates_key"),)

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String(160), nullable=False)
    template_key: Mapped[str] = mapped_column(String(80), nullable=False, index=True)
    channel: Mapped[str] = mapped_column(String(20), default="WHATSAPP", nullable=False)
    body: Mapped[str] = mapped_column(Text, nullable=False)
    variables: Mapped[list[str]] = mapped_column(JSON_TYPE, default=list, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    campaigns: Mapped[list[MessagingCampaign]] = relationship(back_populates="template")
    jobs: Mapped[list[MessageJob]] = relationship(back_populates="template")


class MessagingCampaign(TimestampMixin, Base):
    """Government-authored bulk outreach: audience + template + schedule."""

    __tablename__ = "messaging_campaigns"
    __table_args__ = (Index("ix_campaigns_status_scheduled", "status", "scheduled_at"),)

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String(160), nullable=False)
    template_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid, ForeignKey("message_templates.id", ondelete="SET NULL"), index=True
    )
    audience_filter: Mapped[dict[str, Any] | None] = mapped_column(JSON_TYPE)
    channel: Mapped[str] = mapped_column(String(20), default="WHATSAPP", nullable=False)
    status: Mapped[CampaignStatus] = mapped_column(
        enum_column(CampaignStatus, "campaign_status"),
        default=CampaignStatus.DRAFT,
        nullable=False,
    )
    scheduled_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_by_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid, ForeignKey("users.id", ondelete="SET NULL")
    )

    template: Mapped[MessageTemplate | None] = relationship(back_populates="campaigns")
    created_by: Mapped[User | None] = relationship(back_populates="created_campaigns")
    jobs: Mapped[list[MessageJob]] = relationship(
        back_populates="campaign", cascade="all, delete-orphan"
    )


class MessageJob(TimestampMixin, Base):
    """One queued message to one trainee. Every state change is persisted;
    the `simulated` flag distinguishes demo/provider runs from real delivery."""

    __tablename__ = "message_jobs"
    __table_args__ = (
        Index("ix_message_jobs_status_scheduled", "status", "scheduled_at"),
        Index("ix_message_jobs_campaign", "campaign_id"),
        Index("ix_message_jobs_trainee", "trainee_id"),
    )

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    campaign_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid, ForeignKey("messaging_campaigns.id", ondelete="SET NULL"), index=True
    )
    trainee_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid, ForeignKey("trainees.id", ondelete="SET NULL"), index=True
    )
    template_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid, ForeignKey("message_templates.id", ondelete="SET NULL")
    )
    channel: Mapped[str] = mapped_column(String(20), default="WHATSAPP", nullable=False)
    scheduled_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    status: Mapped[MessageStatus] = mapped_column(
        enum_column(MessageStatus, "message_status"),
        default=MessageStatus.QUEUED,
        nullable=False,
    )
    simulated: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    rendered_body: Mapped[str | None] = mapped_column(Text)
    provider_message_id: Mapped[str | None] = mapped_column(String(160))
    attempt_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    last_error: Mapped[str | None] = mapped_column(String(500))
    sent_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    delivered_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    read_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    campaign: Mapped[MessagingCampaign | None] = relationship(back_populates="jobs")
    trainee: Mapped[Trainee | None] = relationship(back_populates="message_jobs")
    template: Mapped[MessageTemplate | None] = relationship(back_populates="jobs")


class AutomationRule(TimestampMixin, Base):
    """Declarative follow-up automation (trigger -> delays -> templates)."""

    __tablename__ = "automation_rules"
    __table_args__ = (Index("ix_automation_trigger_active", "trigger_type", "is_active"),)

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String(160), nullable=False)
    trigger_type: Mapped[str] = mapped_column(String(40), default="OUTCOME_SUBMITTED", nullable=False)
    delay_days: Mapped[list[int]] = mapped_column(JSON_TYPE, default=list, nullable=False)
    template_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid, ForeignKey("message_templates.id", ondelete="SET NULL")
    )
    audience_filter: Mapped[dict[str, Any] | None] = mapped_column(JSON_TYPE)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    created_by_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid, ForeignKey("users.id", ondelete="SET NULL")
    )

    template: Mapped[MessageTemplate | None] = relationship()
    created_by: Mapped[User | None] = relationship(back_populates="created_automations")
