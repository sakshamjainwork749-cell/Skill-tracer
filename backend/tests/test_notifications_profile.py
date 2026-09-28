from fastapi.testclient import TestClient
from sqlalchemy import select

from app.db.session import SessionLocal
from app.models import EmploymentRecord, Notification, Trainee, User


def _cleanup_test_outcome(role: str = "CNC Operator") -> None:
    """Remove the outcome created by the notification test and restore the
    seeded current outcome, so later tests see the pristine demo journey."""
    db = SessionLocal()
    try:
        trainee_id = db.scalar(
            select(Trainee.id).join(User, Trainee.user_id == User.id).where(
                User.email == "trainee@skilltrace.in"
            )
        )
        created = db.scalar(
            select(EmploymentRecord)
            .where(EmploymentRecord.trainee_id == trainee_id,
                   EmploymentRecord.role == role)
            .order_by(EmploymentRecord.submitted_at.desc())
            .limit(1)
        )
        if created is not None:
            db.query(Notification).filter(
                Notification.user_id == created.trainee.user_id
            ).delete(synchronize_session=False)
            db.delete(created)
            db.flush()
            previous = db.scalar(
                select(EmploymentRecord)
                .where(EmploymentRecord.trainee_id == trainee_id)
                .order_by(EmploymentRecord.submitted_at.desc())
                .limit(1)
            )
            if previous is not None:
                previous.is_current = True
                previous.ended_at = None
        db.commit()
    finally:
        db.close()


def test_notifications_created_on_outcome_and_read_flow(
    client: TestClient, auth_headers
):
    trainee = auth_headers("trainee@skilltrace.in")
    response = client.post(
        "/api/v1/trainees/me/outcomes",
        json={
            "outcome_type": "EMPLOYED",
            "role": "CNC Operator",
            "company_name": "Sahyadri Precision Tools Pvt Ltd",
            "start_date": "2026-09-10",
            "wage_value": 21000,
        },
        headers=trainee,
    )
    assert response.status_code in (200, 201), response.text

    try:
        listing = client.get("/api/v1/notifications", headers=trainee)
        assert listing.status_code == 200
        data = listing.json()["data"]
        assert data["unread_count"] >= 1
        unread = [n for n in data["notifications"] if not n["is_read"]]
        assert unread

        read = client.patch(
            f"/api/v1/notifications/{unread[0]['id']}/read", headers=trainee
        )
        assert read.status_code == 200
        assert read.json()["data"]["is_read"] is True

        again = client.get("/api/v1/notifications", headers=trainee)
        assert again.json()["data"]["unread_count"] == data["unread_count"] - 1
    finally:
        _cleanup_test_outcome()


def test_notifications_require_auth(client: TestClient):
    assert client.get("/api/v1/notifications").status_code in (401, 403)


def test_notification_read_is_scoped_to_owner(
    client: TestClient, auth_headers
):
    trainee = auth_headers("trainee@skilltrace.in")
    created = client.post(
        "/api/v1/trainees/me/outcomes",
        json={
            "outcome_type": "EMPLOYED",
            "role": "CNC Operator",
            "company_name": "Sahyadri Precision Tools Pvt Ltd",
            "start_date": "2026-09-10",
            "wage_value": 21000,
        },
        headers=trainee,
    )
    assert created.status_code in (200, 201), created.text
    try:
        listing = client.get("/api/v1/notifications", headers=trainee)
        rows = listing.json()["data"]["notifications"]
        assert rows
        employer = auth_headers("employer@skilltrace.in")
        response = client.patch(
            f"/api/v1/notifications/{rows[0]['id']}/read", headers=employer
        )
        assert response.status_code == 404
    finally:
        _cleanup_test_outcome()


def test_profile_update_persists_and_protects_identity(
    client: TestClient, auth_headers
):
    trainee = auth_headers("trainee@skilltrace.in")
    before = client.get("/api/v1/trainees/me/passport", headers=trainee).json()["data"]["trainee"]
    original = {
        "full_name": before["full_name"],
        "phone": before["phone"] or "",
        "district": before["district"],
        "address": before["address"] or "",
    }
    response = client.patch(
        "/api/v1/trainees/me/profile",
        json={"full_name": "Test Name", "phone": "+91 90000 00001",
              "district": "Pune", "address": "Test address"},
        headers=trainee,
    )
    assert response.status_code == 200, response.text
    data = response.json()["data"]
    assert data["full_name"] == "Test Name"
    assert data["phone"] == "+91 90000 00001"
    assert data["email"] == "trainee@skilltrace.in"

    forbidden = client.patch(
        "/api/v1/trainees/me/profile",
        json={"email": "hacker@example.in"},
        headers=trainee,
    )
    assert forbidden.status_code == 422

    restore = client.patch(
        "/api/v1/trainees/me/profile",
        json=original,
        headers=trainee,
    )
    assert restore.status_code == 200
    assert restore.json()["data"]["full_name"] == original["full_name"]


def test_profile_update_requires_trainee_role(client: TestClient, auth_headers):
    employer = auth_headers("employer@skilltrace.in")
    response = client.patch(
        "/api/v1/trainees/me/profile",
        json={"full_name": "Nope"},
        headers=employer,
    )
    assert response.status_code == 403
