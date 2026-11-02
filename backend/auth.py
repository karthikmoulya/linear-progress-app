"""Sign in with Linear: OAuth 2.0 with PKCE, an allow-list of Linear user IDs, and an encrypted session cookie."""

import base64
import hashlib
from html import escape
import json
import os
import secrets
import time
from urllib.parse import urlencode

import httpx
from cryptography.fernet import Fernet, InvalidToken
from fastapi import APIRouter, HTTPException, Request, Response
from fastapi.responses import HTMLResponse, RedirectResponse
from pydantic import BaseModel

from linear_client import LinearError, fetch_viewer

AUTHORIZE_URL = "https://linear.app/oauth/authorize"
TOKEN_URL = "https://api.linear.app/oauth/token"
REVOKE_URL = "https://api.linear.app/oauth/revoke"

SESSION_COOKIE = "lp_session"
LOGIN_COOKIE = "lp_login"
SESSION_SECONDS = 7 * 24 * 3600
LOGIN_SECONDS = 10 * 60
# Refresh a little before the access token runs out, not after a call has already failed.
REFRESH_MARGIN_SECONDS = 60

router = APIRouter()


def auth_disabled() -> bool:
    return os.getenv("AUTH_DISABLED", "").lower() in ("1", "true", "yes")


def is_production() -> bool:
    # Render sets RENDER=true; an https redirect URI also means the app is on the internet.
    return bool(os.getenv("RENDER")) or os.getenv("OAUTH_REDIRECT_URI", "").startswith("https://")


def check_config() -> None:
    """Refuses to start a deployed app with login switched off, which would make the data public."""
    if auth_disabled() and is_production():
        raise RuntimeError("AUTH_DISABLED=true is for local dev only; unset it in production")


def allowed_ids() -> set[str]:
    return {i.strip() for i in os.getenv("ALLOWED_LINEAR_USER_IDS", "").split(",") if i.strip()}


def _setting(name: str) -> str:
    value = os.getenv(name)
    if not value:
        raise HTTPException(status_code=500, detail=f"{name} is not set")
    return value


def _fernet() -> Fernet:
    # Any SESSION_SECRET string works: it is stretched into the 32-byte key Fernet needs.
    digest = hashlib.sha256(_setting("SESSION_SECRET").encode()).digest()
    return Fernet(base64.urlsafe_b64encode(digest))


def seal(data: dict) -> str:
    return _fernet().encrypt(json.dumps(data).encode()).decode()


def unseal(token: str | None, max_age: int) -> dict | None:
    if not token:
        return None
    try:
        return json.loads(_fernet().decrypt(token.encode(), ttl=max_age))
    except (InvalidToken, ValueError):
        return None


def set_cookie(response: Response, name: str, value: str, max_age: int) -> None:
    # Secure follows the redirect URI, so plain-http localhost still works in dev.
    secure = os.getenv("OAUTH_REDIRECT_URI", "").startswith("https://")
    response.set_cookie(name, value, max_age=max_age, httponly=True, secure=secure, samesite="lax")


def _token_request(form: dict) -> dict:
    try:
        resp = httpx.post(TOKEN_URL, data=form, timeout=15)
    except httpx.HTTPError as exc:
        raise LinearError(f"Could not reach Linear: {exc}") from exc
    if resp.status_code != 200:
        # Linear explains OAuth failures in the body, e.g. {"error": "invalid_client", "error_description": "…"}.
        try:
            body = resp.json()
            reason = body.get("error_description") or body.get("error") or ""
        except ValueError:
            reason = ""
        raise LinearError(f"Token request failed (HTTP {resp.status_code}){': ' + reason if reason else ''}")
    tokens = resp.json()
    return {
        "access_token": tokens["access_token"],
        # Each refresh returns a new refresh token, which replaces the old one.
        "refresh_token": tokens.get("refresh_token"),
        "expires_at": time.time() + tokens.get("expires_in", 86400),
    }


def _pkce_pair() -> tuple[str, str]:
    verifier = secrets.token_urlsafe(64)
    challenge = base64.urlsafe_b64encode(hashlib.sha256(verifier.encode()).digest()).rstrip(b"=").decode()
    return verifier, challenge


def _auth_error_page(status: int, message: str) -> HTMLResponse:
    """A failed browser sign-in lands on a readable page with a way back, not raw JSON."""
    body = (
        "<!doctype html><meta charset='utf-8'><title>Sign-in failed</title>"
        "<body style=\"font-family:system-ui,sans-serif;background:#F3F4F6;color:#12141A;"
        "display:flex;min-height:100vh;align-items:center;justify-content:center;margin:0\">"
        "<div style=\"background:#fff;border:1px solid #E2E4E9;border-radius:16px;padding:32px;max-width:420px\">"
        "<h1 style=\"margin:0 0 8px;font-size:22px\">Sign-in failed</h1>"
        f"<p style=\"margin:0 0 20px;color:#535968\">{escape(message)}</p>"
        "<a href=\"/\" style=\"color:#3442C4\">Try signing in again</a></div></body>"
    )
    return HTMLResponse(body, status_code=status)


def _user(viewer: dict) -> dict:
    org = viewer.get("organization") or {}
    return {"id": viewer["id"], "name": viewer["name"], "email": viewer.get("email"), "workspace": org.get("urlKey")}


@router.get("/auth/login")
def login():
    state = secrets.token_urlsafe(24)
    verifier, challenge = _pkce_pair()
    params = {
        "client_id": _setting("LINEAR_CLIENT_ID"),
        "redirect_uri": _setting("OAUTH_REDIRECT_URI"),
        "response_type": "code",
        "scope": "read",
        "state": state,
        "code_challenge": challenge,
        "code_challenge_method": "S256",
    }
    response = RedirectResponse(f"{AUTHORIZE_URL}?{urlencode(params)}", status_code=302)
    set_cookie(response, LOGIN_COOKIE, seal({"state": state, "verifier": verifier}), LOGIN_SECONDS)
    return response


@router.get("/auth/callback")
def callback(request: Request, code: str | None = None, state: str | None = None, error: str | None = None):
    if error:
        return _auth_error_page(400, f"Linear sign-in was cancelled or failed ({error}).")
    pending = unseal(request.cookies.get(LOGIN_COOKIE), LOGIN_SECONDS)
    if not pending or not code or not state or not secrets.compare_digest(state, pending["state"]):
        return _auth_error_page(400, "The sign-in link expired or didn't match. Start again.")

    try:
        tokens = _token_request(
            {
                "grant_type": "authorization_code",
                "code": code,
                "redirect_uri": _setting("OAUTH_REDIRECT_URI"),
                "client_id": _setting("LINEAR_CLIENT_ID"),
                "client_secret": _setting("LINEAR_CLIENT_SECRET"),
                "code_verifier": pending["verifier"],
            }
        )
        viewer = fetch_viewer(f"Bearer {tokens['access_token']}")
    except LinearError as exc:
        return _auth_error_page(502, f"Linear didn't return a valid token: {exc}")

    if viewer["id"] not in allowed_ids():
        return _auth_error_page(403, f"This app is private. Linear user {viewer['id']} is not on its allow-list.")

    response = RedirectResponse("/", status_code=302)
    session = {"user": _user(viewer), "method": "oauth", **tokens}
    set_cookie(response, SESSION_COOKIE, seal(session), SESSION_SECONDS)
    response.delete_cookie(LOGIN_COOKIE)
    return response


class KeyLogin(BaseModel):
    api_key: str


@router.post("/auth/key", status_code=204)
def key_login(body: KeyLogin):
    """Sign in with a Linear personal API key instead of OAuth.

    The key is checked against Linear and the allow-list, then kept only inside the encrypted session cookie.
    """
    api_key = body.api_key.strip()
    if not api_key.startswith("lin_api_"):
        raise HTTPException(status_code=400, detail="That doesn't look like a Linear personal API key (lin_api_…)")
    try:
        viewer = fetch_viewer(api_key)
    except LinearError as exc:
        raise HTTPException(status_code=401, detail="Linear rejected that key") from exc
    if viewer["id"] not in allowed_ids():
        raise HTTPException(status_code=403, detail="This app is private and that Linear account isn't on its allow-list")

    response = Response(status_code=204)
    set_cookie(response, SESSION_COOKIE, seal({"user": _user(viewer), "method": "key", "api_key": api_key}), SESSION_SECONDS)
    return response


def require_session(request: Request, response: Response) -> dict:
    """The signed-in session, with its access token refreshed if it is about to expire."""
    session = unseal(request.cookies.get(SESSION_COOKIE), SESSION_SECONDS)
    if not session or session["user"]["id"] not in allowed_ids():
        raise HTTPException(status_code=401, detail="Sign in with Linear")

    if session.get("refresh_token") and session["expires_at"] < time.time() + REFRESH_MARGIN_SECONDS:
        try:
            session.update(
                _token_request(
                    {
                        "grant_type": "refresh_token",
                        "refresh_token": session["refresh_token"],
                        "client_id": _setting("LINEAR_CLIENT_ID"),
                        "client_secret": _setting("LINEAR_CLIENT_SECRET"),
                    }
                )
            )
        except LinearError as exc:
            raise HTTPException(status_code=401, detail="Session expired, sign in again") from exc
        set_cookie(response, SESSION_COOKIE, seal(session), SESSION_SECONDS)
    return session


def linear_authorization(request: Request, response: Response) -> str:
    """The Authorization header value to call Linear with for this request."""
    if auth_disabled():
        # Local dev: the personal API key, sent as-is with no "Bearer".
        return os.getenv("LINEAR_API_KEY", "")
    session = require_session(request, response)
    if session.get("method") == "key":
        return session["api_key"]
    return f"Bearer {session['access_token']}"


@router.get("/api/me")
def me(request: Request, response: Response):
    if auth_disabled():
        return {"id": "local", "name": "Local dev", "email": None, "workspace": None, "method": "local", "auth_disabled": True}
    session = require_session(request, response)
    return {**session["user"], "method": session.get("method", "oauth"), "auth_disabled": False}


@router.post("/auth/logout", status_code=204)
def logout(request: Request):
    session = unseal(request.cookies.get(SESSION_COOKIE), SESSION_SECONDS)
    # Only OAuth tokens are revoked; a personal API key stays valid until you remove it in Linear.
    if session and session.get("method", "oauth") == "oauth":
        # Revoke the refresh token too: otherwise a copied cookie could keep minting new access tokens.
        for hint in ("refresh_token", "access_token"):
            if not session.get(hint):
                continue
            try:
                httpx.post(REVOKE_URL, data={"token": session[hint], "token_type_hint": hint}, timeout=10)
            except httpx.HTTPError:
                pass  # The cookie is cleared either way.
    response = Response(status_code=204)
    response.delete_cookie(SESSION_COOKIE)
    return response
