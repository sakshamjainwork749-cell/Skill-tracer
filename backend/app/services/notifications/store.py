from __future__ import annotations

from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import Notification, User
from app.models.enums import UserRole


def notify(
    db: Session,
    user_id: UUID,
    type: str,
    title: str,
    body: str,
) -> Notification:
    """Create a user-visible notification. Server-side only."""
    notification = Notification(
        user_id=user_id,
        type=type,
        title=title[:160],
        body=body[:500],
    )
    db.add(notification)
    db.flush()
    return notification


def notify_admins(db: Session, type: str, title: str, body: str) -> None:
    """Fan out an operational event to all active government admins."""
    admin_ids = db.scalars(
        select(User.id).where(User.role == UserRole.GOVERNMENT_ADMIN,
                              User.is_active.is_(True))
    ).all()
    for admin_id in admin_ids:
        notify(db, admin_id, type, title, body)
