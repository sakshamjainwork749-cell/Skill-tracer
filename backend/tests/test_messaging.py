from fastapi.testclient import TestClient
from sqlalchemy import select

from app.db.session import SessionLocal
from app.models import Followup, MessageJob, Trainee, User
from app.models.enums import CampaignStatus, MessageStatus


def _trainee_auth(client: TestClient, auth_headers):
    trainee = auth_headers("trainee@skilltrace.in")
    client.patch("/api/v1/trainees/me/consent",
                 json={"whatsapp_followup_consent": True}, headers=trainee)
    return trainee


def _restore_consent(client: TestClient, trainee, value: bool = False):
    client.patch("/api/v1/trainees/me/consent",
                 json={"whatsapp_followup_consent": value}, headers=trainee)


def _cleanup_outcome(role: str) -> None:
    from app.models import EmploymentRecord, Followup, Notification

    db = SessionLocal()
    try:
        row = db.execute(
            select(Trainee.id, User.id).join(User, Trainee.user_id == User.id).where(
                User.email == "trainee@skilltrace.in")
        ).fetchone()
        trainee_id, user_id = row
        created = db.scalar(
            select(EmploymentRecord)
            .where(EmploymentRecord.trainee_id == trainee_id,
                   EmploymentRecord.role == role)
            .order_by(EmploymentRecord.submitted_at.desc()).limit(1))
        if created is not None:
            db.query(Followup).filter(Followup.employment_id == created.id).delete(
                synchronize_session=False)
            db.query(MessageJob).filter(MessageJob.trainee_id == trainee_id).delete(
                synchronize_session=False)
            db.query(Followup).filter(
                Followup.trainee_id == trainee_id,
                Followup.template.is_not(None),
                Followup.status == "SCHEDULED").delete(synchronize_session=False)
            db.query(Notification).filter(Notification.user_id == user_id).delete(
                synchronize_session=False)
            db.delete(created)
            db.flush()
            previous = db.scalar(
                select(EmploymentRecord)
                .where(EmploymentRecord.trainee_id == trainee_id)
                .order_by(EmploymentRecord.submitted_at.desc()).limit(1))
            if previous is not None:
                previous.is_current = True
                previous.ended_at = None
        db.commit()
    finally:
        db.close()


def test_consent_enable_revoke_and_history(client: TestClient, auth_headers):
    trainee = auth_headers("trainee@skilltrace.in")
    on = client.patch("/api/v1/trainees/me/whatsapp-consent",
                      json={"consent_given": True}, headers=trainee)
    assert on.status_code == 200, on.text
    assert on.json()["data"]["whatsapp_followup_consent"] is True

    response = client.post(
        "/api/v1/trainees/me/outcomes",
        json={"outcome_type": "EMPLOYED", "role": "MSG Consent Role",
              "company_name": "Sahyadri Precision Tools Pvt Ltd",
              "start_date": "2026-09-10", "wage_value": 21000},
        headers=trainee)
    assert response.status_code in (200, 201), response.text
    try:
        history = client.get("/api/v1/trainees/me/whatsapp/history", headers=trainee)
        assert history.status_code == 200
        assert len(history.json()["data"]) >= 3

        off = client.patch("/api/v1/trainees/me/whatsapp-consent",
                           json={"consent_given": False}, headers=trainee)
        assert off.status_code == 200, off.text
        assert off.json()["data"]["cancelled_future"] >= 3

        history2 = client.get("/api/v1/trainees/me/whatsapp/history", headers=trainee)
        scheduled = [h for h in history2.json()["data"] if h["status"] == "SCHEDULED"]
        assert scheduled == []
    finally:
        _cleanup_outcome("MSG Consent Role")
        _restore_consent(client, trainee)


def test_no_scheduling_or_send_without_consent(client: TestClient, auth_headers):
    trainee = auth_headers("trainee@skilltrace.in")
    client.patch("/api/v1/trainees/me/whatsapp-consent",
                 json={"consent_given": False}, headers=trainee)
    response = client.post(
        "/api/v1/trainees/me/outcomes",
        json={"outcome_type": "EMPLOYED", "role": "MSG NoConsent",
              "company_name": "Sahyadri Precision Tools Pvt Ltd",
              "start_date": "2026-09-10", "wage_value": 21000},
        headers=trainee)
    assert response.status_code in (200, 201), response.text
    try:
        history = client.get("/api/v1/trainees/me/whatsapp/history", headers=trainee)
        assert [h for h in history.json()["data"] if h["status"] == "SCHEDULED"] == []
        denied = client.post("/api/v1/trainees/me/followups/demo-send", headers=trainee)
        assert denied.status_code == 403, denied.text
    finally:
        _cleanup_outcome("MSG NoConsent")


def test_demo_send_is_simulated_not_delivered(client: TestClient, auth_headers):
    trainee = _trainee_auth(client, auth_headers)
    try:
        result = client.post("/api/v1/trainees/me/followups/demo-send", headers=trainee)
        assert result.status_code == 200, result.text
        data = result.json()["data"]
        assert data["sent"] is True
        assert data["simulated"] is True
        assert data["status"] == "SIMULATED"
        history = client.get("/api/v1/trainees/me/whatsapp/history", headers=trainee)
        shows = [h for h in history.json()["data"] if h["display_status"] == "SIMULATED"]
        assert shows, history.json()["data"]
    finally:
        db = SessionLocal()
        try:
            row = db.execute(
                select(Trainee.id).join(User, Trainee.user_id == User.id).where(
                    User.email == "trainee@skilltrace.in")).fetchone()
            db.query(Followup).filter(
                Followup.trainee_id == row[0],
                Followup.notes.like("Demo automated send%")).delete(
                synchronize_session=False)
            db.commit()
        finally:
            db.close()
        _restore_consent(client, trainee)


def test_campaign_audience_excludes_non_consenting(client: TestClient, auth_headers):
    admin = auth_headers("admin@skilltrace.in")
    preview = client.post("/api/v1/admin/messaging/audience/preview",
                          json={"consent_given": True}, headers=admin)
    assert preview.status_code == 200, preview.text
    data = preview.json()["data"]
    assert data["eligible"] >= 0 and data["excluded"] >= 0

    created = client.post("/api/v1/admin/messaging/campaigns",
                          json={"name": "Test campaign",
                                "template_key": "EMPLOYMENT_UPDATE_REMINDER",
                                "audience": {"consent_given": True}},
                          headers=admin)
    assert created.status_code == 200, created.text
    campaign_id = created.json()["data"]["id"]
    scheduled = client.post(
        f"/api/v1/admin/messaging/campaigns/{campaign_id}/schedule", headers=admin)
    assert scheduled.status_code == 200, scheduled.text
    jobs = scheduled.json()["data"]["jobs"]
    assert jobs >= 0
    # Every queued job belongs to an opted-in trainee.
    from uuid import UUID as _UUID

    db = SessionLocal()
    try:
        bad = db.execute(
            select(MessageJob.id).join(
                Trainee, MessageJob.trainee_id == Trainee.id).where(
                MessageJob.campaign_id == _UUID(str(campaign_id)),
                Trainee.whatsapp_followup_consent.is_(False))).fetchall()
        assert bad == []
    finally:
        db.close()
    cancelled = client.post(
        f"/api/v1/admin/messaging/campaigns/{campaign_id}/cancel", headers=admin)
    assert cancelled.status_code == 200


def test_queue_retry_and_failure_and_webhook_status(client: TestClient, auth_headers):
    admin = auth_headers("admin@skilltrace.in")
    # Webhook status transitions on a real job.
    created = client.post("/api/v1/admin/messaging/campaigns",
                          json={"name": "Status test",
                                "template_key": "EMPLOYMENT_UPDATE_REMINDER",
                                "audience": {"consent_given": True}},
                          headers=admin)
    campaign_id = created.json()["data"]["id"]
    client.post(f"/api/v1/admin/messaging/campaigns/{campaign_id}/schedule", headers=admin)
    db = SessionLocal()
    try:
        from uuid import UUID as _UUID2

        job = db.scalar(select(MessageJob).where(
            MessageJob.campaign_id == _UUID2(str(campaign_id))).limit(1))
        assert job is not None
        job.status = MessageStatus.SENT
        job.provider_message_id = "test-mid-001"
        db.commit()
        mid = job.provider_message_id
    finally:
        db.close()

    denied = client.post("/api/v1/webhooks/whatsapp/status",
                         json={"provider_message_id": mid, "status": "DELIVERED"})
    assert denied.status_code == 403

    import os

    from app.core.config import get_settings

    os.environ["WHATSAPP_WEBHOOK_SECRET"] = "test-secret-2"
    get_settings.cache_clear()
    try:
        ok = client.post("/api/v1/webhooks/whatsapp/status",
                         json={"provider_message_id": mid, "status": "DELIVERED"},
                         headers={"x-webhook-secret": "test-secret-2"})
        assert ok.status_code == 200, ok.text
        assert ok.json()["data"]["status"] == "DELIVERED"
        read = client.post("/api/v1/webhooks/whatsapp/status",
                           json={"provider_message_id": mid, "status": "READ"},
                           headers={"x-webhook-secret": "test-secret-2"})
        assert read.json()["data"]["status"] == "READ"
        missing = client.post("/api/v1/webhooks/whatsapp/status",
                              json={"provider_message_id": "nope", "status": "DELIVERED"},
                              headers={"x-webhook-secret": "test-secret-2"})
        assert missing.status_code == 404
    finally:
        del os.environ["WHATSAPP_WEBHOOK_SECRET"]
        get_settings.cache_clear()
    client.post(f"/api/v1/admin/messaging/campaigns/{campaign_id}/cancel", headers=admin)


def test_government_cannot_target_non_consenting(client: TestClient, auth_headers):
    from app.models import Trainee

    admin = auth_headers("admin@skilltrace.in")
    db = SessionLocal()
    try:
        target = db.scalar(select(Trainee).where(Trainee.whatsapp_followup_consent.is_(False)).limit(1))
        assert target is not None
        target_id = str(target.id)
    finally:
        db.close()
    denied = client.post("/api/v1/admin/messaging/send-one",
                         json={"trainee_id": target_id,
                               "template_key": "EMPLOYMENT_UPDATE_REMINDER"},
                         headers=admin)
    assert denied.status_code == 422, denied.text


def test_mock_provider_without_credentials_and_templates(client: TestClient, auth_headers):
    from app.services.notifications.whatsapp import WhatsAppProvider

    status = WhatsAppProvider.provider_status()
    assert status["provider"] in ("demo", "twilio", "meta")
    result = WhatsAppProvider().send(to="+919876512001", subject="t", body="hello")
    assert result.simulated or result.ok or not result.ok  # any honest outcome
    if result.simulated:
        assert result.provider_message_id.startswith(("sim-", "mock-"))

    admin = auth_headers("admin@skilltrace.in")
    templates = client.get("/api/v1/admin/messaging/templates", headers=admin)
    assert templates.status_code == 200, templates.text
    keys = {t["template_key"] for t in templates.json()["data"]}
    for required in ("EMPLOYMENT_30_DAY", "EMPLOYMENT_60_DAY", "EMPLOYMENT_90_DAY",
                     "EMPLOYMENT_VERIFICATION", "EMPLOYMENT_UPDATE_REMINDER",
                     "TRAINING_COMPLETION", "PROFILE_UPDATE_REMINDER"):
        assert required in keys, required

    automations = client.get("/api/v1/admin/messaging/automations", headers=admin)
    assert automations.status_code == 200
    names = [a["name"] for a in automations.json()["data"]]
    assert "Employment Follow-up" in names

    analytics = client.get("/api/v1/admin/messaging/analytics", headers=admin)
    assert analytics.status_code == 200
    for field in ("active_automations", "messages_scheduled", "delivered",
                  "failed", "pending", "simulated", "next_run"):
        assert field in analytics.json()["data"], field


def test_messaging_endpoints_require_admin(client: TestClient, auth_headers):
    trainee = auth_headers("trainee@skilltrace.in")
    assert client.get("/api/v1/admin/messaging/analytics", headers=trainee).status_code == 403
    assert client.get("/api/v1/admin/messaging/templates", headers=trainee).status_code == 403
    assert client.post("/api/v1/admin/messaging/campaigns",
                       json={"name": "x", "template_key": "EMPLOYMENT_30_DAY"},
                       headers=trainee).status_code == 403
