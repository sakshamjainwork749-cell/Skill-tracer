from uuid import UUID

from fastapi.testclient import TestClient

from app.db.session import SessionLocal
from app.models import EmploymentRecord, Trainee


def test_employer_queue_and_verification(client: TestClient, auth_headers):
    headers = auth_headers("employer@skilltrace.in")
    queue = client.get("/api/v1/employer/verification-queue", headers=headers)
    assert queue.status_code == 200, queue.text
    rows = queue.json()["data"]
    assert rows
    assert {
        "employment_id",
        "trainee",
        "course",
        "reported",
        "status",
        "confidence",
    } <= set(rows[0])

    employment_id = rows[0]["employment_id"]
    response = client.patch(
        f"/api/v1/employer/verifications/{employment_id}",
        headers=headers,
        json={
            "status": "Verified",
            "rating": 5,
            "skill_alignment_feedback": {
                "overall_alignment": 5,
                "aligned_skills": ["quality inspection", "production safety"],
                "missing_skills": [],
                "additional_comments": "Strong workplace performance.",
            },
            "notes": "Documents and facts confirmed.",
        },
    )
    assert response.status_code == 200, response.text
    assert response.json()["data"]["status"] == "VERIFIED"
    assert response.json()["data"]["employment"]["rating"] == 5


def test_employer_cannot_patch_another_employers_record(
    client: TestClient, auth_headers
):
    owner_headers = auth_headers("employer@skilltrace.in")
    rows = client.get(
        "/api/v1/employer/verification-queue",
        headers=owner_headers,
    ).json()["data"]
    employment_id = rows[0]["employment_id"]

    response = client.patch(
        f"/api/v1/employer/verifications/{employment_id}",
        headers=auth_headers("employer1@skilltrace.in"),
        json={"status": "Verified", "rating": 4},
    )
    assert response.status_code == 404
    assert isinstance(response.json()["detail"], str)


def test_employer_queue_requires_trainee_consent(client: TestClient, auth_headers):
    headers = auth_headers("employer@skilltrace.in")
    employment_id = client.get(
        "/api/v1/employer/verification-queue", headers=headers
    ).json()["data"][0]["employment_id"]

    with SessionLocal() as db:
        record = db.get(EmploymentRecord, UUID(employment_id))
        assert record is not None
        trainee = db.get(Trainee, record.trainee_id)
        assert trainee is not None
        original = trainee.consent_given
        trainee.consent_given = False
        db.commit()
        trainee_id = trainee.id

    try:
        queue = client.get(
            "/api/v1/employer/verification-queue", headers=headers
        ).json()["data"]
        assert employment_id not in {row["employment_id"] for row in queue}
        response = client.patch(
            f"/api/v1/employer/verifications/{employment_id}",
            headers=headers,
            json={"status": "Verified"},
        )
        assert response.status_code == 404
    finally:
        with SessionLocal() as db:
            trainee = db.get(Trainee, trainee_id)
            assert trainee is not None
            trainee.consent_given = original
            db.commit()
