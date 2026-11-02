from parser import parse_blocks, parse_checklist, parse_day_number


def test_daily_issue_has_three_blocks(issues):
    blocks = parse_blocks(issues[0].description)
    assert [(b.time, b.subject, b.topic) for b in blocks] == [
        ("12:30–2:00", "DSA", "Arrays & Hashing"),
        ("3:00–4:15", "Portfolio Project", "Plan the project"),
        ("4:15–5:30", "System Design", "Fundamentals"),
    ]


def test_ticked_vs_unticked(issues):
    items = parse_blocks(issues[1].description)[0].items
    assert [(i.text, i.done) for i in items] == [("Two Sum", True), ("Group Anagrams", False)]


def test_description_without_checklist(issues):
    malformed = issues[2].description
    assert parse_blocks(malformed) == []
    assert parse_checklist(malformed) == []


def test_day_5_has_one_dsa_problem_and_day_61_three(issues):
    assert len(parse_blocks(issues[3].description)[0].items) == 1
    assert len(parse_blocks(issues[4].description)[0].items) == 3


def test_weekly_bold_labels_are_not_blocks(issues):
    weekly = issues[5].description
    assert parse_blocks(weekly) == []
    assert len(parse_checklist(weekly)) == 1


def test_day_number():
    assert parse_day_number("Day 61 · Mon 25 Jan") == 61
    assert parse_day_number("W1 · DSA") is None
