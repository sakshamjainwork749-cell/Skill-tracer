from fastapi.testclient import TestClient


def test_analytics_overview_and_shapes(client: TestClient, auth_headers):
    headers = auth_headers("admin@skilltrace.in")
    endpoints = [
        "overview",
        "districts",
        "funnel",
        "skill-gaps",
        "attrition",
        "insights",
    ]
    payloads = {}
    for endpoint in endpoints:
        response = client.get(f"/api/v1/analytics/{endpoint}", headers=headers)
        assert response.status_code == 200, response.text
        assert response.json()["success"] is True
        payloads[endpoint] = response.json()["data"]

    overview = payloads["overview"]
    assert overview["total_trained"] >= 60
    assert 0 <= overview["employed_rate"] <= 100
    assert len(overview["trend"]) == 12
    assert overview["province"] == "Maharashtra"

    districts = payloads["districts"]["districts"]
    assert len(districts) == 5
    assert {"Pune", "Nashik", "Gadchiroli", "Mumbai", "Chhatrapati Sambhajinagar"} <= {
        item["name"] for item in districts
    }
    assert [stage["name"] for stage in payloads["funnel"]["stages"]] == [
        "Enrolled",
        "Completed",
        "Placed",
        "Retained at 12 months",
    ]
    assert payloads["funnel"]["stages"][1]["value"] == overview["total_trained"]
    assert payloads["skill-gaps"]["sectors"]
    assert payloads["attrition"]["total"] >= 1
    assert isinstance(payloads["insights"]["insights"], list)


def test_analytics_district_filter_changes_database_result(
    client: TestClient, auth_headers
):
    headers = auth_headers("admin@skilltrace.in")
    overview = client.get("/api/v1/analytics/overview", headers=headers)
    filtered = client.get(
        "/api/v1/analytics/overview?district=Pune",
        headers=headers,
    )
    assert overview.status_code == filtered.status_code == 200
    assert (
        filtered.json()["data"]["total_trained"]
        < overview.json()["data"]["total_trained"]
    )


def test_invalid_analytics_period_is_standard_error(client: TestClient, auth_headers):
    response = client.get(
        "/api/v1/analytics/overview?period=next-year",
        headers=auth_headers("admin@skilltrace.in"),
    )
    assert response.status_code == 400
    assert isinstance(response.json()["detail"], str)
