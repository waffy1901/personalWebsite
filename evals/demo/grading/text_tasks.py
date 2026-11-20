"""Grade the public ledger example using its distributed input."""

import json
from pathlib import Path


def grade(task_id, answer):
    if task_id != "E00":
        raise ValueError("unknown demonstration task")
    ledger = Path(__file__).resolve().parents[1] / "tasks/E00/files/ledger.json"
    expected = sum(row["status"] == "complete" for row in json.loads(ledger.read_text()))
    count = answer.get("completed")
    return {
        "assertions": {"completed_count": type(count) is int and count == expected},
        "review_counts": None,
    }
