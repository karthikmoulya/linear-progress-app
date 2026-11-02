import time
from urllib.parse import parse_qs, urlparse

import httpx
import pytest
import respx
from fastapi.testclient import TestClient

import auth
import main
from linear_client import LINEAR_URL

ME = "00000000-0000-4000-8000-0000000000aa"


@pytest.fixture
def client(raw_issues, monkeypatch):
    monkeypatch.setenv("AUTH_DISABLED", "false")
    monkeypatch.setenv("LINEAR_CLIENT_ID", "cid")
    monkeypatch.setenv("LINEAR_CLIENT_SECRET", "csecret")
    monkeypatch.setenv("OAUTH_REDIRECT_URI", "http://testserver/auth/callback")
    monkeypatch.setenv("SESSION_SECRET", "test-secret")
    monkeypatch.setenv("ALLOWED_LINEAR_USER_IDS", ME)
    monkeypatch.setenv("LINEAR_PROJECT_ID", "00000000-0000-4000-8000-000000000001")
    seen = []

    def fake_fetch(authorization, project_id):
        seen.append(authorization)
        return {"id": project_id, "name": "Plan"}, raw_issues

    monkeypatch.setattr(main, "cache", main.IssueCache(fake_fetch))
    c = TestClient(main.app)
    c.seen_auth = seen
    return c


def start_login(client) -> str:
    resp = client.get("/auth/login", follow_redirects=False)
    assert resp.status_code == 302
    return parse_qs(urlparse(resp.headers["location"]).query)["state"][0]


def mock_linear(user_id=ME):
    respx.post(auth.TOKEN_URL).mock(
        return_value=httpx.Response(200, json={"access_token": "at1", "refresh_token": "rt1", "expires_in": 86399})
    )
    respx.post(LINEAR_URL).mock(
        return_value=httpx.Response(200, json={"data": {"viewer": {"id": user_id, "name": "Test User", "email": "test@example.com"}}})
    )


def sign_in(client):
    state = start_login(client)
    resp = client.get(f"/auth/callback?code=abc&state={state}", follow_redirects=False)
    assert resp.status_code == 302 and resp.headers["location"] == "/"


def test_login_redirects_to_linear_with_pkce(client):
    resp = client.get("/auth/login", follow_redirects=False)
    url = urlparse(resp.headers["location"])
    params = parse_qs(url.query)
    assert f"{url.scheme}://{url.netloc}{url.path}" == auth.AUTHORIZE_URL
    assert params["scope"] == ["read"]
    assert params["code_challenge_method"] == ["S256"]
    assert auth.LOGIN_COOKIE in resp.cookies


def test_api_without_cookie_returns_401(client):
    assert client.get("/api/summary").status_code == 401
    assert client.get("/api/me").status_code == 401


def test_callback_rejects_wrong_state(client):
    start_login(client)
    resp = client.get("/auth/callback?code=abc&state=forged", follow_redirects=False)
    assert resp.status_code == 400


@respx.mock
def test_user_not_on_allow_list_gets_403(client):
    mock_linear(user_id="someone-else")
    state = start_login(client)
    resp = client.get(f"/auth/callback?code=abc&state={state}", follow_redirects=False)
    assert resp.status_code == 403
    assert auth.SESSION_COOKIE not in resp.cookies


@respx.mock
def test_sign_in_then_data_uses_bearer_token(client):
    mock_linear()
    sign_in(client)
    assert client.get("/api/me").json()["id"] == ME
    assert client.get("/api/summary").status_code == 200
    assert client.seen_auth == ["Bearer at1"]


@respx.mock
def test_expired_token_is_refreshed_once_and_new_refresh_token_saved(client, monkeypatch):
    mock_linear()
    sign_in(client)

    # Two days later the 24-hour access token has expired; the 7-day session hasn't.
    later = time.time() + 2 * 86400
    monkeypatch.setattr(auth.time, "time", lambda: later)
    refresh = respx.post(auth.TOKEN_URL).mock(
        return_value=httpx.Response(200, json={"access_token": "at2", "refresh_token": "rt2", "expires_in": 86399})
    )
    assert client.get("/api/summary").status_code == 200
    assert client.get("/api/weeks").status_code == 200

    refreshes = [c.request.content for c in refresh.calls if b"grant_type=refresh_token" in c.request.content]
    assert len(refreshes) == 1
    assert b"refresh_token=rt1" in refreshes[0]
    saved = auth.unseal(client.cookies[auth.SESSION_COOKIE], auth.SESSION_SECONDS)
    assert (saved["access_token"], saved["refresh_token"]) == ("at2", "rt2")
    assert client.seen_auth == ["Bearer at2"]


@respx.mock
def test_logout_revokes_and_clears_cookie(client):
    mock_linear()
    sign_in(client)
    revoke = respx.post(auth.REVOKE_URL).mock(return_value=httpx.Response(200))
    assert client.post("/auth/logout").status_code == 204
    # Both tokens, so a copied cookie can't keep refreshing.
    revoked = sorted(c.request.content for c in revoke.calls)
    assert revoked == [b"token=at1&token_type_hint=access_token", b"token=rt1&token_type_hint=refresh_token"]
    assert client.get("/api/me").status_code == 401


def test_auth_disabled_uses_personal_key(client, monkeypatch):
    monkeypatch.setenv("AUTH_DISABLED", "true")
    monkeypatch.setenv("LINEAR_API_KEY", "lin_api_dev")
    assert client.get("/api/me").json()["auth_disabled"] is True
    client.get("/api/summary")
    assert client.seen_auth == ["lin_api_dev"]


@respx.mock
def test_api_key_login(client):
    respx.post(LINEAR_URL).mock(
        return_value=httpx.Response(200, json={"data": {"viewer": {"id": ME, "name": "Test User", "email": None, "organization": {"name": "Example", "urlKey": "example"}}}})
    )
    assert client.post("/auth/key", json={"api_key": "lin_api_good"}).status_code == 204
    me = client.get("/api/me").json()
    assert (me["method"], me["workspace"]) == ("key", "example")
    client.get("/api/summary")
    # Personal keys go to Linear as-is, never with "Bearer".
    assert client.seen_auth == ["lin_api_good"]


@respx.mock
def test_api_key_login_rejects_bad_key_and_other_users(client):
    assert client.post("/auth/key", json={"api_key": "hello"}).status_code == 400
    route = respx.post(LINEAR_URL)
    route.mock(return_value=httpx.Response(400, json={"errors": [{"message": "Authentication required"}]}))
    assert client.post("/auth/key", json={"api_key": "lin_api_bad"}).status_code == 401
    route.mock(return_value=httpx.Response(200, json={"data": {"viewer": {"id": "other", "name": "X"}}}))
    assert client.post("/auth/key", json={"api_key": "lin_api_other"}).status_code == 403
    assert client.get("/api/me").status_code == 401


@respx.mock
def test_logout_of_key_session_does_not_revoke(client):
    respx.post(LINEAR_URL).mock(return_value=httpx.Response(200, json={"data": {"viewer": {"id": ME, "name": "K"}}}))
    revoke = respx.post(auth.REVOKE_URL).mock(return_value=httpx.Response(200))
    client.post("/auth/key", json={"api_key": "lin_api_good"})
    assert client.post("/auth/logout").status_code == 204
    assert revoke.call_count == 0


def test_auth_disabled_refused_in_production(monkeypatch):
    monkeypatch.setenv("AUTH_DISABLED", "true")
    monkeypatch.setenv("RENDER", "true")
    with pytest.raises(RuntimeError, match="local dev only"):
        auth.check_config()
    monkeypatch.delenv("RENDER")
    monkeypatch.setenv("OAUTH_REDIRECT_URI", "https://plan.onrender.com/auth/callback")
    with pytest.raises(RuntimeError):
        auth.check_config()
    monkeypatch.setenv("AUTH_DISABLED", "false")
    auth.check_config()


def test_security_headers(client):
    resp = client.get("/api/me")
    assert resp.headers["X-Frame-Options"] == "DENY"
    assert "frame-ancestors 'none'" in resp.headers["Content-Security-Policy"]
    assert resp.headers["X-Content-Type-Options"] == "nosniff"


def test_cache_is_per_credential(raw_issues):
    seen = []
    cache = main.IssueCache(lambda a, p: (seen.append(a), ({"id": p, "name": "P"}, raw_issues))[1])
    cache.get("Bearer one", "p1")
    cache.get("Bearer one", "p1")
    cache.get("Bearer two", "p1")
    assert seen == ["Bearer one", "Bearer two"]
