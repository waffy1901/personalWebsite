#!/usr/bin/env python3
"""Summarize captured REST run/job timings without attributing a cause."""
import argparse
from datetime import datetime
import json
from pathlib import Path
import sys


def timestamp(value):
    if value is None:
        return None
    if not isinstance(value, str):
        raise ValueError("timestamps must be strings or null")
    parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    if parsed.tzinfo is None:
        raise ValueError("timestamps must include a UTC offset")
    return parsed


def interval(start, end, label, unknowns):
    try:
        first, last = timestamp(start), timestamp(end)
        if first is None or last is None:
            unknowns.append(f"{label}: missing timestamp")
            return None
        seconds = (last - first).total_seconds()
        if seconds < 0:
            raise ValueError("end precedes start")
        return seconds
    except ValueError as error:
        unknowns.append(f"{label}: {error}")
        return None


def summarize(run, pages, expected_at=None):
    if not isinstance(run, dict) or not isinstance(run.get("id"), int):
        raise ValueError("run must be a REST run object with an integer id")
    pages = [pages] if isinstance(pages, dict) else pages
    if not isinstance(pages, list) or not pages:
        raise ValueError("jobs must be an object or a nonempty list of pages")
    jobs = []
    for page in pages:
        if not isinstance(page, dict) or not isinstance(page.get("jobs"), list):
            raise ValueError("each jobs page must contain a jobs array")
        jobs.extend(page["jobs"])
    total = pages[0].get("total_count")
    if total is not None and (type(total) is not int or total != len(jobs)):
        raise ValueError("jobs capture is incomplete or changed during pagination")
    unknowns = []
    result = {key: run.get(key) for key in (
        "id", "name", "path", "event", "head_branch", "head_sha", "run_attempt",
        "status", "conclusion", "html_url", "created_at", "run_started_at",
    )}
    result["expected_at"] = expected_at
    result["trigger_to_creation_seconds"] = None
    if expected_at is not None:
        if run.get("event") == "schedule":
            result["trigger_to_creation_seconds"] = interval(
                expected_at, run.get("created_at"), "trigger_to_creation", unknowns)
        else:
            unknowns.append("trigger_to_creation: not a scheduled event")
    result["creation_to_run_start_seconds"] = interval(
        run.get("created_at"), run.get("run_started_at"), "creation_to_run_start", unknowns)
    if run.get("run_attempt", 1) != 1:
        unknowns.append("rerun: run creation is original; its elapsed start gap is not rerun queue time")
    result["jobs"] = []
    seen = set()
    for job in jobs:
        if not isinstance(job, dict) or job.get("run_id") != run["id"]:
            raise ValueError("job identity does not match the captured run")
        if job.get("run_attempt") not in (None, run.get("run_attempt")):
            raise ValueError("job attempt does not match the captured run")
        if job.get("id") is None or job["id"] in seen:
            raise ValueError("jobs require unique ids")
        seen.add(job["id"])
        row = {key: job.get(key) for key in (
            "id", "name", "status", "conclusion", "created_at", "started_at",
            "completed_at", "runner_id", "runner_name", "html_url",
        )}
        row["creation_to_start_seconds"] = interval(
            job.get("created_at"), job.get("started_at"), f"job {job['id']} wait", unknowns)
        row["execution_seconds"] = interval(
            job.get("started_at"), job.get("completed_at"), f"job {job['id']} execution", unknowns)
        row["notable_steps"] = [step.get("name") for step in job.get("steps", [])
                                if step.get("conclusion") in ("failure", "cancelled")]
        result["jobs"].append(row)
    result["unknowns"] = unknowns
    return result


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--run", required=True, type=Path)
    parser.add_argument("--jobs", required=True, type=Path)
    parser.add_argument("--expected-at")
    args = parser.parse_args()
    try:
        result = summarize(json.loads(args.run.read_text()), json.loads(args.jobs.read_text()), args.expected_at)
    except (ValueError, OSError, TypeError) as error:
        print(f"Invalid timing evidence: {error}", file=sys.stderr)
        return 2
    print(json.dumps(result, indent=2, sort_keys=True))
    return 0


if __name__ == "__main__":
    sys.exit(main())
