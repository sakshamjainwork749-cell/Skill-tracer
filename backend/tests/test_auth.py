from fastapi.testclient import TestClient


def test_login_and_me(client: TestClient, auth_headers):
    headers = auth_headers("trainee@skilltrace.in")
    me = client.get("/api/v1/auth/me", headers=headers)
    assert me.status_code == 200
    assert me.json()["success"] is True
    assert me.json()["data"]["email"] == "trainee@skilltrace.in"
    assert me.json()["data"]["role"] == "TRAINEE"


def test_login_rejects_bad_password(client: TestClient):
    response = client.post(
        "/api/v1/auth/login",
        json={"email": "trainee@skilltrace.in", "password": "wrong-password"},
    )
    assert response.status_code == 401
    assert isinstance(response.json()["detail"], str)


def test_rbac_rejects_trainee_from_employer_route(client: TestClient, auth_headers):
    response = client.get(
        "/api/v1/employer/verification-queue",
        headers=auth_headers("trainee@skilltrace.in"),
    )
    assert response.status_code == 403
    assert set(response.json()) == {"detail"}


def test_rbac_rejects_non_admin_from_analytics(client: TestClient, auth_headers):
    response = client.get(
        "/api/v1/analytics/overview",
        headers=auth_headers("trainee@skilltrace.in"),
    )
    assert response.status_code == 403
    assert set(response.json()) == {"detail"}
