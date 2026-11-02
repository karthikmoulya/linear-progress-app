"""Fetches every issue of the Linear project through the GraphQL API."""

import json
import os
import sys
from pathlib import Path

import httpx

LINEAR_URL = "https://api.linear.app/graphql"

ISSUES_QUERY = """
query ProjectIssues($projectId: ID!, $cursor: String) {
  issues(filter: { project: { id: { eq: $projectId } } }, first: 100, after: $cursor) {
    nodes {
      identifier
      title
      url
      dueDate
      description
      state { name type }
      labels { nodes { name } }
      projectMilestone { name targetDate }
    }
    pageInfo { hasNextPage endCursor }
  }
}
"""


class LinearError(Exception):
    """Linear could not be reached, rejected the key, or returned GraphQL errors."""


VIEWER_QUERY = "query Viewer { viewer { id name email organization { name urlKey } } }"
PROJECT_FIELDS = "id name targetDate url"
PROJECTS_QUERY = f"query Projects {{ projects(first: 100) {{ nodes {{ {PROJECT_FIELDS} }} }} }}"
PROJECT_QUERY = f"query Project($id: String!) {{ project(id: $id) {{ {PROJECT_FIELDS} }} }}"


def graphql(authorization: str, query: str, variables: dict | None = None, client: httpx.Client | None = None) -> dict:
    """POSTs one GraphQL request and returns its `data`.

    `authorization` is the whole header value: a personal API key as-is (no "Bearer"),
    or "Bearer <token>" for an OAuth access token.
    """
    if not authorization:
        raise LinearError("LINEAR_API_KEY is not set")

    headers = {"Authorization": authorization, "Content-Type": "application/json"}
    own_client = client is None
    client = client or httpx.Client(timeout=15)
    try:
        resp = client.post(LINEAR_URL, json={"query": query, "variables": variables or {}}, headers=headers)
    except httpx.HTTPError as exc:
        raise LinearError(f"Could not reach Linear: {exc}") from exc
    finally:
        if own_client:
            client.close()

    payload = _json_or_none(resp)
    if resp.status_code != 200:
        raise LinearError(_error_message(payload) or f"Linear returned HTTP {resp.status_code}")
    if payload is None:
        raise LinearError("Linear returned a non-JSON response")
    # GraphQL errors arrive with HTTP 200, so the body has to be checked too.
    if payload.get("errors"):
        raise LinearError(_error_message(payload))
    return payload["data"]


def fetch_issues(authorization: str, project_id: str, client: httpx.Client | None = None) -> list[dict]:
    issues: list[dict] = []
    cursor = None
    while True:
        data = graphql(authorization, ISSUES_QUERY, {"projectId": project_id, "cursor": cursor}, client)
        page = data["issues"]
        issues.extend(page["nodes"])
        if not page["pageInfo"]["hasNextPage"]:
            return issues
        cursor = page["pageInfo"]["endCursor"]


def fetch_viewer(authorization: str) -> dict:
    return graphql(authorization, VIEWER_QUERY)["viewer"]


def fetch_projects(authorization: str) -> list[dict]:
    return graphql(authorization, PROJECTS_QUERY)["projects"]["nodes"]


def fetch_project(authorization: str, project_id: str) -> dict:
    return graphql(authorization, PROJECT_QUERY, {"id": project_id})["project"]


def _json_or_none(resp: httpx.Response) -> dict | None:
    try:
        return resp.json()
    except ValueError:
        return None


def _error_message(payload: dict | None) -> str:
    if not payload or not payload.get("errors"):
        return ""
    return "; ".join(e.get("message", "unknown error") for e in payload["errors"])


if __name__ == "__main__":
    # Step 1 check: python linear_client.py → prints counts and saves the fixture.
    from dotenv import load_dotenv

    load_dotenv()
    if not os.getenv("LINEAR_PROJECT_ID"):
        sys.exit("Set LINEAR_PROJECT_ID in .env")
    try:
        result = fetch_issues(os.getenv("LINEAR_API_KEY", ""), os.environ["LINEAR_PROJECT_ID"])
    except LinearError as exc:
        sys.exit(f"Linear error: {exc}")
    daily = [i for i in result if any(l["name"] == "Daily Plan" for l in i["labels"]["nodes"])]
    out = Path(__file__).parent / "tests" / "fixtures" / "issues.json"
    out.write_text(json.dumps(result, indent=2, ensure_ascii=False))
    print(f"{len(result)} issues, {len(daily)} with Daily Plan → saved {out}")
