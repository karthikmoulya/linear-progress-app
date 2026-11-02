from datetime import date

import pytest
from fastapi.testclient import TestClient

import main
from linear_client import LinearError


@pytest.fixture
def client(raw_issues, monkeypatch):
    monkeypatch.setenv("AUTH_DISABLED", "true")
    monkeypatch.setenv("LINEAR_PROJECT_ID", "00000000-0000-4000-8000-000000000001")
    calls = []

    def fake_fetch(authorization, project_id):
        calls.append(project_id)
        return {"id": project_id, "name": "Study plan", "target_date": "2027-06-30"}, raw_issues

    monkeypatch.setattr(main, "cache", main.IssueCache(fake_fetch))
    monkeypatch.setattr(main, "today_local", lambda: date(2026, 11, 4))
    c = TestClient(main.app)
    c.calls = calls
    return c


def test_today_shape(client):
    body = client.get("/api/today").json()
    assert set(body) == {"date", "is_weekend", "today", "catch_up"}
    assert body["today"]["day"] == 3


def test_summary_shape(client):
    body = client.get("/api/summary").json()
    assert body["dsa_solved"] == 3 and body["dsa_total"] == 150
    assert body["last_synced"]


def test_weeks_and_subjects_shape(client):
    assert len(client.get("/api/weeks").json()) == 2
    assert [s["subject"] for s in client.get("/api/subjects").json()] == [
        "DSA", "Agentic AI", "System Design", "Portfolio Project"
    ]


def test_cache_serves_repeat_requests(client):
    client.get("/api/summary")
    client.get("/api/weeks")
    assert len(client.calls) == 1


def test_refresh_clears_the_cache(client):
    client.get("/api/summary")
    assert client.post("/api/refresh").status_code == 200
    assert len(client.calls) == 2


def test_linear_failure_returns_502(monkeypatch):
    monkeypatch.setenv("AUTH_DISABLED", "true")

    def broken(authorization, project_id):
        raise LinearError("Authentication required")

    monkeypatch.setattr(main, "cache", main.IssueCache(broken))
    resp = TestClient(main.app).get("/api/summary")
    assert resp.status_code == 502
    assert "Authentication required" in resp.json()["detail"]


def test_days_and_upcoming(client):
    days = client.get("/api/days").json()
    assert [d["status"] for d in days["days"]] == ["done", "missed", "today", "planned", "planned"]
    upcoming = client.get("/api/upcoming").json()
    assert upcoming[-1]["title"] == "Study plan complete"


def test_project_switch_uses_cookie(client, monkeypatch):
    other = "11111111-2222-3333-4444-555555555555"
    monkeypatch.setattr(main, "fetch_project", lambda auth, pid: {"id": pid, "name": "Other"})
    assert client.get("/api/project").json()["name"] == "Study plan"
    assert client.post("/api/project", json={"id": other}).status_code == 204
    client.get("/api/summary")
    assert client.calls[-1] == other


def test_project_switch_rejects_non_uuid(client):
    assert client.post("/api/project", json={"id": "../etc"}).status_code == 400


def test_projects_list(client, monkeypatch):
    monkeypatch.setattr(
        main, "fetch_projects", lambda auth: [{"id": "b", "name": "beta", "targetDate": None, "url": None}, {"id": "a", "name": "Alpha"}]
    )
    assert [p["name"] for p in client.get("/api/projects").json()] == ["Alpha", "beta"]
