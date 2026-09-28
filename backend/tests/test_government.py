from fastapi.testclient import TestClient


def test_overview_carries_policy_fields(client: TestClient, auth_headers):
    headers = auth_headers("admin@skilltrace.in")
    response = client.get("/api/v1/analytics/overview", headers=headers)
    assert response.status_code == 200, response.text
    data = response.json()["data"]
    for field in ("pending_verification", "self_employed", "training_completed"):
        assert field in data, field
        assert isinstance(data[field], int)
    assert data["training_completed"] == data["total_trained"]


def test_districts_carry_pending_verification(client: TestClient, auth_headers):
    headers = auth_headers("admin@skilltrace.in")
    response = client.get("/api/v1/analytics/districts", headers=headers)
    assert response.status_code == 200, response.text
    districts = response.json()["data"]["districts"]
    assert districts
    for district in districts:
        assert "pending_verification" in district
        assert isinstance(district["pending_verification"], int)


def test_empty_district_filter_returns_empty_shapes(client: TestClient, auth_headers):
    headers = auth_headers("admin@skilltrace.in")
    for endpoint in ("overview", "districts", "skill-gaps", "insights", "funnel", "attrition"):
        response = client.get(
            f"/api/v1/analytics/{endpoint}?district=Nowhere", headers=headers
        )
        assert response.status_code == 200, (endpoint, response.text)
        assert response.json()["success"] is True
    districts = client.get(
        "/api/v1/analytics/districts?district=Nowhere", headers=headers
    ).json()["data"]["districts"]
    assert districts == []
    gaps = client.get(
        "/api/v1/analytics/skill-gaps?district=Nowhere", headers=headers
    ).json()["data"]["sectors"]
    assert gaps == []


def test_csv_export_has_content(client: TestClient, auth_headers):
    headers = auth_headers("admin@skilltrace.in")
    response = client.get("/api/v1/analytics/export", headers=headers)
    assert response.status_code == 200, response.text
    assert "text/csv" in response.headers["content-type"]
    body = response.text
    assert "total_trained" in body and "district" in body
    assert "Pune" in body


def test_pdf_export_has_report_sections(client: TestClient, auth_headers):
    headers = auth_headers("admin@skilltrace.in")
    response = client.get("/api/v1/analytics/export-pdf", headers=headers)
    assert response.status_code == 200, response.text
    assert response.headers["content-type"] == "application/pdf"
    body = response.content
    assert body.startswith(b"%PDF")
    assert len(body) > 1500
    text = body.decode("latin-1")
    assert "Summary metrics" in text
    assert "District outcomes" in text
    assert "Skill-gap summary" in text
    assert "Risk and insight summary" in text


def test_insights_have_actionable_targets(client: TestClient, auth_headers):
    headers = auth_headers("admin@skilltrace.in")
    response = client.get("/api/v1/analytics/insights", headers=headers)
    assert response.status_code == 200, response.text
    insights = response.json()["data"]["insights"]
    assert insights
    for insight in insights:
        assert insight["id"] and insight["title"] and insight["recommendation"]
