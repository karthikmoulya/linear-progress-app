# Linear Progress Tracker

A personal dashboard ("Plan Tracker") for a study plan kept as a Linear project: today's study blocks and checklist, and progress overall, per week and per subject. Read-only. Linear stays the source of truth.

React (Vite, Tailwind) → FastAPI → Linear GraphQL. The API key lives only in `backend/.env`.

## Run it

```bash
# Backend (Python 3.12)
cd backend
uv venv --python 3.12 .venv && uv pip install -p .venv -r requirements.txt
cp .env.example .env            # paste your Linear personal API key and project ID
.venv/bin/python linear_client.py   # Step 1 check: prints issue counts, saves tests/fixtures/issues.json
.venv/bin/uvicorn main:app --reload --port 8000

# Frontend
cd frontend
npm install
npm run dev                     # http://localhost:5173, proxies /api to :8000
```

No key yet? Start the backend with `LINEAR_FIXTURE=tests/fixtures/sample_issues.json` to serve the sample data.

## Sign in with Linear

With `AUTH_DISABLED=true` (local default) the backend uses the personal API key and there is no login. To turn login on:

1. Linear → Settings → API → OAuth applications → New. Add redirect URIs `http://localhost:5173/auth/callback` (dev, through the Vite proxy) and, on deploy, `https://<your-app>.onrender.com/auth/callback`.
2. Put the client ID and secret in `backend/.env` as `LINEAR_CLIENT_ID` / `LINEAR_CLIENT_SECRET`, and set `AUTH_DISABLED=false`.
3. Restart the backend, open http://localhost:5173 and click **Sign in with Linear**.

The sign-in page also offers **Use a personal API key instead**: the key is checked with Linear and the allow-list, then kept only inside the encrypted session cookie (never revoked on sign-out; remove it in Linear).

Only the Linear user IDs in `ALLOWED_LINEAR_USER_IDS` get in; anyone else gets a 403. The browser holds only an encrypted, HttpOnly session cookie (7 days); Linear tokens never reach it. Access tokens are refreshed automatically when they expire.

For production, `npm run build` in `frontend/` and FastAPI serves `frontend/dist` itself, so the whole app is one service.

## API

| Route | Returns |
| --- | --- |
| `GET /api/today` | Today's daily issue; on weekends, missed days as a catch-up list |
| `GET /api/summary` | Overall %, checklist %, DSA solved / 150, days behind, last synced |
| `GET /api/weeks` | One row per milestone: daily issues done, checklist %, current week |
| `GET /api/subjects` | DSA, Agentic AI, System Design, Portfolio Project |
| `GET /api/days` | All daily issues with status (done / today / missed / planned), streak, best |
| `GET /api/upcoming` | Open one-off issues (e.g. Job Search) by due date, then the plan's last day |
| `GET /api/projects` · `GET/POST /api/project` | Project switcher: list projects, read or pick the current one |
| `POST /api/refresh` | Clears the 60 s cache and refetches |

"Today" is computed in Asia/Kolkata. An issue is done when its state type is `completed`.

## Tests

```bash
cd backend && .venv/bin/python -m pytest
cd frontend && npm test
```

Tests run on `backend/tests/fixtures/sample_issues.json`, a small hand-built fixture with fixed counts. `issues.json` (from `linear_client.py`) is the real response, for local exploring.

## Project switcher

The header's project menu lists every Linear project your account can see. The choice is kept in a cookie; the default is `LINEAR_PROJECT_ID`. The study-plan views assume this plan's conventions (`Daily Plan` label, `Day N · …` titles, subject labels, weekly milestones), so other projects show mostly empty panels.
# linear-progress-app
