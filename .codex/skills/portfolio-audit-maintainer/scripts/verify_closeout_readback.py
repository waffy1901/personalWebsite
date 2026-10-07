#!/usr/bin/env python3
"""Compare independently captured issue/project reads with intended state."""
import argparse
from datetime import datetime
import json
from pathlib import Path
import sys

REQUIRED_FIELDS = {"Status", "Priority", "Severity", "Area", "Evidence needed"}
PROJECT_URL = "https://github.com/users/waffy1901/projects/2"


def timestamp(value):
    if not isinstance(value, str):
        raise ValueError("capture/write timestamps must be strings")
    parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    if parsed.tzinfo is None:
        raise ValueError("timestamps must include a UTC offset")
    return parsed


def canonical(value):
    if isinstance(value, list):
        if any(not isinstance(item, str) or not item for item in value) or len(set(value)) != len(value):
            raise ValueError("selected options and assignees must be unique nonempty strings")
        return sorted(value)
    if value is not None and not isinstance(value, str):
        raise ValueError("field values must be strings, arrays of names, or null")
    return value


def verify(snapshot, expected):
    if not isinstance(snapshot, dict) or not isinstance(expected, dict):
        raise ValueError("snapshot and expectation must be objects")
    complete = snapshot.get("complete", {})
    if not isinstance(complete, dict) or any(complete.get(key) is not True for key in ("assignees", "items", "fields")):
        raise ValueError("readback connections are incomplete")
    if timestamp(snapshot.get("captured_at")) <= timestamp(expected.get("mutation_completed_at")):
        raise ValueError("readback must follow the final authorized write")
    issue, wanted = snapshot.get("issue"), expected.get("issue")
    project, wanted_project = snapshot.get("project"), expected.get("project")
    if not all(isinstance(item, dict) for item in (issue, wanted, project, wanted_project)):
        raise ValueError("issue and project objects are required")
    required_issue = ("url", "number", "state", "stateReason", "assignees")
    if any(key not in item for item in (issue, wanted) for key in required_issue):
        raise ValueError("issue identity/state/assignment is incomplete")
    if type(wanted["number"]) is not int or type(issue["number"]) is not int or not isinstance(wanted["assignees"], list) or not isinstance(issue["assignees"], list):
        raise ValueError("issue number and assignees have invalid types")
    if wanted["url"] != f"https://github.com/waffy1901/personalWebsite/issues/{wanted['number']}":
        raise ValueError("expectation must identify this repository's issue URL")
    if wanted["state"] != "CLOSED" or not isinstance(wanted["stateReason"], str) or not wanted["stateReason"]:
        raise ValueError("closeout expectation must name a CLOSED state and reason")
    if project.get("url") != PROJECT_URL or wanted_project.get("url") != PROJECT_URL:
        raise ValueError("readback must target Portfolio Project 2")
    fields = wanted_project.get("fields")
    if not isinstance(fields, dict) or not REQUIRED_FIELDS.issubset(fields):
        raise ValueError("expectation must include every required project field")
    if fields["Status"] != "Done":
        raise ValueError("closed-out project status must be Done")
    if not isinstance(wanted_project.get("item_id"), str) or not wanted_project["item_id"]:
        raise ValueError("expectation must pin the existing project item id")
    items = project.get("items")
    if not isinstance(items, list) or any(not isinstance(item, dict) for item in items):
        raise ValueError("project items must be an array of objects")
    matches = [item for item in items if item.get("issue_url") == wanted["url"]]
    errors = []
    for key in required_issue:
        actual, intended = (canonical(issue[key]), canonical(wanted[key])) if key == "assignees" else (issue[key], wanted[key])
        if actual != intended:
            errors.append(f"issue {key} differs")
    if len(matches) != 1:
        errors.append(f"expected exactly one issue item; found {len(matches)}")
    else:
        item = matches[0]
        if item.get("id") != wanted_project["item_id"]:
            errors.append("project item id differs")
        actual_fields = item.get("fields")
        if not isinstance(actual_fields, dict):
            raise ValueError("item field values must be an object")
        for name, value in fields.items():
            if name not in actual_fields or canonical(actual_fields[name]) != canonical(value):
                errors.append(f"project field {name} differs or is missing")
    return {"verified": not errors, "issue_url": wanted["url"], "project_url": PROJECT_URL,
            "captured_at": snapshot["captured_at"], "mismatches": errors}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--snapshot", required=True, type=Path)
    parser.add_argument("--expected", required=True, type=Path)
    args = parser.parse_args()
    try:
        result = verify(json.loads(args.snapshot.read_text()), json.loads(args.expected.read_text()))
    except (ValueError, OSError, TypeError) as error:
        print(f"Invalid closeout readback: {error}", file=sys.stderr)
        return 2
    print(json.dumps(result, indent=2, sort_keys=True))
    return 0 if result["verified"] else 1


if __name__ == "__main__":
    sys.exit(main())
