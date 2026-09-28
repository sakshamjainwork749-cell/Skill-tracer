"""Initial SkillTrace schema.

Revision ID: 20260925_0001
Revises:
Create Date: 2026-09-25
"""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision: str = "20260925_0001"
down_revision: str | None = None
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

JSON_TYPE = sa.JSON().with_variant(
    postgresql.JSONB(astext_type=sa.Text()), "postgresql"
)
NOW = sa.text("CURRENT_TIMESTAMP")


def timestamps() -> list[sa.Column]:
    return [
        sa.Column(
            "created_at", sa.DateTime(timezone=True), nullable=False, server_default=NOW
        ),
        sa.Column(
            "updated_at", sa.DateTime(timezone=True), nullable=False, server_default=NOW
        ),
    ]


def upgrade() -> None:
    op.create_table(
        "users",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("email", sa.String(length=320), nullable=False),
        sa.Column("hashed_password", sa.String(length=255), nullable=False),
        sa.Column("full_name", sa.String(length=160), nullable=False),
        sa.Column("role", sa.String(length=32), nullable=False),
        sa.Column("phone", sa.String(length=32), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("last_login_at", sa.DateTime(timezone=True), nullable=True),
        *timestamps(),
        sa.CheckConstraint(
            "role in ('TRAINEE', 'EMPLOYER', 'GOVERNMENT_ADMIN')", name="ck_users_role"
        ),
        sa.PrimaryKeyConstraint("id", name="pk_users"),
    )
    op.create_index("ix_users_email", "users", ["email"], unique=True)
    op.create_index("ix_users_role_active", "users", ["role", "is_active"])
    op.create_index("ix_users_created_at", "users", ["created_at"])

    op.create_table(
        "courses",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("course_code", sa.String(length=50), nullable=False),
        sa.Column("name", sa.String(length=180), nullable=False),
        sa.Column("sector", sa.String(length=120), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("institution_name", sa.String(length=200), nullable=False),
        sa.Column("district", sa.String(length=100), nullable=False),
        sa.Column("duration_weeks", sa.Integer(), nullable=False),
        sa.Column("training_hours", sa.Integer(), nullable=False),
        sa.Column("taught_skills", JSON_TYPE, nullable=False),
        sa.Column("qualification_level", sa.String(length=80), nullable=True),
        sa.Column("pass_year", sa.Integer(), nullable=True),
        sa.Column("start_date", sa.Date(), nullable=True),
        sa.Column("end_date", sa.Date(), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.true()),
        *timestamps(),
        sa.CheckConstraint(
            "duration_weeks > 0", name="ck_courses_duration_weeks_positive"
        ),
        sa.CheckConstraint("training_hours > 0", name="ck_courses_training_hours_positive"),
        sa.CheckConstraint(
            "end_date IS NULL OR start_date <= end_date",
            name="ck_courses_course_date_order",
        ),
        sa.PrimaryKeyConstraint("id", name="pk_courses"),
    )
    op.create_index("ix_courses_course_code", "courses", ["course_code"], unique=True)
    op.create_index("ix_courses_sector", "courses", ["sector"])
    op.create_index("ix_courses_district", "courses", ["district"])
    op.create_index("ix_courses_pass_year", "courses", ["pass_year"])
    op.create_index("ix_courses_sector_active", "courses", ["sector", "is_active"])
    op.create_index("ix_courses_created_at", "courses", ["created_at"])

    op.create_table(
        "employers",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column("organization_name", sa.String(length=200), nullable=False),
        sa.Column("organization_type", sa.String(length=100), nullable=True),
        sa.Column("registration_number", sa.String(length=80), nullable=True),
        sa.Column("district", sa.String(length=100), nullable=False),
        sa.Column(
            "state", sa.String(length=100), nullable=False, server_default="Maharashtra"
        ),
        sa.Column("address", sa.String(length=500), nullable=True),
        sa.Column("latitude", sa.Float(), nullable=True),
        sa.Column("longitude", sa.Float(), nullable=True),
        sa.Column("website", sa.String(length=300), nullable=True),
        sa.Column(
            "is_verified", sa.Boolean(), nullable=False, server_default=sa.false()
        ),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.true()),
        *timestamps(),
        sa.ForeignKeyConstraint(
            ["user_id"],
            ["users.id"],
            name="fk_employers_user_id_users",
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id", name="pk_employers"),
        sa.UniqueConstraint(
            "registration_number", name="uq_employers_registration_number"
        ),
        sa.UniqueConstraint("user_id", name="uq_employers_user_id"),
    )
    op.create_index(
        "ix_employers_organization_name", "employers", ["organization_name"]
    )
    op.create_index("ix_employers_district", "employers", ["district"])
    op.create_index(
        "ix_employers_district_active", "employers", ["district", "is_active"]
    )
    op.create_index("ix_employers_created_at", "employers", ["created_at"])

    op.create_table(
        "trainees",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column("internal_identifier", sa.String(length=64), nullable=False),
        sa.Column("district", sa.String(length=100), nullable=False),
        sa.Column(
            "state", sa.String(length=100), nullable=False, server_default="Maharashtra"
        ),
        sa.Column("address", sa.String(length=500), nullable=True),
        sa.Column("latitude", sa.Float(), nullable=True),
        sa.Column("longitude", sa.Float(), nullable=True),
        sa.Column("date_of_birth", sa.Date(), nullable=True),
        sa.Column("gender", sa.String(length=40), nullable=True),
        sa.Column("preferred_language", sa.String(length=40), nullable=True),
        sa.Column(
            "consent_given", sa.Boolean(), nullable=False, server_default=sa.false()
        ),
        sa.Column("consent_given_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("consent_version", sa.String(length=32), nullable=True),
        sa.Column(
            "data_processing_allowed",
            sa.Boolean(),
            nullable=False,
            server_default=sa.false(),
        ),
        *timestamps(),
        sa.CheckConstraint(
            "latitude IS NULL OR (latitude >= -90 AND latitude <= 90)",
            name="ck_trainees_latitude_range",
        ),
        sa.CheckConstraint(
            "longitude IS NULL OR (longitude >= -180 AND longitude <= 180)",
            name="ck_trainees_longitude_range",
        ),
        sa.ForeignKeyConstraint(
            ["user_id"],
            ["users.id"],
            name="fk_trainees_user_id_users",
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id", name="pk_trainees"),
        sa.UniqueConstraint("user_id", name="uq_trainees_user_id"),
    )
    op.create_index(
        "ix_trainees_internal_identifier",
        "trainees",
        ["internal_identifier"],
        unique=True,
    )
    op.create_index("ix_trainees_district", "trainees", ["district"])
    op.create_index(
        "ix_trainees_district_consent", "trainees", ["district", "consent_given"]
    )
    op.create_index("ix_trainees_created_at", "trainees", ["created_at"])

    op.create_table(
        "training_enrollments",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("trainee_id", sa.Uuid(), nullable=False),
        sa.Column("course_id", sa.Uuid(), nullable=False),
        sa.Column("enrollment_code", sa.String(length=64), nullable=False),
        sa.Column("status", sa.String(length=32), nullable=False),
        sa.Column("enrolled_at", sa.Date(), nullable=False),
        sa.Column("started_at", sa.Date(), nullable=True),
        sa.Column("completed_at", sa.Date(), nullable=True),
        sa.Column("final_score", sa.Float(), nullable=True),
        sa.Column("certificate_number", sa.String(length=100), nullable=True),
        sa.Column(
            "is_verified", sa.Boolean(), nullable=False, server_default=sa.false()
        ),
        *timestamps(),
        sa.CheckConstraint(
            "status in ('ENROLLED', 'IN_PROGRESS', 'COMPLETED', 'WITHDRAWN')",
            name="ck_enrollments_status",
        ),
        sa.CheckConstraint(
            "final_score IS NULL OR (final_score >= 0 AND final_score <= 100)",
            name="ck_enrollments_final_score_range",
        ),
        sa.ForeignKeyConstraint(
            ["course_id"],
            ["courses.id"],
            name="fk_enrollments_course_id_courses",
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["trainee_id"],
            ["trainees.id"],
            name="fk_enrollments_trainee_id_trainees",
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id", name="pk_training_enrollments"),
        sa.UniqueConstraint(
            "certificate_number", name="uq_training_enrollments_certificate_number"
        ),
        sa.UniqueConstraint(
            "trainee_id", "course_id", name="uq_enrollment_trainee_course"
        ),
    )
    op.create_index(
        "ix_training_enrollments_trainee_id", "training_enrollments", ["trainee_id"]
    )
    op.create_index(
        "ix_training_enrollments_course_id", "training_enrollments", ["course_id"]
    )
    op.create_index(
        "ix_training_enrollments_enrolled_at", "training_enrollments", ["enrolled_at"]
    )
    op.create_index(
        "ix_training_enrollments_completed_at", "training_enrollments", ["completed_at"]
    )
    op.create_index(
        "ix_training_enrollments_enrollment_code",
        "training_enrollments",
        ["enrollment_code"],
        unique=True,
    )
    op.create_index(
        "ix_enrollments_course_status", "training_enrollments", ["course_id", "status"]
    )
    op.create_index(
        "ix_training_enrollments_created_at", "training_enrollments", ["created_at"]
    )

    op.create_table(
        "employment_records",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("trainee_id", sa.Uuid(), nullable=False),
        sa.Column("employer_id", sa.Uuid(), nullable=True),
        sa.Column("outcome_type", sa.String(length=32), nullable=False),
        sa.Column("status", sa.String(length=32), nullable=False),
        sa.Column("role", sa.String(length=160), nullable=True),
        sa.Column("company_name", sa.String(length=200), nullable=True),
        sa.Column("start_date", sa.Date(), nullable=True),
        sa.Column("ended_at", sa.Date(), nullable=True),
        sa.Column("is_current", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("wage_value", sa.Numeric(precision=12, scale=2), nullable=True),
        sa.Column("wage_band", sa.String(length=80), nullable=True),
        sa.Column("location", sa.String(length=200), nullable=True),
        sa.Column("business_type", sa.String(length=120), nullable=True),
        sa.Column("monthly_revenue", sa.Numeric(precision=14, scale=2), nullable=True),
        sa.Column("employees_created", sa.Integer(), nullable=True),
        sa.Column("exit_reason", sa.String(length=300), nullable=True),
        sa.Column(
            "submitted_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=NOW,
        ),
        sa.Column("employer_confirmed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("employer_verified_by_id", sa.Uuid(), nullable=True),
        sa.Column("rating", sa.Integer(), nullable=True),
        sa.Column("skill_alignment_feedback", JSON_TYPE, nullable=True),
        sa.Column("correction_notes", sa.Text(), nullable=True),
        *timestamps(),
        sa.CheckConstraint(
            "outcome_type in ('EMPLOYED', 'SELF_EMPLOYED', 'APPRENTICESHIP', 'SEEKING_JOB')",
            name="ck_employments_outcome_type",
        ),
        sa.CheckConstraint(
            "status in ('REPORTED', 'PENDING', 'VERIFIED', 'NEEDS_CORRECTION', 'REJECTED')",
            name="ck_employments_status",
        ),
        sa.CheckConstraint(
            "wage_value IS NULL OR wage_value >= 0",
            name="ck_employments_wage_nonnegative",
        ),
        sa.CheckConstraint(
            "monthly_revenue IS NULL OR monthly_revenue >= 0",
            name="ck_employments_revenue_nonnegative",
        ),
        sa.CheckConstraint(
            "employees_created IS NULL OR employees_created >= 0",
            name="ck_employments_employees_nonnegative",
        ),
        sa.CheckConstraint(
            "ended_at IS NULL OR start_date <= ended_at",
            name="ck_employments_employment_date_order",
        ),
        sa.ForeignKeyConstraint(
            ["employer_id"],
            ["employers.id"],
            name="fk_employments_employer_id_employers",
            ondelete="SET NULL",
        ),
        sa.ForeignKeyConstraint(
            ["employer_verified_by_id"],
            ["users.id"],
            name="fk_employments_verifier_id_users",
            ondelete="SET NULL",
        ),
        sa.ForeignKeyConstraint(
            ["trainee_id"],
            ["trainees.id"],
            name="fk_employments_trainee_id_trainees",
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id", name="pk_employment_records"),
    )
    op.create_index(
        "ix_employment_records_trainee_id", "employment_records", ["trainee_id"]
    )
    op.create_index(
        "ix_employment_records_employer_id", "employment_records", ["employer_id"]
    )
    op.create_index("ix_employment_records_role", "employment_records", ["role"])
    op.create_index(
        "ix_employment_records_company_name", "employment_records", ["company_name"]
    )
    op.create_index(
        "ix_employment_records_start_date", "employment_records", ["start_date"]
    )
    op.create_index(
        "ix_employments_employer_status",
        "employment_records",
        ["employer_id", "status"],
    )
    op.create_index(
        "ix_employments_trainee_current",
        "employment_records",
        ["trainee_id", "is_current"],
    )
    op.create_index(
        "ix_employment_records_created_at", "employment_records", ["created_at"]
    )

    op.create_table(
        "proofs",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("trainee_id", sa.Uuid(), nullable=False),
        sa.Column("employment_id", sa.Uuid(), nullable=True),
        sa.Column("original_filename", sa.String(length=255), nullable=False),
        sa.Column("stored_filename", sa.String(length=255), nullable=False),
        sa.Column("storage_path", sa.String(length=500), nullable=False),
        sa.Column("mime_type", sa.String(length=100), nullable=False),
        sa.Column("file_size", sa.Integer(), nullable=False),
        sa.Column("sha256", sa.String(length=64), nullable=False),
        sa.Column("status", sa.String(length=32), nullable=False),
        sa.Column("description", sa.String(length=500), nullable=True),
        sa.Column(
            "uploaded_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=NOW,
        ),
        sa.Column("verified_at", sa.DateTime(timezone=True), nullable=True),
        *timestamps(),
        sa.CheckConstraint("file_size > 0", name="ck_proofs_file_size_positive"),
        sa.CheckConstraint("file_size <= 52428800", name="ck_proofs_file_size_maximum"),
        sa.CheckConstraint(
            "status in ('UPLOADED', 'VERIFIED', 'REJECTED')", name="ck_proofs_status"
        ),
        sa.ForeignKeyConstraint(
            ["employment_id"],
            ["employment_records.id"],
            name="fk_proofs_employment_id_employments",
            ondelete="SET NULL",
        ),
        sa.ForeignKeyConstraint(
            ["trainee_id"],
            ["trainees.id"],
            name="fk_proofs_trainee_id_trainees",
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id", name="pk_proofs"),
        sa.UniqueConstraint("stored_filename", name="uq_proofs_stored_filename"),
    )
    op.create_index("ix_proofs_trainee_id", "proofs", ["trainee_id"])
    op.create_index("ix_proofs_employment_id", "proofs", ["employment_id"])
    op.create_index("ix_proofs_sha256", "proofs", ["sha256"])
    op.create_index("ix_proofs_created_at", "proofs", ["created_at"])

    op.create_table(
        "verification_records",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("employment_id", sa.Uuid(), nullable=False),
        sa.Column("verifier_id", sa.Uuid(), nullable=True),
        sa.Column("status", sa.String(length=32), nullable=False),
        sa.Column("rating", sa.Integer(), nullable=True),
        sa.Column("skill_alignment_feedback", JSON_TYPE, nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("evidence", JSON_TYPE, nullable=True),
        sa.Column("verified_at", sa.DateTime(timezone=True), nullable=True),
        *timestamps(),
        sa.CheckConstraint(
            "rating IS NULL OR (rating >= 1 AND rating <= 5)",
            name="ck_verifications_rating_range",
        ),
        sa.CheckConstraint(
            "status in ('REPORTED', 'PENDING', 'VERIFIED', 'NEEDS_CORRECTION', 'REJECTED')",
            name="ck_verifications_status",
        ),
        sa.ForeignKeyConstraint(
            ["employment_id"],
            ["employment_records.id"],
            name="fk_verifications_employment_id_employments",
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["verifier_id"],
            ["users.id"],
            name="fk_verifications_verifier_id_users",
            ondelete="SET NULL",
        ),
        sa.PrimaryKeyConstraint("id", name="pk_verification_records"),
    )
    op.create_index(
        "ix_verification_records_employment_id",
        "verification_records",
        ["employment_id"],
    )
    op.create_index(
        "ix_verification_records_verifier_id", "verification_records", ["verifier_id"]
    )
    op.create_index(
        "ix_verification_records_created_at", "verification_records", ["created_at"]
    )

    op.create_table(
        "followups",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("trainee_id", sa.Uuid(), nullable=False),
        sa.Column("employment_id", sa.Uuid(), nullable=True),
        sa.Column("created_by_id", sa.Uuid(), nullable=True),
        sa.Column("status", sa.String(length=32), nullable=False),
        sa.Column("scheduled_for", sa.Date(), nullable=False),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("contact_method", sa.String(length=40), nullable=True),
        sa.Column("contact_outcome", sa.String(length=300), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("next_followup_date", sa.Date(), nullable=True),
        *timestamps(),
        sa.CheckConstraint(
            "status in ('SCHEDULED', 'COMPLETED', 'CANCELLED')",
            name="ck_followups_status",
        ),
        sa.CheckConstraint(
            "completed_at IS NULL OR scheduled_for <= completed_at",
            name="ck_followups_followup_date_order",
        ),
        sa.ForeignKeyConstraint(
            ["created_by_id"],
            ["users.id"],
            name="fk_followups_creator_id_users",
            ondelete="SET NULL",
        ),
        sa.ForeignKeyConstraint(
            ["employment_id"],
            ["employment_records.id"],
            name="fk_followups_employment_id_employments",
            ondelete="SET NULL",
        ),
        sa.ForeignKeyConstraint(
            ["trainee_id"],
            ["trainees.id"],
            name="fk_followups_trainee_id_trainees",
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id", name="pk_followups"),
    )
    op.create_index("ix_followups_trainee_id", "followups", ["trainee_id"])
    op.create_index("ix_followups_employment_id", "followups", ["employment_id"])
    op.create_index("ix_followups_scheduled_for", "followups", ["scheduled_for"])
    op.create_index(
        "ix_followups_trainee_scheduled", "followups", ["trainee_id", "scheduled_for"]
    )
    op.create_index("ix_followups_created_at", "followups", ["created_at"])

    op.create_table(
        "job_postings_demand",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("employer_id", sa.Uuid(), nullable=True),
        sa.Column("posted_by_id", sa.Uuid(), nullable=True),
        sa.Column("title", sa.String(length=180), nullable=False),
        sa.Column("sector", sa.String(length=120), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("district", sa.String(length=100), nullable=False),
        sa.Column("skills_required", JSON_TYPE, nullable=False),
        sa.Column("headcount", sa.Integer(), nullable=False),
        sa.Column("min_monthly_wage", sa.Numeric(precision=12, scale=2), nullable=True),
        sa.Column("max_monthly_wage", sa.Numeric(precision=12, scale=2), nullable=True),
        sa.Column("work_mode", sa.String(length=50), nullable=True),
        sa.Column("status", sa.String(length=32), nullable=False),
        sa.Column(
            "posted_at", sa.DateTime(timezone=True), nullable=False, server_default=NOW
        ),
        sa.Column("closes_at", sa.Date(), nullable=True),
        *timestamps(),
        sa.CheckConstraint("headcount > 0", name="ck_demand_headcount_positive"),
        sa.CheckConstraint(
            "max_monthly_wage IS NULL OR min_monthly_wage IS NULL OR min_monthly_wage <= max_monthly_wage",
            name="ck_demand_demand_wage_order",
        ),
        sa.CheckConstraint("status in ('ACTIVE', 'CLOSED')", name="ck_demand_status"),
        sa.ForeignKeyConstraint(
            ["employer_id"],
            ["employers.id"],
            name="fk_demand_employer_id_employers",
            ondelete="SET NULL",
        ),
        sa.ForeignKeyConstraint(
            ["posted_by_id"],
            ["users.id"],
            name="fk_demand_poster_id_users",
            ondelete="SET NULL",
        ),
        sa.PrimaryKeyConstraint("id", name="pk_job_postings_demand"),
    )
    op.create_index(
        "ix_job_postings_demand_employer_id", "job_postings_demand", ["employer_id"]
    )
    op.create_index("ix_job_postings_demand_sector", "job_postings_demand", ["sector"])
    op.create_index(
        "ix_job_postings_demand_district", "job_postings_demand", ["district"]
    )
    op.create_index(
        "ix_demand_sector_district_status",
        "job_postings_demand",
        ["sector", "district", "status"],
    )
    op.create_index(
        "ix_job_postings_demand_created_at", "job_postings_demand", ["created_at"]
    )

    op.create_table(
        "audit_logs",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("actor_id", sa.Uuid(), nullable=True),
        sa.Column("action", sa.String(length=100), nullable=False),
        sa.Column("entity_type", sa.String(length=100), nullable=False),
        sa.Column("entity_id", sa.String(length=100), nullable=True),
        sa.Column("details", JSON_TYPE, nullable=True),
        sa.Column("ip_address", sa.String(length=64), nullable=True),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), nullable=False, server_default=NOW
        ),
        sa.CheckConstraint(
            "created_at IS NOT NULL", name="ck_audit_created_at_required"
        ),
        sa.ForeignKeyConstraint(
            ["actor_id"],
            ["users.id"],
            name="fk_audit_actor_id_users",
            ondelete="SET NULL",
        ),
        sa.PrimaryKeyConstraint("id", name="pk_audit_logs"),
    )
    op.create_index("ix_audit_logs_actor_id", "audit_logs", ["actor_id"])
    op.create_index("ix_audit_logs_action", "audit_logs", ["action"])
    op.create_index("ix_audit_entity", "audit_logs", ["entity_type", "entity_id"])
    op.create_index("ix_audit_logs_created_at", "audit_logs", ["created_at"])


def downgrade() -> None:
    op.drop_table("audit_logs")
    op.drop_table("job_postings_demand")
    op.drop_table("followups")
    op.drop_table("verification_records")
    op.drop_table("proofs")
    op.drop_table("employment_records")
    op.drop_table("training_enrollments")
    op.drop_table("trainees")
    op.drop_table("employers")
    op.drop_table("courses")
    op.drop_table("users")
