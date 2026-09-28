from fastapi.testclient import TestClient


def test_employer_profile_get_and_update(client: TestClient, auth_headers):
    employer = auth_headers("employer@skilltrace.in")
    response = client.get("/api/v1/employer/me", headers=employer)
    assert response.status_code == 200, response.text
    data = response.json()["data"]
    assert data["email"] == "employer@skilltrace.in"
    assert data["role"] == "EMPLOYER"
    assert data["organization_name"]
    original_name = data["full_name"]

    updated = client.patch(
        "/api/v1/employer/me",
        json={"full_name": "Employer Test", "phone": "+91 90000 00002",
              "district": data["district"]},
        headers=employer,
    )
    assert updated.status_code == 200, updated.text
    assert updated.json()["data"]["full_name"] == "Employer Test"
    assert updated.json()["data"]["email"] == "employer@skilltrace.in"

    restore = client.patch(
        "/api/v1/employer/me",
        json={"full_name": original_name},
        headers=employer,
    )
    assert restore.status_code == 200


def test_employer_profile_protects_identity(client: TestClient, auth_headers):
    employer = auth_headers("employer@skilltrace.in")
    forbidden = client.patch(
        "/api/v1/employer/me",
        json={"registration_number": "HACK-001"},
        headers=employer,
    )
    assert forbidden.status_code == 422


def test_employer_profile_requires_employer_role(client: TestClient, auth_headers):
    trainee = auth_headers("trainee@skilltrace.in")
    assert client.get("/api/v1/employer/me", headers=trainee).status_code == 403
    response = client.patch(
        "/api/v1/employer/me", json={"full_name": "Nope"}, headers=trainee
    )
    assert response.status_code == 403
    admin = auth_headers("admin@skilltrace.in")
    assert client.get("/api/v1/employer/me", headers=admin).status_code == 403


def test_employer_cannot_touch_other_employer_record(
    client: TestClient, auth_headers
):
    # Verification scope is employer_id-bound; a trainee-owned record outside
    # this employer's queue must not resolve.
    employer = auth_headers("employer@skilltrace.in")
    response = client.patch(
        "/api/v1/employer/verifications/00000000-0000-0000-0000-000000000000",
        json={"status": "Verified"},
        headers=employer,
    )
    assert response.status_code == 404
