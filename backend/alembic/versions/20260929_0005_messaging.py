"""Bulk messaging: templates, campaigns, jobs, automation rules.

Revision ID: 20260929_0005
Revises: 20260928_0004
Create Date: 2026-09-29
"""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "20260929_0005"
down_revision: str | None = "20260928_0004"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def _table_exists(name: str) -> bool:
    return name in sa.inspect(op.get_bind()).get_table_names()


def upgrade() -> None:
    if not _table_exists("message_templates"):
        op.create_table(
            "message_templates",
            sa.Column("id", sa.Uuid(), nullable=False),
            sa.Column("name", sa.String(length=160), nullable=False),
            sa.Column("template_key", sa.String(length=80), nullable=False),
            sa.Column("channel", sa.String(length=20), nullable=False, server_default="WHATSAPP"),
            sa.Column("body", sa.Text(), nullable=False),
            sa.Column("variables", sa.JSON(), nullable=False, server_default="[]"),
            sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.false()),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
            sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
            sa.PrimaryKeyConstraint("id"),
            sa.UniqueConstraint("template_key", name="uq_message_templates_key"),
        )
        op.create_index("ix_message_templates_key", "message_templates", ["template_key"])
    if not _table_exists("messaging_campaigns"):
        op.create_table(
            "messaging_campaigns",
            sa.Column("id", sa.Uuid(), nullable=False),
            sa.Column("name", sa.String(length=160), nullable=False),
            sa.Column("template_id", sa.Uuid(), nullable=True),
            sa.Column("audience_filter", sa.JSON(), nullable=True),
            sa.Column("channel", sa.String(length=20), nullable=False, server_default="WHATSAPP"),
            sa.Column("status", sa.String(length=32), nullable=False, server_default="DRAFT"),
            sa.Column("scheduled_at", sa.DateTime(timezone=True), nullable=True),
            sa.Column("created_by_id", sa.Uuid(), nullable=True),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
            sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
            sa.ForeignKeyConstraint(["template_id"], ["message_templates.id"], ondelete="SET NULL"),
            sa.ForeignKeyConstraint(["created_by_id"], ["users.id"], ondelete="SET NULL"),
            sa.PrimaryKeyConstraint("id"),
        )
        op.create_index("ix_campaigns_status_scheduled", "messaging_campaigns", ["status", "scheduled_at"])
    if not _table_exists("message_jobs"):
        op.create_table(
            "message_jobs",
            sa.Column("id", sa.Uuid(), nullable=False),
            sa.Column("campaign_id", sa.Uuid(), nullable=True),
            sa.Column("trainee_id", sa.Uuid(), nullable=True),
            sa.Column("template_id", sa.Uuid(), nullable=True),
            sa.Column("channel", sa.String(length=20), nullable=False, server_default="WHATSAPP"),
            sa.Column("scheduled_at", sa.DateTime(timezone=True), nullable=True),
            sa.Column("status", sa.String(length=32), nullable=False, server_default="QUEUED"),
            sa.Column("simulated", sa.Boolean(), nullable=False, server_default=sa.false()),
            sa.Column("rendered_body", sa.Text(), nullable=True),
            sa.Column("provider_message_id", sa.String(length=160), nullable=True),
            sa.Column("attempt_count", sa.Integer(), nullable=False, server_default="0"),
            sa.Column("last_error", sa.String(length=500), nullable=True),
            sa.Column("sent_at", sa.DateTime(timezone=True), nullable=True),
            sa.Column("delivered_at", sa.DateTime(timezone=True), nullable=True),
            sa.Column("read_at", sa.DateTime(timezone=True), nullable=True),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
            sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
            sa.ForeignKeyConstraint(["campaign_id"], ["messaging_campaigns.id"], ondelete="SET NULL"),
            sa.ForeignKeyConstraint(["trainee_id"], ["trainees.id"], ondelete="SET NULL"),
            sa.ForeignKeyConstraint(["template_id"], ["message_templates.id"], ondelete="SET NULL"),
            sa.PrimaryKeyConstraint("id"),
        )
        op.create_index("ix_message_jobs_status_scheduled", "message_jobs", ["status", "scheduled_at"])
        op.create_index("ix_message_jobs_campaign", "message_jobs", ["campaign_id"])
        op.create_index("ix_message_jobs_trainee", "message_jobs", ["trainee_id"])
    if not _table_exists("automation_rules"):
        op.create_table(
            "automation_rules",
            sa.Column("id", sa.Uuid(), nullable=False),
            sa.Column("name", sa.String(length=160), nullable=False),
            sa.Column("trigger_type", sa.String(length=40), nullable=False, server_default="OUTCOME_SUBMITTED"),
            sa.Column("delay_days", sa.JSON(), nullable=False, server_default="[]"),
            sa.Column("template_id", sa.Uuid(), nullable=True),
            sa.Column("audience_filter", sa.JSON(), nullable=True),
            sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.true()),
            sa.Column("created_by_id", sa.Uuid(), nullable=True),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
            sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
            sa.ForeignKeyConstraint(["template_id"], ["message_templates.id"], ondelete="SET NULL"),
            sa.ForeignKeyConstraint(["created_by_id"], ["users.id"], ondelete="SET NULL"),
            sa.PrimaryKeyConstraint("id"),
        )
        op.create_index("ix_automation_trigger_active", "automation_rules", ["trigger_type", "is_active"])


def downgrade() -> None:
    op.drop_table("automation_rules")
    op.drop_table("message_jobs")
    op.drop_table("messaging_campaigns")
    op.drop_table("message_templates")
