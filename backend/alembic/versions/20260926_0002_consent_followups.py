"""Trainee consent preferences + follow-up delivery fields.

Revision ID: 20260926_0002
Revises: 20260925_0001
Create Date: 2026-09-26
"""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "20260926_0002"
down_revision: str | None = "20260925_0001"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def _add_column_if_missing(table: str, column: sa.Column) -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    existing = {col["name"] for col in inspector.get_columns(table)}
    if column.name not in existing:
        op.add_column(table, column)


def upgrade() -> None:
    _add_column_if_missing(
        "trainees",
        sa.Column("employer_verification_consent", sa.Boolean(), nullable=False,
                  server_default=sa.false()),
    )
    _add_column_if_missing(
        "trainees",
        sa.Column("followup_consent", sa.Boolean(), nullable=False,
                  server_default=sa.false()),
    )
    _add_column_if_missing(
        "trainees",
        sa.Column("email_followup_consent", sa.Boolean(), nullable=False,
                  server_default=sa.false()),
    )
    _add_column_if_missing(
        "trainees",
        sa.Column("whatsapp_followup_consent", sa.Boolean(), nullable=False,
                  server_default=sa.false()),
    )
    for name, coltype in (
        ("channel", sa.String(length=20)),
        ("message_template", sa.String(length=120)),
        ("provider_message_id", sa.String(length=160)),
        ("last_error", sa.String(length=500)),
    ):
        _add_column_if_missing("followups", sa.Column(name, coltype, nullable=True))
    _add_column_if_missing(
        "followups",
        sa.Column("attempt_count", sa.Integer(), nullable=False, server_default="0"),
    )
    for name in ("sent_at", "delivered_at", "failed_at"):
        _add_column_if_missing(
            "followups", sa.Column(name, sa.DateTime(timezone=True), nullable=True)
        )
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    indexes = {idx["name"] for idx in inspector.get_indexes("followups")}
    if "ix_followups_status_scheduled" not in indexes:
        op.create_index("ix_followups_status_scheduled", "followups",
                        ["status", "scheduled_for"])


def downgrade() -> None:
    op.drop_index("ix_followups_status_scheduled", table_name="followups")
    for name in ("channel", "message_template", "attempt_count", "sent_at",
                 "delivered_at", "failed_at", "provider_message_id", "last_error"):
        op.drop_column("followups", name)
    for name in ("employer_verification_consent", "followup_consent",
                 "email_followup_consent", "whatsapp_followup_consent"):
        op.drop_column("trainees", name)
