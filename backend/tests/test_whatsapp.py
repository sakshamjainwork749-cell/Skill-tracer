import os

from fastapi.testclient import TestClient
from sqlalchemy import select

from app.core.config import get_settings
from app.db.session import SessionLocal
from app.models import EmploymentRecord, Followup, Notification, Trainee, User
from app.services.whatsapp_templates import (
    normalize_phone,
    parse_response,
    render_template,
    wa_link,
)


def _trainee_ids(email: str):
    db = SessionLocal()
    try:
        trainee_id = db.scalar(
            select(Trainee.id).join(User, Trainee.user_id == User.id).where(
                User.email == email
            )
        )
        user_id = db.scalar(select(User.id).where(User.email == email))
        return trainee_id, user_id
    finally:
        db.close()


def test_template_helpers():
    assert "1. Yes" in render_template("day_30", "Rahul")
    assert "Rahul" in render_template("day_60", "Rahul Sharma")
    assert "SkillTrace follow-up" in render_template("day_90", "R")
    assert normalize_phone("+91 98765 12001") == "919876512001"
    assert normalize_phone("123") is None
    assert normalize_phone(None) is None
    assert wa_link("919876512001", "hi there").startswith("https://wa.me/919876512001?text=")
    assert parse_response("1") == "YES"
    assert parse_response("YES") == "YES"
    assert parse_response("self-employed") == "SELF_EMPLOYED"
    assert parse_response("Apprenticeship") == "APPRENTICESHIP"
    assert parse_response("changed employer") == "CHANGED_JOB"
    assert parse_response("maybe later") is None
    assert parse_response(None) is None


def test_whatsapp_scheduling_gated_by_consent(client: TestClient, auth_headers):
    trainee = auth_headers("trainee@skilltrace.in")
    # Ensure opt-in for this test, restore afterwards.
    before = client.get("/api/v1/trainees/me/passport", headers=trainee).json()["data"]["trainee"]
    had_consent = before["whatsapp_followup_consent"]
    client.patch("/api/v1/trainees/me/consent",
                 json={"whatsapp_followup_consent": True}, headers=trainee)
    try:
        response = client.post(
            "/api/v1/trainees/me/outcomes",
            json={"outcome_type": "EMPLOYED", "role": "WA Sched Role",
                  "company_name": "Sahyadri Precision Tools Pvt Ltd",
                  "start_date": "2026-09-10", "wage_value": 21000},
            headers=trainee,
        )
        assert response.status_code in (200, 201), response.text
        listing = client.get("/api/v1/trainees/me/followups", headers=trainee).json()["data"]
        wa_rows = [f for f in listing
                   if f["channel"] == "WHATSAPP" and f["template"] in ("day_30", "day_60", "day_90")]
        assert len(wa_rows) == 3, [ (f["template"], f["scheduled_for"]) for f in listing ]
        templates = sorted(f["template"] for f in wa_rows)
        assert templates == ["day_30", "day_60", "day_90"]
    finally:
        _cleanup_outcome("WA Sched Role")
        client.patch("/api/v1/trainees/me/consent",
                     json={"whatsapp_followup_consent": had_consent}, headers=trainee)


def test_whatsapp_not_scheduled_without_consent(client: TestClient, auth_headers):
    trainee = auth_headers("trainee@skilltrace.in")
    client.patch("/api/v1/trainees/me/consent",
                 json={"whatsapp_followup_consent": False}, headers=trainee)
    try:
        response = client.post(
            "/api/v1/trainees/me/outcomes",
            json={"outcome_type": "EMPLOYED", "role": "WA NoConsent Role",
                  "company_name": "Sahyadri Precision Tools Pvt Ltd",
                  "start_date": "2026-09-10", "wage_value": 21000},
            headers=trainee,
        )
        assert response.status_code in (200, 201), response.text
        listing = client.get("/api/v1/trainees/me/followups", headers=trainee).json()["data"]
        assert [f for f in listing if f["channel"] == "WHATSAPP" and f["template"]] == []
    finally:
        _cleanup_outcome("WA NoConsent Role")


def test_demo_message_requires_consent_and_phone(client: TestClient, auth_headers):
    trainee = auth_headers("trainee@skilltrace.in")
    client.patch("/api/v1/trainees/me/consent",
                 json={"whatsapp_followup_consent": False}, headers=trainee)
    denied = client.post("/api/v1/trainees/me/followups/demo-message", headers=trainee)
    assert denied.status_code == 403, denied.text

    client.patch("/api/v1/trainees/me/consent",
                 json={"whatsapp_followup_consent": True}, headers=trainee)
    try:
        response = client.post("/api/v1/trainees/me/followups/demo-message", headers=trainee)
        assert response.status_code == 200, response.text
        data = response.json()["data"]
        assert data["sent"] is False
        assert data["wa_link"].startswith("https://wa.me/")
        assert "Are you currently employed?" in data["message"]
        assert data["provider"] == "demo"
        assert "nothing was sent" in data["notice"].casefold() or "Nothing was sent" in data["notice"]
    finally:
        client.patch("/api/v1/trainees/me/consent",
                     json={"whatsapp_followup_consent": False}, headers=trainee)


def test_webhook_secret_gating_and_reply_flow(client: TestClient, auth_headers):
    # No secret configured in test env -> always 403.
    denied = client.post("/api/v1/webhooks/whatsapp",
                         json={"sender": "+919876512001", "text": "YES"})
    assert denied.status_code == 403

    trainee = auth_headers("trainee@skilltrace.in")
    client.patch("/api/v1/trainees/me/consent",
                 json={"whatsapp_followup_consent": True}, headers=trainee)
    created = client.post(
        "/api/v1/trainees/me/outcomes",
        json={"outcome_type": "EMPLOYED", "role": "WA Hook Role",
              "company_name": "Sahyadri Precision Tools Pvt Ltd",
              "start_date": "2026-09-10", "wage_value": 21000},
        headers=trainee,
    )
    assert created.status_code in (200, 201), created.text

    # Enable the webhook with a temporary secret (restored afterwards).
    os.environ["WHATSAPP_WEBHOOK_SECRET"] = "test-secret"
    get_settings.cache_clear()
    try:
        wrong = client.post("/api/v1/webhooks/whatsapp",
                            json={"sender": "+919876512001", "text": "YES"},
                            headers={"x-webhook-secret": "nope"})
        assert wrong.status_code == 403, wrong.text

        ok = client.post("/api/v1/webhooks/whatsapp",
                         json={"sender": "+91 98765 12001", "text": "YES"},
                         headers={"x-webhook-secret": "test-secret"})
        assert ok.status_code == 200, ok.text
        assert ok.json()["data"] == {"recorded": True, "response": "YES"}

        listing = client.get("/api/v1/trainees/me/followups", headers=trainee).json()["data"]
        responded = [f for f in listing if f["response"] == "YES"]
        assert responded and responded[0]["status"] == "RESPONDED"

        unknown = client.post("/api/v1/webhooks/whatsapp",
                              json={"sender": "+91 98765 12001", "text": "maybe later"},
                              headers={"x-webhook-secret": "test-secret"})
        assert unknown.status_code == 200
        assert unknown.json()["data"]["recorded"] is False
    finally:
        del os.environ["WHATSAPP_WEBHOOK_SECRET"]
        get_settings.cache_clear()
        _cleanup_outcome("WA Hook Role")
        client.patch("/api/v1/trainees/me/consent",
                     json={"whatsapp_followup_consent": False}, headers=trainee)


def test_followup_table_has_whatsapp_columns():
    from sqlalchemy import text as sa_text

    db = SessionLocal()
    try:
        ddl = db.execute(
            sa_text("SELECT sql FROM sqlite_master WHERE name='followups'")
        ).scalar()
        assert "template" in ddl and "responded_at" in ddl
        assert "RESPONDED" in ddl
    finally:
        db.close()


def _cleanup_outcome(role: str) -> None:
    db = SessionLocal()
    try:
        trainee_id, user_id = db.execute(
            select(Trainee.id, User.id).join(User, Trainee.user_id == User.id).where(
                User.email == "trainee@skilltrace.in"
            )
        ).fetchone()
        created = db.scalar(
            select(EmploymentRecord)
            .where(EmploymentRecord.trainee_id == trainee_id,
                   EmploymentRecord.role == role)
            .order_by(EmploymentRecord.submitted_at.desc())
            .limit(1)
        )
        if created is not None:
            db.query(Followup).filter(Followup.employment_id == created.id).delete(
                synchronize_session=False)
            db.query(Followup).filter(
                Followup.trainee_id == trainee_id,
                Followup.template.is_not(None),
                Followup.status == "SCHEDULED",
            ).delete(synchronize_session=False)
            db.query(Notification).filter(Notification.user_id == user_id).delete(
                synchronize_session=False)
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
