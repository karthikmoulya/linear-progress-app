import hashlib
import json
import os
import re
import threading
import time
from datetime import date, datetime, timezone
from pathlib import Path
from zoneinfo import ZoneInfo

from dotenv import load_dotenv
from fastapi import Depends, FastAPI, HTTPException, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

import progress
from auth import auth_disabled, check_config, is_production, linear_authorization, set_cookie
from auth import router as auth_router
from linear_client import LinearError, fetch_issues, fetch_project, fetch_projects
from models import DaysLog, Issue, Project, Summary, SubjectProgress, TodayResponse, Upcoming, WeekProgress

load_dotenv()

TZ = ZoneInfo("Asia/Kolkata")
CACHE_SECONDS = 60
FRONTEND_DIST = Path(__file__).parent.parent / "frontend" / "dist"
PROJECT_COOKIE = "lp_project"
UUID_RE = re.compile(r"^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$")


def today_local() -> date:
    # All "today" logic follows Asia/Kolkata, not the server's clock.
    return datetime.now(TZ).date()


class Snapshot:
    def __init__(self, project: Project, issues: list[Issue]):
        self.project = project
        self.issues = issues
        self.fetched_at = time.monotonic()
        self.synced_at = datetime.now(timezone.utc)


class IssueCache:
    """Keeps each project's issues in memory for CACHE_SECONDS, so Linear sees at most one fetch a minute.

    Entries are keyed by credential as well as project, so one signed-in account never sees data
    fetched with another's token.
    """

    def __init__(self, fetcher, ttl: float = CACHE_SECONDS):
        self.fetcher = fetcher
        self.ttl = ttl
        self.entries: dict[str, Snapshot] = {}
        self._lock = threading.Lock()

    def get(self, authorization: str, project_id: str) -> Snapshot:
        key = (hashlib.sha256(authorization.encode()).hexdigest(), project_id)
        with self._lock:
            entry = self.entries.get(key)
            if entry is None or time.monotonic() - entry.fetched_at > self.ttl:
                project, nodes = self.fetcher(authorization, project_id)
                entry = Snapshot(Project(**project), [Issue.from_linear(n) for n in nodes])
                self.entries[key] = entry
            return entry

    def clear(self) -> None:
        with self._lock:
            self.entries.clear()


def fetch_from_linear(authorization: str, project_id: str) -> tuple[dict, list[dict]]:
    # Dev only: LINEAR_FIXTURE=tests/fixtures/sample_issues.json serves a saved response instead of Linear.
    if fixture := os.getenv("LINEAR_FIXTURE"):
        return {"id": project_id, "name": "Sample project"}, json.loads(Path(fixture).read_text())
    project = fetch_project(authorization, project_id)
    return {**project, "target_date": project.get("targetDate")}, fetch_issues(authorization, project_id)


cache = IssueCache(fetch_from_linear)

check_config()
# The interactive API docs are handy locally but needn't be public.
docs = {} if auth_disabled() else {"docs_url": None, "redoc_url": None, "openapi_url": None}
app = FastAPI(title="Linear Progress Tracker", **docs)

CSP = "; ".join(
    [
        "default-src 'self'",
        "script-src 'self'",
        # React sets inline style attributes; Google Fonts serves the stylesheet and font files.
        "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
        "font-src https://fonts.gstatic.com",
        "img-src 'self' data:",
        "connect-src 'self'",
        "frame-ancestors 'none'",
        "base-uri 'none'",
        "form-action 'self'",
    ]
)


@app.middleware("http")
async def security_headers(request: Request, call_next):
    response = await call_next(request)
    response.headers["Content-Security-Policy"] = CSP
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    if is_production():
        response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
    return response

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
    allow_credentials=True,
)
app.include_router(auth_router)


def selected_project(request: Request) -> str:
    """The project picked in the switcher (a cookie), else LINEAR_PROJECT_ID."""
    chosen = request.cookies.get(PROJECT_COOKIE, "")
    if UUID_RE.match(chosen):
        return chosen
    default = os.getenv("LINEAR_PROJECT_ID")
    if not default:
        raise HTTPException(status_code=500, detail="LINEAR_PROJECT_ID is not set")
    return default


def load_snapshot(
    authorization: str = Depends(linear_authorization), project_id: str = Depends(selected_project)
) -> Snapshot:
    try:
        return cache.get(authorization, project_id)
    except LinearError as exc:
        raise HTTPException(status_code=502, detail=f"Linear: {exc}") from exc


def load_issues(snapshot: Snapshot = Depends(load_snapshot)) -> list[Issue]:
    return snapshot.issues


@app.get("/api/projects", response_model=list[Project])
def get_projects(authorization: str = Depends(linear_authorization)):
    try:
        nodes = fetch_projects(authorization)
    except LinearError as exc:
        raise HTTPException(status_code=502, detail=f"Linear: {exc}") from exc
    return sorted((Project(**n, target_date=n.get("targetDate")) for n in nodes), key=lambda p: p.name.lower())


@app.get("/api/project", response_model=Project)
def get_project(snapshot: Snapshot = Depends(load_snapshot)):
    return snapshot.project


class ProjectChoice(BaseModel):
    id: str


@app.post("/api/project", status_code=204)
def choose_project(choice: ProjectChoice, authorization: str = Depends(linear_authorization)):
    if not UUID_RE.match(choice.id):
        raise HTTPException(status_code=400, detail="Not a Linear project ID")
    # Linear decides access: a project this account can't see fails here instead of on every page load.
    try:
        fetch_project(authorization, choice.id)
    except LinearError as exc:
        raise HTTPException(status_code=404, detail=f"Linear: {exc}") from exc
    response = Response(status_code=204)
    set_cookie(response, PROJECT_COOKIE, choice.id, 365 * 24 * 3600)
    return response


@app.get("/api/today", response_model=TodayResponse)
def get_today(issues: list[Issue] = Depends(load_issues)):
    return progress.today_view(issues, today_local())


@app.get("/api/summary", response_model=Summary)
def get_summary(snapshot: Snapshot = Depends(load_snapshot)):
    return progress.summary(snapshot.issues, today_local(), snapshot.synced_at)


@app.get("/api/weeks", response_model=list[WeekProgress])
def get_weeks(issues: list[Issue] = Depends(load_issues)):
    return progress.weeks(issues, today_local())


@app.get("/api/subjects", response_model=list[SubjectProgress])
def get_subjects(issues: list[Issue] = Depends(load_issues)):
    return progress.subjects(issues, today_local())


@app.get("/api/days", response_model=DaysLog)
def get_days(issues: list[Issue] = Depends(load_issues)):
    return progress.days_log(issues, today_local())


@app.get("/api/upcoming", response_model=list[Upcoming])
def get_upcoming(issues: list[Issue] = Depends(load_issues)):
    return progress.upcoming(issues, today_local())


@app.post("/api/refresh", response_model=Summary)
def refresh(authorization: str = Depends(linear_authorization), project_id: str = Depends(selected_project)):
    cache.clear()
    return get_summary(load_snapshot(authorization, project_id))


# One service in production: FastAPI also serves the built React app (npm run build).
# Mounted last so the API and auth routes above take priority.
if FRONTEND_DIST.is_dir():
    app.mount("/", StaticFiles(directory=FRONTEND_DIST, html=True), name="frontend")
