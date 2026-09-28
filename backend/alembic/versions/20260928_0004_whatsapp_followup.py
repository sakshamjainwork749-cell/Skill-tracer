"""WhatsApp follow-up columns + RESPONDED status.

Revision ID: 20260928_0004
Revises: 20260927_0003
Create Date: 2026-09-28
"""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "20260928_0004"
down_revision: str | None = "20260927_0003"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

FOLLOWUP_STATUSES = (
    "SCHEDULED",
    "SENT",
    "DELIVERED",
    "RESPONDED",
    "FAILED",
    "COMPLETED",
    "CANCELLED",
)


def _add_column_if_missing(table: str, column: sa.Column) -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    existing = {col["name"] for col in inspector.get_columns(table)}
    if column.name not in existing:
        op.add_column(table, column)


def _refresh_status_check() -> None:
    bind = op.get_bind()
    if bind.dialect.name == "postgresql":
        op.execute(
            """
            DO $$ DECLARE r record; BEGIN
              FOR r IN SELECT conname FROM pg_constraint
                WHERE conrelid = 'followups'::regclass AND contype = 'c'
                AND pg_get_constraintdef(oid) LIKE '%SCHEDULED%' LOOP
                EXECUTE format('ALTER TABLE followups DROP CONSTRAINT %I', r.conname);
              END LOOP;
            END $$;
            """
        )
        op.create_check_constraint(
            "ck_followups_followup_status",
            "followups",
            sa.text(
                "status IN ('SCHEDULED', 'SENT', 'DELIVERED', 'RESPONDED', "
                "'FAILED', 'COMPLETED', 'CANCELLED')"
            ),
        )
    else:
        # SQLite cannot drop a CHECK; rebuild the table with the widened set.
        # NOTE: batch mode applies the ck naming convention, so the bare
        # column-derived name is used here (not the full constraint name).
        with op.batch_alter_table("followups", recreate="always") as batch:
            batch.drop_constraint("followup_status", type_="check")
            batch.create_check_constraint(
                "ck_followups_followup_status",
                sa.text(
                    "status IN ('SCHEDULED', 'SENT', 'DELIVERED', 'RESPONDED', "
                    "'FAILED', 'COMPLETED', 'CANCELLED')"
                ),
            )


def upgrade() -> None:
    _add_column_if_missing("followups", sa.Column("template", sa.String(length=40), nullable=True))
    _add_column_if_missing("followups", sa.Column("response", sa.String(length=40), nullable=True))
    _add_column_if_missing("followups", sa.Column("responded_at", sa.DateTime(timezone=True), nullable=True))
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    try:
        existing_indexes = {idx["name"] for idx in inspector.get_indexes("followups")}
    except Exception:
        existing_indexes = set()
    if "ix_followups_trainee_channel" not in existing_indexes:
        op.create_index("ix_followups_trainee_channel", "followups", ["trainee_id", "channel"])
    _refresh_status_check()


def downgrade() -> None:
    bind = op.get_bind()
    if bind.dialect.name == "postgresql":
        op.execute("ALTER TABLE followups DROP CONSTRAINT IF EXISTS ck_followups_followup_status")
    op.drop_index("ix_followups_trainee_channel", table_name="followups")
    op.drop_column("followups", "responded_at")
    op.drop_column("followups", "response")
    op.drop_column("followups", "template")
