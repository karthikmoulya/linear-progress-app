from datetime import date, datetime

from pydantic import BaseModel


class Issue(BaseModel):
    """One Linear issue, flattened from the GraphQL shape."""

    identifier: str
    title: str
    url: str
    due_date: date | None
    state_type: str
    state_name: str = ""
    labels: list[str]
    milestone: str | None
    milestone_target: date | None
    description: str

    @classmethod
    def from_linear(cls, node: dict) -> "Issue":
        milestone = node.get("projectMilestone") or {}
        return cls(
            identifier=node["identifier"],
            title=node["title"],
            url=node["url"],
            due_date=node.get("dueDate"),
            state_type=node["state"]["type"],
            state_name=node["state"].get("name", ""),
            labels=[l["name"] for l in node["labels"]["nodes"]],
            milestone=milestone.get("name"),
            milestone_target=milestone.get("targetDate"),
            description=node.get("description") or "",
        )


class ChecklistItem(BaseModel):
    text: str
    done: bool


class Block(BaseModel):
    time: str
    subject: str
    topic: str
    items: list[ChecklistItem]


class DayPlan(BaseModel):
    day: int
    date: date
    title: str
    url: str
    done: bool
    blocks: list[Block]
    # Set only when no blocks could be parsed, so the UI can show the raw text instead.
    raw_description: str | None = None


class TodayResponse(BaseModel):
    date: date
    is_weekend: bool
    today: DayPlan | None
    catch_up: list[DayPlan]


class Project(BaseModel):
    id: str
    name: str
    target_date: date | None = None
    url: str | None = None


class Summary(BaseModel):
    current_day: int
    total_days: int
    issues_done: int
    issues_total: int
    overall_pct: float
    checklist_pct: float
    dsa_solved: int
    dsa_total: int
    days_behind: int
    last_synced: datetime


class DayStatus(BaseModel):
    day: int
    date: date
    title: str
    identifier: str
    url: str
    # done | today | missed | planned
    status: str


class WeekIssue(BaseModel):
    identifier: str
    subject: str
    topic: str
    state: str
    done: bool
    due_date: date | None
    url: str


class WeekProgress(BaseModel):
    name: str
    target_date: date | None
    daily_done: int
    daily_total: int
    checklist_pct: float
    is_current: bool
    days: list[DayStatus]
    issues: list[WeekIssue]


class DaysLog(BaseModel):
    days: list[DayStatus]
    streak: int
    best: int


class Upcoming(BaseModel):
    date: date
    title: str
    identifier: str | None
    url: str | None
    meta: str


class SubjectProgress(BaseModel):
    subject: str
    weekly_done: int
    weekly_total: int
    checklist_pct: float
    next_topic: str | None
