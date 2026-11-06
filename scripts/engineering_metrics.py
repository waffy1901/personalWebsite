"""Compute UTC repository rollups and format the private report."""

from collections import Counter, defaultdict
from datetime import UTC, datetime, timedelta
from math import ceil
from statistics import median


PORTFOLIO_REPO = "waffy1901/personalWebsite"
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


def count_by(values):
    return dict(sorted(Counter(values).items()))


def run_statistics(runs):
    return {
        "total": len(runs),
        "unfinished": sum(run["conclusion"] is None for run in runs),
        "by_conclusion": count_by(run["conclusion"] for run in runs if run["conclusion"] is not None),
        "duration": distribution([run["seconds"] for run in runs if run["seconds"] is not None], "seconds"),
    }


def workflow_rollup(runs, repo_url):
    workflows = defaultdict(list)
    for run_id, run in runs.items():
        workflows[run["workflow_id"]].append((run_id, run))
    by_workflow = {}
    for workflow_id, group in sorted(workflows.items()):
        latest_id, latest = max(group, key=lambda item: (item[1]["created"], item[0]))
        by_workflow[str(workflow_id)] = {
            **run_statistics([run for _, run in group]),
            "path": latest["path"], "latest_run_url": f"{repo_url}/actions/runs/{latest_id}",
        }
    return {**run_statistics(list(runs.values())), "by_workflow": by_workflow}


def ci_cd_rollup(activity, within, until, earliest_run, repo):
    runs = activity["workflow_runs"]
    workflows = None
    if runs is not None and (earliest_run is None or until > earliest_run):
        workflows = workflow_rollup(
            {key: run for key, run in runs.items() if within(run["created"])}, f"https://github.com/{repo}"
        )
    releases = None
    if activity["releases"] is not None:
        published = [row for row in activity["releases"].values() if within(row["published"])]
        provenance_count = None
        if repo.casefold() == PORTFOLIO_REPO.casefold():
            provenance_count = sum(row["deployment_provenance"] for row in published)
        releases = {"published": len(published), "deployment_provenance": provenance_count}
    deployments = None
    if activity["deployments"] is not None:
        ids = [key for key, created in activity["deployments"].items() if within(created)]
        states = activity["deployment_states"] or {}
        deployments = {
            "created": len(ids),
            "by_state": count_by(states[key] for key in ids) if all(key in states for key in ids) else None,
        }
    return {"workflow_runs": workflows, "releases": releases, "deployments": deployments}


def alert_rollup(alerts, within, since, until):
    opened = [row for row in alerts.values() if within(row["created"])]
    resolved = [row for row in alerts.values() if within(row["resolved"])]
    resolution_known = since == until or not any(
        row["state"] != "open" and row["resolved"] is None and row["created"] < until
        for row in alerts.values()
    )
    return {
        "opened": {"total": len(opened), "by_severity": count_by(row["severity"] for row in opened)},
        "resolved": {
            "total": len(resolved), "by_severity": count_by(row["severity"] for row in resolved),
            "by_reason": count_by(row["state"] for row in resolved),
        } if resolution_known else None,
    }


def build_report(repo, as_of, repository_created_at, commits, pulls, issues, churn, sizes, events, activity,
                 coverage, *, collected_at=None):
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
    observed = [
        *(item["at"] for item in commit_rows.values()),
        *(item["created"] for item in pull_rows.values()),
        *(item["created"] for item in issue_rows.values()),
        *(item["created"] for item in (activity["workflow_runs"] or {}).values()),
        *(item["published"] for item in (activity["releases"] or {}).values()),
        *(activity["deployments"] or {}).values(),
        *(item["created"] for alerts in activity["alerts"].values() for item in (alerts or {}).values()),
    ]
    first_observed = min((at for at in observed if at < as_of), default=None)
    today = day_start(as_of)
    week = today - timedelta(days=today.weekday())
    month = today.replace(day=1)
    previous_month = (month - DAY).replace(day=1)
    history_anchor = min((at for at in (first_observed, repository_created_at) if at and at < as_of), default=None)
    history_start = day_start(history_anchor or as_of)

    repo_url = f"https://github.com/{repo}"
    earliest_run = coverage["workflow_runs"].get("earliest_at")

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
            "ci_cd": ci_cd_rollup(activity, within, until, earliest_run, repo) if known_history else {
                "workflow_runs": None, "releases": None, "deployments": None,
            },
            "quality": {
                name: alert_rollup(alerts, within, since, until) if known_history and alerts is not None else None
                for name, alerts in activity["alerts"].items()
            },
        }

    def periods(start, step):
        windows = []
        while iso(start) <= as_of:
            end = step(start)
            windows.append(period(start, end))
            start = end
        return windows

    head = commits["sha"] if commits is not None else None
    issue_samples = [item for item in episodes if item["closed_at"] < as_of]
    return {
        "schema_version": 2,
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
            "workflow_runs": f"{repo_url}/actions",
            "releases": f"{repo_url}/releases",
            "deployments": f"{repo_url}/deployments",
            "code_scanning": f"{repo_url}/security/code-scanning",
            "dependabot": f"{repo_url}/security/dependabot",
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


def show_distribution(result, *, seconds=False):
    if result is None:
        return "N/A"
    if not result["n"]:
        return "N/A (n=0)"
    if result["unit"] == "seconds":
        scale, unit = (1, " s") if seconds else (3600, " h")
    else:
        scale, unit = 1, " lines"

    def point(value):
        return f"{value / scale:,.2f}" if scale == 3600 else display(value)

    return (
        f'{point(result["median"])} / {point(result["p90"])}{unit} '
        f'(n={result["n"]}{", small sample" if result["small_sample"] else ""})'
    )


def show_counts(counts):
    if counts is None:
        return "N/A"
    return ", ".join(f"{key.replace('_', ' ')} {display(count)}" for key, count in counts.items()) or "0"


def ci_cells(window):
    ci_cd = window["ci_cd"] if window else {}
    runs = ci_cd.get("workflow_runs")
    releases = ci_cd.get("releases") or {}
    deployments = ci_cd.get("deployments") or {}
    conclusions = (runs or {}).get("by_conclusion", {})
    named = ("success", "failure", "cancelled")
    return {
        "Runs": display(runs["total"] if runs else None),
        "Success": display(conclusions.get("success", 0) if runs else None),
        "Failure": display(conclusions.get("failure", 0) if runs else None),
        "Cancelled": display(conclusions.get("cancelled", 0) if runs else None),
        "Other completed": display(sum(count for key, count in conclusions.items() if key not in named) if runs else None),
        "Unfinished": display(runs["unfinished"] if runs else None),
        "Duration, median / p90": show_distribution(runs["duration"] if runs else None, seconds=True),
        "Published releases": display(releases.get("published")),
        "Deploy provenance releases": display(releases.get("deployment_provenance")),
        "GitHub deployments": display(deployments.get("created")),
    }


def show_alerts(counts):
    if counts is None:
        return "N/A"
    total = display(counts["total"])
    return f'{total} ({show_counts(counts["by_severity"])})' if counts["total"] else total


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

    ci_columns = [ci_cells(window) for window in windows]
    for label in ci_columns[0]:
        cells = [column[label] for column in ci_columns]
        lines.append(f"| {label} | {' | '.join(cells)} |")
    lines.append(
        "| GitHub deployment states | " + " | ".join(
            show_counts(((window["ci_cd"]["deployments"] if window else None) or {}).get("by_state"))
            for window in windows
        ) + " |"
    )

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
    lines += ["", "## CI and deployment trends by UTC week", ""]
    lines.append(f"| Week beginning | {' | '.join(ci_columns[0])} |")
    lines.append("| --- |" + " --- |" * len(ci_columns[0]))
    for week in rollups["weekly"][-8:]:
        label = week["start"][:10] + (" (partial)" if week["partial"] else "")
        lines.append(f"| {label} | {' | '.join(ci_cells(week).values())} |")
    month = monthly[current_month_start]
    month_runs = (month["ci_cd"]["workflow_runs"] or {}).get("by_workflow", {})
    if month_runs:
        lines += [
            "", "## Workflows this month", "",
            "| Workflow | Runs | Conclusions | Unfinished | Duration, median / p90 |",
            "| --- | ---: | --- | ---: | --- |",
        ]
        for workflow_id, row in month_runs.items():
            label = row["path"] or f"Workflow #{workflow_id}"
            lines.append(
                f'| [{label}]({row["latest_run_url"]}) | {display(row["total"])} | '
                f'{show_counts(row["by_conclusion"])} | {display(row["unfinished"])} | '
                f'{show_distribution(row["duration"], seconds=True)} |'
            )

    lines += [
        "", "## Security alerts by source", "",
        "| Source | UTC period | Opened (severity) | Resolved (severity) | Resolution reasons |",
        "| --- | --- | --- | --- | --- |",
    ]
    for key, source in (("code_scanning", "Code scanning"), ("dependabot", "Dependabot")):
        for label, window in zip(("Lifetime", previous_month, f"{current_month_start} (partial)"), windows):
            alerts = (window["quality"][key] if window else None) or {}
            resolved = alerts.get("resolved")
            lines.append(
                f'| {source} | {label} | {show_alerts(alerts.get("opened"))} | '
                f'{show_alerts(resolved)} | {show_counts(resolved["by_reason"] if resolved else None)} |'
            )

    lines += ["", "## Source coverage", ""]
    lines.extend(f"- [GitHub {name.replace('_', ' ')}]({url})" for name, url in report["sources"].items())
    for name, item in report["coverage"].items():
        expected = display(item["expected"])
        reason = f' ({item["reason"]})' if item["reason"] else ""
        lines.append(
            f'- {name.replace("_", " ").title()} {item["status"]}, '
            f'{display(item["collected"])} / {expected}{reason}'
        )
    earliest_run = report["coverage"]["workflow_runs"].get("earliest_at")
    if earliest_run:
        lines.append(f"- Oldest visible Actions run created at {earliest_run}.")
    lines += [
        "",
        "Counts cover visible GitHub repository records. Churn excludes merge commits, and eligible churn also excludes the documented paths.",
        "Repeated issue closures count as separate episodes. N/A represents unavailable coverage or an empty distribution.",
        "Actions totals cover visible run IDs, grouped by creation time. Outcomes and duration use the latest observed attempt.",
        "Deploy provenance releases follow this portfolio's tag convention. GitHub deployment states are the latest returned for records created in each window.",
        "Security alert resolutions use the current state and recorded closure time. A reopened alert can hide a prior resolution.",
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
