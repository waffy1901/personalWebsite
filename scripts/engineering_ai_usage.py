"""Validate and summarize explicitly imported, sanitized AI usage totals."""

from calendar import monthrange
from collections import defaultdict
from datetime import date, timedelta
import json
import re


MAX_BYTES = 1024 * 1024
MAX_VALUE = 10**12
METRICS = {
    "input_tokens": "Input tokens",
    "output_tokens": "Output tokens",
    "total_tokens": "Total tokens",
    "sessions": "Sessions",
    "tool_calls": "Tool calls",
    "duration_seconds": "Duration (seconds)",
}
SLUG = re.compile(r"[A-Za-z0-9][A-Za-z0-9._-]{0,63}")
UTC_DATE = re.compile(r"[0-9]{4}-[0-9]{2}-[0-9]{2}")
REQUIRED = {"source", "provider", "start", "end", "scope", "metrics"}
OPTIONAL = {"model", "repository", "work_item"}
DAY = timedelta(days=1)
WEEK = timedelta(days=7)


class InvalidUsage(ValueError):
    """An import error whose message contains no data from the input."""


def unique_object(pairs):
    result = dict(pairs)
    if len(result) != len(pairs):
        raise InvalidUsage("AI usage JSON contains duplicate object keys")
    return result


def parse_date(value):
    if isinstance(value, str) and UTC_DATE.fullmatch(value):
        try:
            return date.fromisoformat(value)
        except ValueError:
            pass
    raise InvalidUsage("start and end must be UTC dates in YYYY-MM-DD format")


def parse_record(row, repo):
    if not isinstance(row, dict) or not REQUIRED <= row.keys() <= REQUIRED | OPTIONAL:
        raise InvalidUsage("record fields do not match the AI usage format")
    for name in ("source", "provider", "model"):
        value = row.get(name)
        if name == "model" and value is None:
            continue
        if not isinstance(value, str) or not SLUG.fullmatch(value):
            raise InvalidUsage(f"{name} must be a short ASCII identifier")
    start, end = parse_date(row["start"]), parse_date(row["end"])
    if start >= end:
        raise InvalidUsage("end must follow start")
    metrics = row["metrics"]
    if not isinstance(metrics, dict) or not metrics or not metrics.keys() <= METRICS.keys():
        raise InvalidUsage("metrics must contain only supported usage counts")
    if any(type(value) is not int or not 0 <= value <= MAX_VALUE for value in metrics.values()):
        raise InvalidUsage("metric values must be nonnegative integers up to 1000000000000")

    scope = row["scope"]
    url = ""
    if scope == "account":
        if "repository" in row or "work_item" in row:
            raise InvalidUsage("account usage cannot include repository or work-item attribution")
    elif scope == "repository":
        if row.get("repository") != repo:
            raise InvalidUsage("repository usage must match --repo")
        if "work_item" in row:
            item = row["work_item"]
            canonical_url = rf"https://github\.com/{re.escape(repo)}/(?:issues|pull)/[1-9][0-9]{{0,19}}"
            if (not isinstance(item, dict) or item.keys() != {"url", "origin"}
                    or item["origin"] != "source_recorded" or not isinstance(item["url"], str)
                    or not re.fullmatch(canonical_url, item["url"])):
                raise InvalidUsage("work_item requires source_recorded origin and a canonical same-repository URL")
            url = item["url"]
    else:
        raise InvalidUsage("scope must be account or repository")
    series = (scope, row["provider"], row.get("model") or "", url)
    return series, {
        "source": row["source"], "start": start, "end": end,
        "metrics": {name: metrics[name] for name in METRICS if name in metrics},
    }


def parse_usage(contents, repo):
    if len(contents) > MAX_BYTES:
        raise InvalidUsage("AI usage JSON exceeds 1 MiB")
    try:
        snapshot = json.loads(contents.decode("utf-8"), object_pairs_hook=unique_object)
    except InvalidUsage:
        raise
    except (ValueError, RecursionError):
        raise InvalidUsage("AI usage file must contain valid UTF-8 JSON") from None
    if (not isinstance(snapshot, dict) or snapshot.keys() != {"schema_version", "records"}
            or type(snapshot["schema_version"]) is not int or snapshot["schema_version"] != 1
            or not isinstance(snapshot["records"], list)):
        raise InvalidUsage("expected a version 1 AI usage snapshot with a records array")

    groups = defaultdict(list)
    for index, row in enumerate(snapshot["records"], start=1):
        try:
            series, record = parse_record(row, repo)
        except InvalidUsage as error:
            raise InvalidUsage(f"Invalid AI usage record {index} ({error})") from None
        groups[series].append(record)
    for records in groups.values():
        records.sort(key=lambda record: record["start"])
        if any(current["start"] < previous["end"] for previous, current in zip(records, records[1:])):
            raise InvalidUsage("AI usage intervals overlap within a scope, provider, model and work item")
    return groups


def usage_window(start, end, records):
    return {
        "start": start.isoformat(), "end": end.isoformat(),
        "covered_days": sum((row["end"] - row["start"]).days for row in records),
        "record_count": len(records),
        "metrics": {
            name: sum(row["metrics"][name] for row in records)
            if all(name in row["metrics"] for row in records) else None
            for name in METRICS
        },
    }


def usage_rollups(records, monthly_merges):
    daily, weekly, monthly = defaultdict(list), defaultdict(list), defaultdict(list)
    for row in records:
        start, end = row["start"], row["end"]
        week = start - timedelta(days=start.weekday())
        month = start.replace(day=1)
        last = end - DAY
        if last == start:
            daily[start, end].append(row)
        if (last - week) < WEEK:
            weekly[week, week + WEEK].append(row)
        if last.replace(day=1) == month:
            month_end = month + timedelta(days=monthrange(month.year, month.month)[1])
            monthly[month, month_end].append(row)

    months = []
    for (start, end), rows in sorted(monthly.items()):
        window = usage_window(start, end, rows)
        key = (window["start"], window["end"])
        fully_covered = window["covered_days"] == (end - start).days
        window["repository_prs_merged"] = monthly_merges.get(key) if fully_covered else None
        months.append(window)
    return {
        "daily": [usage_window(start, end, rows) for (start, end), rows in sorted(daily.items())],
        "weekly": [usage_window(start, end, rows) for (start, end), rows in sorted(weekly.items())],
        "monthly": months,
        "lifetime": usage_window(records[0]["start"], records[-1]["end"], records),
    }


def build_ai_usage(report, groups, pulls, issues):
    cutoff = report["as_of"]
    cutoff_day = date.fromisoformat(cutoff[:10])
    monthly_merges = {}
    if report["coverage"]["pull_requests"]["status"] == "complete":
        monthly_merges = {
            (window["start"][:10], window["end"][:10]): window["delivery"]["prs_merged"]
            for window in report["rollups"]["monthly"] if not window["partial"] and window["history_available"]
        }

    after_cutoff = unresolved = 0
    series = []
    for (scope, provider, model, url), rows in sorted(groups.items()):
        records = [row for row in rows if row["end"] <= cutoff_day]
        after_cutoff += len(rows) - len(records)
        work_item = None
        if url:
            _, kind, number = url.rsplit("/", 2)
            inventory = pulls if kind == "pull" else issues
            item = (inventory or {}).get(int(number))
            if not item or item["created"] >= cutoff:
                unresolved += len(records)
                continue
            work_item = {"url": url, "origin": "source_recorded"}
        if records:
            series.append({
                "scope": scope, "provider": provider, "model": model or None, "work_item": work_item,
                "observations": [{
                    **row, "start": row["start"].isoformat(), "end": row["end"].isoformat(),
                } for row in records],
                "rollups": usage_rollups(records, monthly_merges if scope == "repository" and not url else {}),
            })
    return {
        "input_schema_version": 1,
        "excluded": {"after_cutoff": after_cutoff, "unresolved_work_item": unresolved},
        "series": series,
    }


def render_ai_usage(usage):
    excluded = usage["excluded"]
    lines = [
        "", "## Imported AI usage", "",
        "Totals cover imported observations. Dates use UTC and period ends are exclusive.",
        "Each scope, model and work item is a separate series. A blank model in the export denotes provider-level data.",
        "Merged PR counts describe repository activity in the same fully covered calendar month.",
        "",
        f'The report excluded {excluded["after_cutoff"]:,} observations ending after the cutoff '
        f'and {excluded["unresolved_work_item"]:,} observations with unverified work items.',
    ]
    if not usage["series"]:
        return lines + ["", "AI usage observations are N/A."]
    for series in usage["series"]:
        model = f'`{series["model"]}`' if series["model"] else "provider level"
        labels = ", ".join(f'`{label}`' for label in sorted({row["source"] for row in series["observations"]}))
        scope = "Account-wide" if series["scope"] == "account" else "Repository-wide"
        if series["work_item"]:
            scope = "Repository work item"
        lines += ["", f'### {scope} / `{series["provider"]}` / {model}', ""]
        lines.append(f"Source labels are {labels}.")
        if series["work_item"]:
            lines.append(f'[Source-recorded work item]({series["work_item"]["url"]})')
        columns = ["Period", "Start", "End", "Covered days", "Records", *METRICS.values(), "Repository PRs merged"]
        lines += ["", f"| {' | '.join(columns)} |", "|" + " --- |" * len(columns)]
        rollups = series["rollups"]
        windows = [("Imported lifetime", rollups["lifetime"])]
        for name in ("monthly", "weekly", "daily"):
            windows.extend((name.title(), row) for row in rollups[name][-3:])
        for name, row in windows:
            counts = [row["covered_days"], row["record_count"], *row["metrics"].values(),
                      row.get("repository_prs_merged")]
            cells = [name, row["start"], row["end"], *("N/A" if value is None else f"{value:,}" for value in counts)]
            lines.append(f"| {' | '.join(cells)} |")
    return lines
