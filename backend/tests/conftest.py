import json
import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).parent.parent))

from models import Issue  # noqa: E402

FIXTURE = Path(__file__).parent / "fixtures" / "sample_issues.json"


@pytest.fixture
def raw_issues() -> list[dict]:
    return json.loads(FIXTURE.read_text())


@pytest.fixture
def issues(raw_issues) -> list[Issue]:
    return [Issue.from_linear(node) for node in raw_issues]
