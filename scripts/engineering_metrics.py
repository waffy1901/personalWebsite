"""Compute UTC repository rollups and format the private report."""

from datetime import UTC, datetime, timedelta
from math import ceil
from statistics import median


WEEK = timedelta(days=7)
DAY = timedelta(days=1)
LINE_METRICS = ("additions", "deletions", "file_touches")


def timestamp(value):
    if value is None:
        return None
    parsed = datetime.fromisoformat(value)
    if parsed.tzinfo is None:
        raise ValueError("Expected an offset-aware timestamp")
    return iso(parsed.astimezone(UTC))


def iso(value):
    return value.isoformat(timespec="seconds").replace("+00:00", "Z")


def day_start(value):
    return datetime.fromisoformat(value).replace(hour=0, minute=0, second=0, microsecond=0)


def next_month(value):
    return (value.replace(day=28) + timedelta(days=4)).replace(day=1)


def distribution(values, unit):
    if values is None:
        return None
    ordered = sorted(values)
    count = len(ordered)
    return {
        "unit": unit,
        "n": count,
        "small_sample": 0 < count < 5,
        "median": median(ordered) if count else None,
        "p90": ordered[ceil(0.9 * count) - 1] if count else None,
    }


def elapsed(start, end):
    seconds = int((datetime.fromisoformat(end) - datetime.fromisoformat(start)).total_seconds())
    if seconds < 0:
        raise ValueError("GitHub end timestamp precedes start timestamp")
    return seconds


def episode_history(issues, events):
    if issues is None:
        return None
    episodes = []
    reopens = []
    for number, transitions in (events or {}).items():
        opened = issues[number]["created"]
        for event_id, at, event in transitions:
            if event == "closed":
                episodes.append({
                    "number": number, "event_id": event_id, "opened_at": opened,
                    "closed_at": at, "seconds": elapsed(opened, at),
                })
            else:
                opened = at
                reopens.append(at)
    return episodes, reopens


def build_report(repo, as_of, repository_created_at, commits, pulls, issues, churn, sizes, events, coverage,
                 *, collected_at=None):
    commit_rows = commits["commits"] if commits is not None else {}
    pull_rows = pulls or {}
    issue_rows = issues or {}
    histories = episode_history(issues, events)
    episodes, reopens = histories if histories is not None else ([], [])
    merge_cycles = [
        {"number": number, "opened_at": pull["created"], "merged_at": pull["merged"],
         "seconds": elapsed(pull["created"], pull["merged"])}
        for number, pull in pull_rows.items() if pull["merged"] and pull["merged"] < as_of
    ]
    activity = [
        *(item["at"] for item in commit_rows.values()),
        *(item["created"] for item in pull_rows.values()),
        *(item["created"] for item in issue_rows.values()),
    ]
    first_observed = min((at for at in activity if at < as_of), default=None)
    today = day_start(as_of)
    week = today - timedelta(days=today.weekday())
    month = today.replace(day=1)
    previous_month = (month - DAY).replace(day=1)
    history_anchor = min((at for at in (first_observed, repository_created_at) if at and at < as_of), default=None)
    history_start = day_start(history_anchor or as_of)

    def period(start, end):
        since, until = iso(start), min(iso(end), as_of)
        known_history = history_anchor is not None and until > history_anchor
        commits_known = known_history and commits is not None
        pulls_known = known_history and pulls is not None
        issues_known = known_history and issues is not None

        def within(at):
            return at is not None and since <= at < until

        commit_ids = [sha for sha, item in commit_rows.items() if within(item["at"])]
        non_merges = [sha for sha in commit_ids if not commit_rows[sha]["merge"]]
        added_pulls = [item["created"] for item in pull_rows.values() if within(item["created"])]
        merged = [item for item in merge_cycles if within(item["merged_at"])]
        closed_unmerged = [
            item["closed"] for item in pull_rows.values()
            if item["merged"] is None and within(item["closed"])
        ]
        issue_count = sum(within(item["created"]) for item in issue_rows.values())
        closed = [item for item in episodes if within(item["closed_at"])]
        reopened = [at for at in reopens if within(at)]
        lifecycle_known = issues_known and all(
            number in (events or {})
            for number, item in issue_rows.items() if item["created"] < until
        )
        backlog = None
        if lifecycle_known:
            backlog = (
                sum(item["created"] < until for item in issue_rows.values())
                + sum(at < until for at in reopens)
                - sum(item["closed_at"] < until for item in episodes)
            )
        churn_rollup = None
        if commits_known and all(sha in (churn or {}) for sha in non_merges):
            churn_rollup = {
                subset: {metric: sum(churn[sha][subset][metric] for sha in non_merges)
                         for metric in LINE_METRICS}
                for subset in ("raw", "eligible")
            }
        size = None
        if pulls_known and all(item["number"] in (sizes or {}) for item in merged):
            values = [sizes[item["number"]] for item in merged]
            size = distribution(values, "lines")
            size["buckets"] = {
                "0-49": sum(0 <= value < 50 for value in values),
                "50-199": sum(50 <= value < 200 for value in values),
                "200-499": sum(200 <= value < 500 for value in values),
                "500+": sum(value >= 500 for value in values),
            }
        active_days = len({commit_rows[sha]["at"][:10] for sha in commit_ids})

        return {
            "start": since, "end": until, "partial": iso(end) > as_of,
            "history_available": known_history,
            "contribution": {
                "commits": len(commit_ids) if commits_known else None,
                "active_days": active_days if commits_known else None,
                "non_merge_commits": len(non_merges) if commits_known else None,
                "churn": churn_rollup,
            },
            "issues": {
                "opened": issue_count if issues_known else None,
                "closed": len(closed) if lifecycle_known else None,
                "reopened": len(reopened) if lifecycle_known else None,
                "outstanding_end": backlog,
                "resolution_time": distribution(
                    [item["seconds"] for item in closed] if lifecycle_known else None, "seconds"
                ),
            },
            "delivery": {
                "prs_opened": len(added_pulls) if pulls_known else None,
                "prs_merged": len(merged) if pulls_known else None,
                "prs_closed_unmerged": len(closed_unmerged) if pulls_known else None,
                "time_to_merge": distribution(
                    [item["seconds"] for item in merged] if pulls_known else None, "seconds"
                ),
                "merged_pr_size": size,
            },
        }

    def periods(start, step):
        windows = []
        while iso(start) <= as_of:
            end = step(start)
            windows.append(period(start, end))
            start = end
        return windows

    repo_url = f"https://github.com/{repo}"
    head = commits["sha"] if commits is not None else None
    issue_samples = [item for item in episodes if item["closed_at"] < as_of]
    return {
        "schema_version": 1,
        "repository": repo,
        "as_of": as_of,
        "collected_at": collected_at or as_of,
        "first_observed_at": first_observed,
        "repository_created_at": repository_created_at,
        "default_branch": {"name": commits["branch"], "sha": head} if commits is not None else None,
        "sources": {
            "commits": f"{repo_url}/commits/{head}" if head else f"{repo_url}/commits",
            "pull_requests": f"{repo_url}/pulls?q=is%3Apr",
            "issues": f"{repo_url}/issues?q=is%3Aissue",
        },
        "coverage": coverage,
        "rollups": {
            "daily": periods(history_start, lambda value: value + DAY),
            "weekly": periods(min(history_start - timedelta(days=history_start.weekday()), week - 7 * WEEK),
                              lambda value: value + WEEK),
            "monthly": periods(min(history_start.replace(day=1), previous_month), next_month),
            "lifetime": period(history_start, datetime.fromisoformat(as_of)),
        },
        "samples": {
            "merged_prs": [
                {**item, "lines_changed": (sizes or {}).get(item["number"]),
                 "url": f'{repo_url}/pull/{item["number"]}'}
                for item in sorted(merge_cycles, key=lambda item: (item["merged_at"], item["number"]))[-5:][::-1]
            ],
            "issue_closures": [
                {**item, "url": f'{repo_url}/issues/{item["number"]}#event-{item["event_id"]}'}
                for item in sorted(issue_samples, key=lambda item: (item["closed_at"], item["event_id"]))[-5:][::-1]
            ],
        },
    }


def display(value):
    return "N/A" if value is None else f"{value:,}"


def show_distribution(result):
    if result is None:
        return "N/A"
    if not result["n"]:
        return "N/A (n=0)"
    scale = 3600 if result["unit"] == "seconds" else 1
    unit = " h" if scale == 3600 else " lines"

    def point(value):
        return f"{value / scale:,.2f}" if scale == 3600 else display(value)

    return (
        f'{point(result["median"])} / {point(result["p90"])}{unit} '
        f'(n={result["n"]}{", small sample" if result["small_sample"] else ""})'
    )


def render_markdown(report):
    rollups = report["rollups"]
    current_month_start = report["as_of"][:7]
    monthly = {row["start"][:7]: row for row in rollups["monthly"]}
    previous_month = (day_start(report["as_of"]).replace(day=1) - DAY).strftime("%Y-%m")
    lines = [
        f'# Engineering activity for {report["repository"]}',
        "",
        f'Collection completed at `{report["collected_at"]}`. Activity cutoff was `{report["as_of"]}`.',
        f'First observed activity was `{report["first_observed_at"] or "N/A"}`.',
        "Calendar windows use UTC. Current windows are partial and comparison columns show counts for the time covered.",
        "",
        "## Lifetime and monthly comparison",
        "",
        f"| Metric | Lifetime | {previous_month} | {current_month_start} (month to date) |",
        "| --- | ---: | ---: | ---: |",
    ]
    windows = [rollups["lifetime"], monthly.get(previous_month), monthly.get(current_month_start)]
    metrics = [
        ("Commits", "contribution", "commits"),
        ("Active days", "contribution", "active_days"),
        ("PRs opened", "delivery", "prs_opened"),
        ("PRs merged", "delivery", "prs_merged"),
        ("PRs closed unmerged", "delivery", "prs_closed_unmerged"),
        ("PR time to merge, median / p90", "delivery", "time_to_merge"),
        ("Merged PR size, median / p90", "delivery", "merged_pr_size"),
        ("Issues opened", "issues", "opened"),
        ("Issue closures", "issues", "closed"),
        ("Issue reopens", "issues", "reopened"),
        ("Backlog at period end", "issues", "outstanding_end"),
        ("Issue resolution, median / p90", "issues", "resolution_time"),
    ]
    for label, section, name in metrics:
        cells = []
        for window in windows:
            value = window[section][name] if window else None
            cells.append(show_distribution(value) if isinstance(value, dict) else display(value))
        lines.append(f"| {label} | {' | '.join(cells)} |")
    for bucket in ("0-49", "50-199", "200-499", "500+"):
        cells = []
        for window in windows:
            size = window["delivery"]["merged_pr_size"] if window else None
            cells.append(display(size["buckets"][bucket] if size is not None else None))
        lines.append(f"| Merged PRs with {bucket} changed lines | {' | '.join(cells)} |")
    for subset in ("eligible", "raw"):
        for metric in LINE_METRICS:
            cells = []
            for window in windows:
                churn = window["contribution"]["churn"] if window else None
                cells.append(display(churn[subset][metric] if churn else None))
            lines.append(f"| {subset.title()} {metric.replace('_', ' ')} | {' | '.join(cells)} |")

    lines += [
        "",
        "## Recent UTC weeks",
        "",
        "| Week beginning | Commits | Active days | PRs merged | PR time to merge, median / p90 | Issues closed | Backlog |",
        "| --- | ---: | ---: | ---: | --- | ---: | ---: |",
    ]
    for week in rollups["weekly"][-8:]:
        contribution, delivery, issues = (week[key] for key in ("contribution", "delivery", "issues"))
        label = week["start"][:10] + (" (partial)" if week["partial"] else "")
        cells = [
            label, display(contribution["commits"]), display(contribution["active_days"]),
            display(delivery["prs_merged"]), show_distribution(delivery["time_to_merge"]),
            display(issues["closed"]), display(issues["outstanding_end"]),
        ]
        lines.append(f"| {' | '.join(cells)} |")
    lines += ["", "## Source coverage", ""]
    lines.extend(f"- [GitHub {name.replace('_', ' ')}]({url})" for name, url in report["sources"].items())
    for name, item in report["coverage"].items():
        expected = display(item["expected"])
        reason = f' ({item["reason"]})' if item["reason"] else ""
        lines.append(
            f'- {name.replace("_", " ").title()} {item["status"]}, '
            f'{display(item["collected"])} / {expected}{reason}'
        )
    lines += [
        "",
        "Counts cover visible GitHub repository records. Churn excludes merge commits, and eligible churn also excludes the documented paths.",
        "Repeated issue closures count as separate episodes. N/A represents unavailable coverage or an empty distribution.",
        "The counts describe repository activity and delivery timing.",
        "",
        "## Sampled GitHub records",
        "",
    ]
    for row in report["samples"]["merged_prs"]:
        lines.append(
            f'- Opened `{row["opened_at"]}`, merged `{row["merged_at"]}`, '
            f'{display(row["seconds"])} seconds and {display(row["lines_changed"])} changed lines. '
            f'[PR #{row["number"]}]({row["url"]})'
        )
    for row in report["samples"]["issue_closures"]:
        lines.append(
            f'- Episode began `{row["opened_at"]}`, closed `{row["closed_at"]}`, '
            f'{display(row["seconds"])} seconds. [Issue #{row["number"]} closure]({row["url"]})'
        )
    if not any(report["samples"].values()):
        lines.append("No qualifying cycle samples were available.")
    return "\n".join(lines) + "\n"
