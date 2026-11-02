"""Turns an issue description into study blocks and checklist items."""

import re

from models import Block, ChecklistItem

# A block heading is a whole bold line such as "**12:30–2:00 · DSA – Arrays & Hashing**".
# Lines like "**When:** Mon–Fri" in weekly issues have text after the bold part, so they don't match.
BLOCK_RE = re.compile(r"^\*\*(.+)\*\*$")
ITEM_RE = re.compile(r"^- \[( |x|X)\] (.+)$")
DAY_RE = re.compile(r"^Day (\d+)\b")


def parse_item(line: str) -> ChecklistItem | None:
    match = ITEM_RE.match(line.strip())
    if not match:
        return None
    return ChecklistItem(text=match.group(2).strip(), done=match.group(1) != " ")


def parse_checklist(description: str) -> list[ChecklistItem]:
    """Every checklist item in the description, whatever block it sits in."""
    return [item for line in description.splitlines() if (item := parse_item(line))]


def parse_heading(text: str) -> tuple[str, str, str] | None:
    if " · " not in text:
        return None
    time, rest = text.split(" · ", 1)
    subject, _, topic = rest.partition(" – ")
    return time.strip(), subject.strip(), topic.strip()


def parse_blocks(description: str) -> list[Block]:
    blocks: list[Block] = []
    for line in description.splitlines():
        line = line.strip()
        heading = BLOCK_RE.match(line)
        if heading and (parts := parse_heading(heading.group(1))):
            time, subject, topic = parts
            blocks.append(Block(time=time, subject=subject, topic=topic, items=[]))
        elif blocks and (item := parse_item(line)):
            blocks[-1].items.append(item)
    return blocks


def parse_day_number(title: str) -> int | None:
    match = DAY_RE.match(title)
    return int(match.group(1)) if match else None
