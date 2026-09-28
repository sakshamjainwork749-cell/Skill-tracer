from fastapi.testclient import TestClient


def test_passport_contains_complete_demo_journey(client: TestClient, auth_headers):
    response = client.get(
        "/api/v1/trainees/me/passport",
        headers=auth_headers("trainee@skilltrace.in"),
    )
    assert response.status_code == 200, response.text
    passport = response.json()["data"]
    assert passport["trainee"]["email"] == "trainee@skilltrace.in"
    assert passport["training"]["course_name"] == "CNC Manufacturing Technician"
    assert passport["training"]["training_hours"] == 960
    assert passport["current_outcome"]["status"] == "VERIFIED"
    assert passport["confidence_score"] == 95
    assert passport["confidence_label"] == "High"
    assert passport["proof_status"] == "VERIFIED"
    assert passport["wage_progression"]
    assert [item["label"] for item in passport["retention_milestones"]] == [
        "3M",
        "6M",
        "12M",
    ]
    assert passport["next_followup"] is not None


def test_outcome_conditional_validation(client: TestClient, auth_headers):
    response = client.post(
        "/api/v1/trainees/me/outcomes",
        headers=auth_headers("trainee@skilltrace.in"),
        json={"outcome_type": "EMPLOYED", "role": "Technician"},
    )
    assert response.status_code == 422
    assert isinstance(response.json()["detail"], str)


def test_proof_upload_and_conditional_outcome(client: TestClient, auth_headers):
    headers = auth_headers("trainee@skilltrace.in")
    # Minimal PNG signature is sufficient to exercise extension/content/size guards.
    upload = client.post(
        "/api/v1/trainees/me/proofs",
        headers=headers,
        files={"file": ("identity.png", b"\x89PNG\r\n\x1a\nproof-data", "image/png")},
        data={"description": "Enterprise registration evidence"},
    )
    assert upload.status_code == 201, upload.text
    proof_id = upload.json()["data"]["id"]

    outcome = client.post(
        "/api/v1/trainees/me/outcomes",
        headers=headers,
        json={
            "outcome_type": "SELF_EMPLOYED",
            "role": "Solar Installation Specialist",
            "business_type": "Renewable energy services",
            "start_date": "2026-01-15",
            "location": "Pune",
            "monthly_revenue": 42000,
            "employees_created": 2,
            "proof_id": proof_id,
        },
    )
    assert outcome.status_code == 201, outcome.text
    assert outcome.json()["data"]["outcome_type"] == "SELF_EMPLOYED"

    passport = client.get("/api/v1/trainees/me/passport", headers=headers)
    assert passport.status_code == 200
    assert passport.json()["data"]["confidence_score"] == 95


def test_unsafe_proof_extension_is_rejected(client: TestClient, auth_headers):
    response = client.post(
        "/api/v1/trainees/me/proofs",
        headers=auth_headers("trainee@skilltrace.in"),
        files={"file": ("payload.svg", b"<svg></svg>", "image/svg+xml")},
    )
    assert response.status_code == 415
    assert isinstance(response.json()["detail"], str)
