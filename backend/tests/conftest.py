from __future__ import annotations

import os
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

BACKEND_ROOT = Path(__file__).resolve().parents[1]
TEST_DATABASE = BACKEND_ROOT / ".pytest_skilltrace.db"
TEST_UPLOADS = BACKEND_ROOT / ".pytest_uploads"

TEST_DATABASE.unlink(missing_ok=True)
os.environ["DATABASE_URL"] = f"sqlite:///{TEST_DATABASE}"
os.environ["JWT_SECRET"] = "pytest-secret-key-that-is-longer-than-thirty-two-bytes"
os.environ["AUTO_CREATE_TABLES"] = "true"
os.environ["AUTO_SEED_DEMO"] = "true"
os.environ["UPLOAD_DIR"] = str(TEST_UPLOADS)

from app.db.session import engine
from app.main import app


@pytest.fixture(scope="session")
def client():
    with TestClient(app) as test_client:
        yield test_client
    engine.dispose()
    TEST_DATABASE.unlink(missing_ok=True)
    for path in TEST_UPLOADS.glob("*") if TEST_UPLOADS.exists() else []:
        path.unlink(missing_ok=True)
    TEST_UPLOADS.rmdir()


@pytest.fixture
def auth_headers(client: TestClient):
    def _login(email: str, password: str = "Demo@123") -> dict[str, str]:
        response = client.post(
            "/api/v1/auth/login",
            json={"email": email, "password": password},
        )
        assert response.status_code == 200, response.text
        return {"Authorization": f"Bearer {response.json()['data']['access_token']}"}

    return _login
