from datetime import date, datetime, timezone

import progress

WED = date(2026, 11, 4)
SAT = date(2026, 11, 7)


def test_done_uses_state_type(issues):
    done = [i.identifier for i in issues if progress.is_done(i)]
    assert len(done) == 2
    issues[0].state_type = "started"
    assert not progress.is_done(issues[0])


def test_checklist_pct(issues):
    # 19 checklist lines across the fixture, 5 ticked.
    assert progress.checklist_pct(issues) == 26.3


def test_dsa_solved_counts_ticked_dsa_items_in_daily_issues(issues):
    # Day 1: 2, Day 2: 1. The ticked weekly DSA issue doesn't count.
    assert progress.dsa_solved(issues) == 3


def test_days_behind_with_fixed_today(issues):
    assert progress.days_behind(issues, WED) == 1
    assert progress.days_behind(issues, SAT) == 3


def test_today_on_a_weekday(issues):
    view = progress.today_view(issues, WED)
    assert not view.is_weekend
    assert view.today.day == 3
    assert view.today.raw_description.startswith("Free study day")
    assert view.catch_up == []


def test_weekend_returns_catch_up_list(issues):
    view = progress.today_view(issues, SAT)
    assert view.is_weekend
    assert view.today is None
    assert [d.day for d in view.catch_up] == [2, 3, 5]


def test_summary(issues):
    s = progress.summary(issues, WED, datetime(2026, 11, 4, tzinfo=timezone.utc))
    assert (s.current_day, s.total_days, s.overall_pct, s.days_behind) == (3, 5, 25.0, 1)


def test_weeks_sorted_with_current_marked(issues):
    rows = progress.weeks(issues, WED)
    assert [w.name for w in rows] == ["Week 1 · Nov 2–6", "Week 13 · Jan 25–29"]
    assert (rows[0].daily_done, rows[0].daily_total, rows[0].is_current) == (1, 4, True)
    assert [w.is_current for w in progress.weeks(issues, SAT)] == [False, True]


def test_subjects(issues):
    rows = {s.subject: s for s in progress.subjects(issues, WED)}
    assert list(rows) == progress.SUBJECTS
    assert (rows["DSA"].weekly_done, rows["DSA"].weekly_total, rows["DSA"].checklist_pct) == (1, 1, 100.0)
    assert rows["System Design"].weekly_total == 0


def test_week_rows_carry_days_and_subject_issues(issues):
    week1 = progress.weeks(issues, WED)[0]
    assert [d.status for d in week1.days] == ["done", "missed", "today", "planned"]
    assert [(i.subject, i.topic) for i in week1.issues] == [
        ("DSA", "Arrays & Hashing (6 problems)"),
        ("Agentic AI", "LLM basics"),
    ]


def test_streak_ignores_today_and_resets_on_missed(issues):
    log = progress.days_log(issues, WED)
    assert (log.streak, log.best) == (0, 1)
    issues[1].state_type = "completed"
    assert progress.days_log(issues, WED).streak == 2


def test_upcoming_lists_one_offs_then_plan_end(issues):
    rows = progress.upcoming(issues, WED)
    # The job-search issue has no due date, so only the plan's last day is listed.
    assert [r.title for r in rows] == ["Study plan complete"]
    assert rows[0].date == date(2027, 1, 25)
