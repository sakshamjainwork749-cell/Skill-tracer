"""Secure, expiring access tokens for existing follow-up rows.

Revision ID: 20260930_0006
Revises: 20260929_0005
"""
from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "20260930_0006"
down_revision: str | None = "20260929_0005"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def _add_column_if_missing(column: sa.Column) -> None:
    inspector = sa.inspect(op.get_bind())
    if column.name not in {item["name"] for item in inspector.get_columns("followups")}:
        op.add_column("followups", column)


def upgrade() -> None:
    _add_column_if_missing(sa.Column("access_token_hash", sa.String(length=64), nullable=True))
    _add_column_if_missing(sa.Column("access_token_expires_at", sa.DateTime(timezone=True), nullable=True))
    _add_column_if_missing(sa.Column("accessed_at", sa.DateTime(timezone=True), nullable=True))
    inspector = sa.inspect(op.get_bind())
    if "ix_followups_access_token_hash" not in {item["name"] for item in inspector.get_indexes("followups")}:
        op.create_index("ix_followups_access_token_hash", "followups", ["access_token_hash"])


def downgrade() -> None:
    op.drop_index("ix_followups_access_token_hash", table_name="followups")
    op.drop_column("followups", "accessed_at")
    op.drop_column("followups", "access_token_expires_at")
    op.drop_column("followups", "access_token_hash")
