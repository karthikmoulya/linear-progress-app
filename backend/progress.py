"""Progress rules from the design doc. Pure functions: "today" is always passed in."""

from datetime import date, datetime

from models import (
    DayPlan,
    DaysLog,
    DayStatus,
    Issue,
    Summary,
    SubjectProgress,
    TodayResponse,
    Upcoming,
    WeekIssue,
    WeekProgress,
)
from parser import parse_blocks, parse_checklist, parse_day_number

DAILY_LABEL = "Daily Plan"
SUBJECTS = ["DSA", "Agentic AI", "System Design", "Portfolio Project"]
DSA_TOTAL = 150


def is_done(issue: Issue) -> bool:
    # State names can be renamed in Linear; state types can't.
    return issue.state_type == "completed"


def is_daily(issue: Issue) -> bool:
    return DAILY_LABEL in issue.labels


def daily_issues(issues: list[Issue]) -> list[Issue]:
    days = [i for i in issues if is_daily(i) and i.due_date is not None]
    return sorted(days, key=lambda i: i.due_date)


def pct(part: int, whole: int) -> float:
    return round(100 * part / whole, 1) if whole else 0.0


def checklist_pct(issues: list[Issue]) -> float:
    items = [item for i in issues for item in parse_checklist(i.description)]
    return pct(sum(item.done for item in items), len(items))


def dsa_solved(issues: list[Issue]) -> int:
    return sum(
        item.done
        for i in daily_issues(issues)
        for block in parse_blocks(i.description)
        if block.subject == "DSA"
        for item in block.items
    )


def missed_days(issues: list[Issue], today: date) -> list[Issue]:
    return [i for i in daily_issues(issues) if i.due_date < today and not is_done(i)]


def days_behind(issues: list[Issue], today: date) -> int:
    return len(missed_days(issues, today))


def today_issue(issues: list[Issue], today: date) -> Issue | None:
    return next((i for i in daily_issues(issues) if i.due_date == today), None)


def current_day(issues: list[Issue], today: date) -> int:
    """Day number of the latest daily issue due on or before today (0 before the plan starts)."""
    started = [i for i in daily_issues(issues) if i.due_date <= today]
    return (parse_day_number(started[-1].title) or 0) if started else 0


def to_day_plan(issue: Issue) -> DayPlan:
    blocks = parse_blocks(issue.description)
    return DayPlan(
        day=parse_day_number(issue.title) or 0,
        date=issue.due_date,
        title=issue.title,
        url=issue.url,
        done=is_done(issue),
        blocks=blocks,
        raw_description=None if blocks else issue.description,
    )


def today_view(issues: list[Issue], today: date) -> TodayResponse:
    weekend = today.weekday() >= 5
    issue = today_issue(issues, today)
    return TodayResponse(
        date=today,
        is_weekend=weekend,
        today=to_day_plan(issue) if issue else None,
        catch_up=[to_day_plan(i) for i in missed_days(issues, today)] if weekend else [],
    )


def summary(issues: list[Issue], today: date, last_synced: datetime) -> Summary:
    done = sum(is_done(i) for i in issues)
    return Summary(
        current_day=current_day(issues, today),
        total_days=len(daily_issues(issues)),
        issues_done=done,
        issues_total=len(issues),
        overall_pct=pct(done, len(issues)),
        checklist_pct=checklist_pct(issues),
        dsa_solved=dsa_solved(issues),
        dsa_total=DSA_TOTAL,
        days_behind=days_behind(issues, today),
        last_synced=last_synced,
    )


def weeks(issues: list[Issue], today: date) -> list[WeekProgress]:
    groups: dict[str, list[Issue]] = {}
    for i in issues:
        if i.milestone:
            groups.setdefault(i.milestone, []).append(i)

    rows = []
    for name, group in groups.items():
        daily = daily_issues(group)
        rows.append(
            WeekProgress(
                name=name,
                target_date=group[0].milestone_target,
                daily_done=sum(is_done(i) for i in daily),
                daily_total=len(daily),
                checklist_pct=checklist_pct(group),
                is_current=False,
                days=[day_status(i, today) for i in daily],
                issues=[week_issue(i) for i in subject_issues(group)],
            )
        )
    rows.sort(key=lambda w: (w.target_date is None, w.target_date or date.max))

    # The current week is the first one whose target date hasn't passed yet.
    current = next((w for w in rows if w.target_date and w.target_date >= today), None)
    if current:
        current.is_current = True
    return rows


def subjects(issues: list[Issue], today: date) -> list[SubjectProgress]:
    rows = []
    for subject in SUBJECTS:
        group = sorted((i for i in issues if subject in i.labels), key=lambda i: i.due_date or date.max)
        # "Next" is the first open weekly issue after the one due this week.
        upcoming = [i for i in group if not is_done(i) and i.due_date and i.due_date >= today]
        nxt = upcoming[1] if len(upcoming) > 1 else None
        rows.append(
            SubjectProgress(
                subject=subject,
                weekly_done=sum(is_done(i) for i in group),
                weekly_total=len(group),
                checklist_pct=checklist_pct(group),
                next_topic=week_issue(nxt).topic if nxt else None,
            )
        )
    return rows


def subject_of(issue: Issue) -> str | None:
    return next((s for s in SUBJECTS if s in issue.labels), None)


def subject_issues(issues: list[Issue]) -> list[Issue]:
    found = [i for i in issues if subject_of(i)]
    return sorted(found, key=lambda i: SUBJECTS.index(subject_of(i)))


def week_issue(issue: Issue) -> WeekIssue:
    # "W1 · DSA: Arrays & Hashing (9 problems)" → topic "Arrays & Hashing (9 problems)"
    _, sep, topic = issue.title.partition(": ")
    return WeekIssue(
        identifier=issue.identifier,
        subject=subject_of(issue) or "",
        topic=topic if sep else issue.title,
        state=issue.state_name,
        done=is_done(issue),
        due_date=issue.due_date,
        url=issue.url,
    )


def day_status(issue: Issue, today: date) -> DayStatus:
    if is_done(issue):
        status = "done"
    elif issue.due_date == today:
        status = "today"
    elif issue.due_date < today:
        status = "missed"
    else:
        status = "planned"
    return DayStatus(
        day=parse_day_number(issue.title) or 0,
        date=issue.due_date,
        title=issue.title,
        identifier=issue.identifier,
        url=issue.url,
        status=status,
    )


def days_log(issues: list[Issue], today: date) -> DaysLog:
    days = [day_status(i, today) for i in daily_issues(issues)]
    best = run = 0
    for d in days:
        if d.date > today:
            break
        if d.status == "done":
            run += 1
            best = max(best, run)
        elif d.status == "missed":
            run = 0
        # A day still in progress neither extends nor breaks the streak.
    return DaysLog(days=days, streak=run, best=best)


def upcoming(issues: list[Issue], today: date, limit: int = 4) -> list[Upcoming]:
    """Open one-off issues (not daily, not weekly subject work) due from today, then the plan's last day."""
    one_offs = sorted(
        (i for i in issues if not is_daily(i) and not subject_of(i) and i.due_date and i.due_date >= today and not is_done(i)),
        key=lambda i: i.due_date,
    )
    rows = [
        Upcoming(
            date=i.due_date,
            title=i.title,
            identifier=i.identifier,
            url=i.url,
            meta=", ".join(i.labels) or "Issue",
        )
        for i in one_offs[:limit]
    ]
    days = daily_issues(issues)
    if days and days[-1].due_date >= today:
        rows.append(
            Upcoming(date=days[-1].due_date, title="Study plan complete", identifier=None, url=None, meta=days[-1].milestone or "")
        )
    return rows
