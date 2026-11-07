"""Fixture coverage for the private engineering activity report."""

from contextlib import redirect_stderr, redirect_stdout
from email.message import Message
from http.client import HTTPResponse
import io
import json
import os
from pathlib import Path
import ssl
import subprocess
import sys
from tempfile import TemporaryDirectory
from types import SimpleNamespace
import unittest
from unittest.mock import patch
from urllib.error import HTTPError, URLError

from engineering_metrics import PORTFOLIO_REPO, build_report, distribution, render_markdown, timestamp
from engineering_report import (
    API, GitHub, Unavailable, collect, issue_events, main, prepare_output, read_churn, workflow_inventory,
)


SHA_A = "a" * 40
SHA_B = "b" * 40
REPO = "owner/repo"
AS_OF = "2026-02-03T12:00:00Z"
NEW_INVENTORIES = ["/actions/runs", "/releases", "/deployments", "/code-scanning/alerts", "/dependabot/alerts"]
INVENTORIES = ["", "/branches/main", "/commits", "/pulls", "/issues", *NEW_INVENTORIES]


def at(day, hour=0, month=2):
    return f"2026-{month:02d}-{day:02d}T{hour:02d}:00:00Z"


def run(run_id, created, **changes):
    return {
        "id": run_id, "workflow_id": 40, "path": ".github/workflows/check.yml@main",
        "run_attempt": 1, "status": "completed", "conclusion": "success",
        "created_at": created, "run_started_at": created, "updated_at": created,
        **changes,
    }


class Fixture:
    def __init__(self):
        self.calls = []
        self.head = SHA_B
        self.commits = [
            {"sha": SHA_A, "commit": {"committer": {"date": at(31, 23, 1)}}, "parents": []},
            {"sha": SHA_B, "commit": {"committer": {"date": at(1)}}, "parents": [{}, {}]},
        ]
        self.prs = [
            {"number": 1, "state": "closed", "created_at": at(31, 23, 1), "merged_at": at(1), "closed_at": at(1),
             "base": {"sha": SHA_A}, "head": {"sha": SHA_B}},
            {"number": 2, "state": "closed", "created_at": at(1), "merged_at": None, "closed_at": at(2),
             "base": {"sha": SHA_A}, "head": {"sha": SHA_B}},
            {"number": 3, "state": "open", "created_at": at(1), "merged_at": None, "closed_at": None,
             "base": {"sha": SHA_A}, "head": {"sha": SHA_B}},
        ]
        self.issue = {"number": 4, "created_at": at(31, 22, 1), "closed_at": at(2, 2),
                      "updated_at": at(2, 2), "state": "closed"}
        self.events = [
            {"id": 20, "event": "closed", "created_at": at(1)},
            {"id": 21, "event": "reopened", "created_at": at(2)},
            {"id": 22, "event": "closed", "created_at": at(2, 2)},
        ]
        self.workflow_pages = [{"total_count": 0, "workflow_runs": []}]
        self.releases = []
        self.deployments = []
        self.deployment_states = {}
        self.code_scanning = []
        self.dependabot = []
        self.fail = set()

    def call(self, endpoint):
        self.calls.append(endpoint)
        if endpoint in self.fail:
            raise Unavailable("Fixture source missing")

    def object(self, endpoint):
        self.call(endpoint)
        return {
            "": {"default_branch": "main", "created_at": at(31, 22, 1)},
            "/branches/main": {"commit": {"sha": self.head}},
            "/pulls/1": {**self.prs[0], "additions": 11, "deletions": 2},
        }[endpoint]

    def rows(self, endpoint, **params):
        self.call(endpoint)
        if endpoint == "/commits":
            assert params["sha"] == self.head
        yield from {
            "/commits": self.commits + self.commits[:1],
            "/pulls": self.prs + self.prs[:1],
            "/issues": [{"number": 1, "pull_request": {}}, self.issue, self.issue],
            "/issues/4/events": list(reversed(self.events)) + self.events[:1],
            "/releases": self.releases,
            "/deployments": self.deployments,
            "/code-scanning/alerts": self.code_scanning,
            "/dependabot/alerts": self.dependabot,
            **{f"/deployments/{key}/statuses": rows for key, rows in self.deployment_states.items()},
        }[endpoint]

    def pages(self, endpoint, **params):
        self.call(endpoint)
        if endpoint == "/actions/runs":
            assert not params
            yield from self.workflow_pages
            return
        assert endpoint == f"/commits/{SHA_A}"
        yield {
            "sha": SHA_A, "stats": {"additions": 17, "deletions": 4},
            "files": [
                {"filename": "a.js", "additions": 5, "deletions": 4},
                {"filename": "vendor/x.js", "additions": 2, "deletions": 0},
                {"filename": "package-lock.json", "additions": 3, "deletions": 0},
            ],
        }
        yield {"sha": SHA_A, "files": [
            {"filename": "main/public/portfolio.json", "additions": 5, "deletions": 0},
            {"filename": "relocated.js", "previous_filename": "vendor/old.js", "additions": 2, "deletions": 0},
        ]}


class Response(io.BytesIO):
    def __init__(self, data, headers=None):
        super().__init__(json.dumps(data).encode())
        self.headers = headers or {}


def http_error(code, **headers):
    message = Message()
    for name, value in headers.items():
        message[name] = value
    return HTTPError(API, code, "fixture", message, io.BytesIO(b"fixture"))


def clipped_response(*, forbidden=False, retry_after=None, chunked=True):
    if forbidden:
        wire = b"HTTP/1.1 403 Forbidden\r\n"
        if retry_after is not None:
            wire += f"Retry-After: {retry_after}\r\n".encode()
        wire += b"Transfer-Encoding: chunked\r\n\r\n2000\r\n" if chunked else b"Content-Length: 80\r\n\r\n"
        wire += b'{"message":"clipped'
    else:
        wire = b'HTTP/1.1 200 OK\r\nContent-Length: 20\r\n\r\n{"clipped'
    response = HTTPResponse(SimpleNamespace(makefile=lambda *_: io.BytesIO(wire)))
    response.begin()
    if forbidden:
        raise HTTPError(API, response.status, response.reason, response.headers, response)
    return response


class GitHubTests(unittest.TestCase):
    def test_pagination_keeps_params_and_rejects_off_origin(self):
        requests = []
        second = f"{API}/repositories/123/commits?page=2"

        def open_response(request, **kwargs):
            requests.append(request)
            next_url = second if len(requests) == 1 else "https://evil.invalid/token"
            return Response([len(requests)], {"Link": f'<{next_url}>; rel="next"'})

        github = GitHub(REPO, "fixture-secret", opener=open_response)
        with self.assertRaisesRegex(Unavailable, "left the API origin"):
            list(github.rows("/commits", sha=SHA_A))
        self.assertEqual(len(requests), 2)
        self.assertIn(f"sha={SHA_A}", requests[0].full_url)
        self.assertIn("per_page=100", requests[0].full_url)
        self.assertEqual(requests[1].full_url, second)
        self.assertEqual(requests[1].get_header("Authorization"), "Bearer fixture-secret")

    def test_pagination_rejects_loop(self):
        def open_response(request, **kwargs):
            return Response([1], {"Link": f'<{request.full_url}>; rel="next"'})

        github = GitHub(REPO, "fixture", opener=open_response)
        with self.assertRaisesRegex(Unavailable, "repeated a page"):
            list(github.rows("/issues"))

    def test_workflow_pages_use_unfiltered_inventory_and_keep_latest_attempt(self):
        requests = []
        second = f"{API}/repositories/123/actions/runs?per_page=100&page=2"
        original = run(101, at(1), conclusion="failure", updated_at=at(1, 1))
        rerun = {**original, "run_attempt": 2, "conclusion": "success",
                 "run_started_at": at(2), "updated_at": at(2, 2)}

        def open_response(request, **kwargs):
            requests.append(request.full_url)
            if len(requests) == 1:
                return Response({"total_count": 2, "workflow_runs": [rerun]}, {"Link": f'<{second}>; rel="next"'})
            return Response({"total_count": 2, "workflow_runs": [original, run(102, at(2))]})

        github = GitHub(REPO, "fixture", opener=open_response)
        runs = workflow_inventory(github)
        self.assertEqual(requests, [f"{API}/repos/{REPO}/actions/runs?per_page=100", second])
        self.assertEqual(set(runs), {101, 102})
        self.assertEqual(runs[101]["attempt"], 2)
        self.assertEqual(runs[101]["seconds"], 7200)
        self.assertEqual(runs[101]["conclusion"], "success")

    def test_alert_pagination_follows_cursor_links(self):
        requests = []
        endpoint = "/dependabot/alerts"
        second = f"{API}/repositories/123{endpoint}?after=next-cursor"

        def open_response(request, **kwargs):
            requests.append(request.full_url)
            if len(requests) == 1:
                return Response([{"number": 1}], {"Link": f'<{second}>; rel="next"'})
            return Response([{"number": 2}])

        github = GitHub(REPO, "fixture", opener=open_response)
        self.assertEqual(list(github.rows(endpoint)), [{"number": 1}, {"number": 2}])
        self.assertEqual(requests, [f"{API}/repos/{REPO}{endpoint}?per_page=100", second])

    def test_request_budget_bounds_retries_and_later_pages(self):
        requests = []
        waits = []

        def open_response(request, **kwargs):
            requests.append(request.full_url)
            if len(requests) == 1:
                raise http_error(502)
            return Response([1], {"Link": f'<{API}/repositories/123/issues?page=2>; rel="next"'})

        github = GitHub(REPO, "fixture", opener=open_response, sleep=waits.append, max_requests=2)
        with self.assertRaisesRegex(Unavailable, "request budget exhausted"):
            list(github.rows("/issues"))
        with self.assertRaisesRegex(Unavailable, "request budget exhausted"):
            github.object("")
        self.assertEqual(waits, [1])
        self.assertEqual(requests, [f"{API}/repos/{REPO}/issues?per_page=100"] * 2)

    def test_retry_after_and_primary_reset(self):
        responses = iter([
            http_error(429, **{"Retry-After": "3"}),
            http_error(403, **{"X-RateLimit-Remaining": "0", "X-RateLimit-Reset": "104"}),
            Response({}),
        ])
        waits = []

        def open_response(request, **kwargs):
            result = next(responses)
            if isinstance(result, Exception):
                raise result
            return result

        github = GitHub(REPO, "fixture", opener=open_response, sleep=waits.append, now=lambda: 100)
        self.assertEqual(github.object(""), {})
        self.assertEqual(waits, [3, 5])

    def test_global_throttle_auth_and_tls_exhaustion(self):
        examples = [
            (http_error(429, **{"Retry-After": "120"}), "retry budget"),
            (http_error(401), "HTTP 401"),
            (URLError(ssl.SSLCertVerificationError()), "TLS certificate"),
        ]
        for error, message in examples:
            with self.subTest(message=message):
                calls = []

                def fail(request, **kwargs):
                    calls.append(request)
                    raise error

                github = GitHub(REPO, "fixture", opener=fail, sleep=lambda _: self.fail("should not sleep"))
                for path in ("", "/pulls"):
                    with self.assertRaisesRegex(Unavailable, message):
                        github.object(path)
                self.assertEqual(len(calls), 1)

    def test_forbidden_is_not_a_rate_limit(self):
        def fail(request, **kwargs):
            raise http_error(403)

        github = GitHub(REPO, "fixture", opener=fail, sleep=lambda _: self.fail("should not sleep"))
        with self.assertRaisesRegex(Unavailable, "^GitHub HTTP 403$"):
            github.object("")
        self.assertIsNone(github.blocked_reason)

    def test_retries_clipped_success_and_forbidden_bodies(self):
        cases = [({}, 1), ({"forbidden": True, "retry_after": 3}, 3),
                 ({"forbidden": True}, 1), ({"forbidden": True, "chunked": False}, 1)]
        for options, delay in cases:
            with self.subTest(options=options):
                waits = []
                responses = iter([lambda: clipped_response(**options), lambda: Response({})])
                github = GitHub(REPO, "fixture", opener=lambda *_args, **_kwargs: next(responses)(),
                                sleep=waits.append)
                self.assertEqual(github.object(""), {})
                self.assertEqual(waits, [delay])

    def test_retries_connection_reset_in_forbidden_body(self):
        error = http_error(403)
        responses = iter([error, Response({})])
        waits = []

        def open_response(request, **kwargs):
            response = next(responses)
            if response is error:
                raise error
            return response

        github = GitHub(REPO, "fixture", opener=open_response, sleep=waits.append)
        with patch.object(error, "read", side_effect=ConnectionResetError()):
            self.assertEqual(github.object(""), {})
        self.assertEqual(waits, [1])


class ReportTests(unittest.TestCase):
    def setUp(self):
        self.api = Fixture()
        self.cache = {}

    def collect(self, as_of=AS_OF, *, repo=REPO):
        return build_report(repo, as_of, *collect(self.api, self.cache, as_of))

    def test_rollups_windows_denominators_and_issue_reopens(self):
        report = self.collect()
        monthly = report["rollups"]["monthly"]
        january, february = monthly
        self.assertEqual(january["end"], february["start"])
        self.assertTrue(february["partial"])
        self.assertEqual(february["end"], AS_OF)
        self.assertEqual(january["delivery"]["prs_opened"], 1)
        self.assertEqual(february["delivery"]["prs_merged"], 1)
        self.assertEqual(february["delivery"]["prs_closed_unmerged"], 1)
        self.assertEqual(february["delivery"]["time_to_merge"], distribution([3600], "seconds"))
        self.assertEqual(february["delivery"]["merged_pr_size"], {
            **distribution([13], "lines"),
            "buckets": {"0-49": 1, "50-199": 0, "200-499": 0, "500+": 0},
        })
        self.assertEqual(january["issues"]["outstanding_end"], 1)
        self.assertEqual(february["issues"], {
            "opened": 0, "closed": 2, "reopened": 1, "outstanding_end": 0,
            "resolution_time": distribution([7200, 7200], "seconds"),
        })
        daily = report["rollups"]["daily"]
        self.assertEqual([window["contribution"]["commits"] for window in daily], [1, 1, 0, 0])
        self.assertEqual(report["rollups"]["weekly"][-1]["start"], at(2))
        lifetime = report["rollups"]["lifetime"]
        self.assertEqual(lifetime["contribution"], {
            "commits": 2, "non_merge_commits": 1, "active_days": 2,
            "churn": {
                "raw": {"additions": 17, "deletions": 4, "file_touches": 5},
                "eligible": {"additions": 5, "deletions": 4, "file_touches": 1},
            },
        })
        self.assertEqual(report["samples"]["issue_closures"][0]["event_id"], 22)
        markdown = render_markdown(report)
        for expected in ("month to date", "small sample", "Source coverage", "/issues/4#event-22"):
            self.assertIn(expected, markdown)

    def test_incremental_reuses_details_and_reconciles_force_push_and_issue_revision(self):
        first = self.collect()
        self.api.calls.clear()
        second = self.collect()
        self.assertEqual(first, second)
        self.assertEqual(self.api.calls, INVENTORIES)

        self.api.commits = self.api.commits[1:]
        self.api.issue.update(state="open", closed_at=None, updated_at=at(3))
        self.api.events.append({"id": 23, "event": "reopened", "created_at": at(3)})
        changed = self.collect()["rollups"]["lifetime"]
        self.assertEqual(changed["contribution"]["commits"], 1)
        self.assertEqual(changed["issues"]["outstanding_end"], 1)
        self.assertEqual(changed["issues"]["reopened"], 2)
        self.assertIn("/issues/4/events", self.api.calls)
        self.assertEqual(self.cache["commit_churn"], {})

    def test_pr_state_and_cached_size_after_permission_failure(self):
        self.collect()
        old_closed_at = self.api.prs[1]["closed_at"]
        self.api.prs[1].update(state="open", closed_at=old_closed_at)
        reopened = self.collect()["rollups"]["lifetime"]["delivery"]
        self.assertEqual(reopened["prs_closed_unmerged"], 0)

        self.api.prs[1].update(state="closed", merged_at=old_closed_at)
        self.api.prs.reverse()
        original_object = self.api.object

        def with_forbidden_size(endpoint):
            if endpoint == "/pulls/2":
                raise Unavailable("GitHub HTTP 403")
            return original_object(endpoint)

        self.api.object = with_forbidden_size
        report = self.collect()
        self.assertEqual(report["coverage"]["merged_pr_size"]["collected"], 1)
        self.assertEqual(report["rollups"]["lifetime"]["delivery"]["prs_merged"], 2)
        self.assertIsNone(report["rollups"]["lifetime"]["delivery"]["merged_pr_size"])
        self.assertEqual(self.cache["merged_pr_size"]["1"]["value"], 13)

    def test_windows_entirely_before_history_are_unavailable(self):
        earliest_week = self.collect()["rollups"]["weekly"][0]
        self.assertFalse(earliest_week["history_available"])
        self.assertIsNone(earliest_week["contribution"]["commits"])
        self.assertIsNone(earliest_week["issues"]["outstanding_end"])
        self.assertIsNone(earliest_week["delivery"]["prs_merged"])

    def test_unsafe_issue_revision_is_fetched_again(self):
        self.api.issue["updated_at"] = AS_OF
        self.collect()
        self.api.calls.clear()
        self.collect(as_of=at(3, 13))
        self.assertIn("/issues/4/events", self.api.calls)

    def test_missing_details_and_missing_inventory_are_unavailable(self):
        self.api.fail = {f"/commits/{SHA_A}", "/issues/4/events", "/pulls"}
        report = self.collect()
        january, february = report["rollups"]["monthly"]
        self.assertEqual(january["contribution"]["commits"], 1)
        self.assertIsNone(january["contribution"]["churn"])
        self.assertEqual(february["contribution"]["churn"]["raw"]["additions"], 0)
        self.assertIsNone(february["delivery"]["prs_merged"])
        self.assertIsNone(february["issues"]["closed"])
        self.assertIsNone(february["issues"]["outstanding_end"])
        self.assertEqual(january["issues"]["opened"], 1)
        self.assertEqual(report["coverage"]["issue_lifecycle"]["status"], "unavailable")

    def test_repository_creation_anchors_empty_inventories_when_branch_is_forbidden(self):
        calls = []

        def open_response(request, **kwargs):
            path = request.selector.split("?", 1)[0].removeprefix(f"/repos/{REPO}")
            calls.append(path)
            if path == "/branches/main":
                raise http_error(403)
            if not path:
                return Response({"default_branch": "main", "created_at": at(31, 22, 1)})
            if path == "/actions/runs":
                return Response({"total_count": 0, "workflow_runs": []})
            return Response([])

        self.api = GitHub(REPO, "fixture", opener=open_response, sleep=lambda _: self.fail("should not sleep"))
        report = self.collect()
        lifetime = report["rollups"]["lifetime"]
        self.assertEqual(calls, ["", "/branches/main", "/pulls", "/issues", *NEW_INVENTORIES])
        self.assertEqual(report["repository_created_at"], at(31, 22, 1))
        self.assertEqual(report["coverage"]["commits"]["reason"], "GitHub HTTP 403")
        self.assertTrue(lifetime["history_available"])
        self.assertEqual(lifetime["contribution"], dict.fromkeys(("commits", "non_merge_commits", "active_days", "churn")))
        self.assertEqual(lifetime["delivery"]["prs_opened"], 0)
        self.assertEqual(lifetime["delivery"]["prs_merged"], 0)
        self.assertEqual(lifetime["issues"]["opened"], 0)
        self.assertEqual(lifetime["issues"]["outstanding_end"], 0)

    def test_bad_issue_transition_fails(self):
        self.api.events.pop()
        issue = {"created": at(31, 22, 1), "state": "closed", "closed": at(2, 2)}
        with self.assertRaisesRegex(Unavailable, "does not match"):
            issue_events(self.api, 4, issue)

    def test_close_event_may_lag_inventory_by_one_second(self):
        self.api.events[-1]["created_at"] = "2026-02-02T02:00:01Z"
        report = self.collect()
        self.assertEqual(report["coverage"]["issue_lifecycle"]["status"], "complete")
        latest = report["samples"]["issue_closures"][0]
        self.assertEqual(latest["closed_at"], "2026-02-02T02:00:01Z")
        self.assertEqual(latest["seconds"], 7201)

        for outside_tolerance in ("2026-02-02T02:00:02Z", "2026-02-02T01:59:59Z"):
            with self.subTest(outside_tolerance=outside_tolerance):
                self.api.events[-1]["created_at"] = outside_tolerance
                with self.assertRaisesRegex(Unavailable, "does not match inventory close timestamp"):
                    issue_events(self.api, 4, {"created": at(31, 22, 1), "state": "closed", "closed": at(2, 2)})

    def test_empty_interval_and_nearest_rank(self):
        report = self.collect(as_of=at(1))
        february = report["rollups"]["monthly"][-1]
        self.assertTrue(february["partial"])
        self.assertEqual(february["start"], february["end"])
        self.assertEqual(february["delivery"]["prs_merged"], 0)
        self.assertEqual(february["delivery"]["time_to_merge"], distribution([], "seconds"))
        self.assertEqual(distribution(range(1, 11), "lines")["p90"], 9)
        self.assertEqual(distribution(range(1, 11), "lines")["median"], 5.5)
        self.assertEqual(timestamp("2026-01-31T19:00:00-05:00"), at(1))

    def test_commit_cap_does_not_report_truncated_churn(self):
        class BigCommit:
            def pages(self, _endpoint):
                yield {"sha": SHA_A, "stats": {"additions": 1, "deletions": 0},
                       "files": [{"filename": f"src/{n}"} for n in range(3000)]}

        with self.assertRaisesRegex(Unavailable, "3000-file limit"):
            read_churn(BigCommit(), SHA_A)

    def test_workflow_outcomes_time_windows_and_denominators(self):
        rows = [
            run(101, "2026-01-31T18:00:00-05:00", run_attempt=2, run_started_at=at(1), updated_at=at(1, 1)),
            run(102, at(1), conclusion="failure", updated_at="2026-02-01T00:01:00Z"),
            run(103, at(1, 1), workflow_id=50, conclusion="cancelled", run_started_at=None),
            run(104, at(2), workflow_id=50, status="in_progress", conclusion=None, path="unsafe|label"),
            run(105, AS_OF),
        ]
        self.api.workflow_pages = [{"total_count": len(rows), "workflow_runs": rows}]
        report = self.collect()
        january, february = report["rollups"]["monthly"]
        january_runs = january["ci_cd"]["workflow_runs"]
        february_runs = february["ci_cd"]["workflow_runs"]
        self.assertEqual(january_runs["by_conclusion"], {"success": 1})
        self.assertEqual(january_runs["duration"], distribution([3600], "seconds"))
        self.assertEqual(february_runs["total"], 3)
        self.assertEqual(february_runs["by_conclusion"], {"cancelled": 1, "failure": 1})
        self.assertEqual(february_runs["duration"], distribution([60], "seconds"))
        self.assertEqual(february_runs["unfinished"], 1)
        self.assertEqual(february_runs["by_workflow"]["50"], {
            "total": 2, "unfinished": 1, "by_conclusion": {"cancelled": 1},
            "duration": distribution([], "seconds"),
            "path": None, "latest_run_url": f"https://github.com/{REPO}/actions/runs/104",
        })
        self.assertIsNone(report["rollups"]["weekly"][0]["ci_cd"]["workflow_runs"])
        self.assertEqual(report["rollups"]["daily"][-1]["ci_cd"]["workflow_runs"]["total"], 0)
        lifetime = report["rollups"]["lifetime"]["ci_cd"]["workflow_runs"]
        self.assertEqual(lifetime["total"], 4)
        self.assertEqual(lifetime["duration"], distribution([60, 3600], "seconds"))
        self.assertEqual(report["coverage"]["workflow_runs"]["earliest_at"], at(31, 23, 1))
        markdown = render_markdown(report)
        self.assertIn("[Workflow #50]", markdown)
        self.assertNotIn("unsafe|label", markdown)

    def test_incomplete_workflow_pagination_does_not_become_a_count(self):
        self.api.workflow_pages = [{"total_count": 2, "workflow_runs": [run(101, at(1))]}]
        report = self.collect()
        self.assertEqual(report["coverage"]["workflow_runs"]["status"], "unavailable")
        self.assertIn("pagination", report["coverage"]["workflow_runs"]["reason"])
        self.assertIsNone(report["rollups"]["lifetime"]["ci_cd"]["workflow_runs"])

    def test_release_provenance_and_latest_deployment_state(self):
        deploy_release = {
            "id": 11, "draft": False, "tag_name": "deploy-20260201T000000Z-a1b2c3d", "published_at": at(1),
        }
        self.api.releases = [
            deploy_release, deploy_release,
            {"id": 12, "draft": False, "tag_name": "v1.2.3", "published_at": at(31, 23, 1)},
            {"id": 13, "draft": True, "tag_name": "v2.0.0", "published_at": None},
        ]
        first_deployment = {"id": 21, "created_at": at(1)}
        self.api.deployments = [first_deployment, first_deployment, {"id": 22, "created_at": at(2)}]
        self.api.deployment_states = {
            21: [
                {"id": 30, "created_at": at(1), "state": "pending"},
                {"id": 32, "created_at": at(1, 1), "state": "success"},
                {"id": 31, "created_at": at(1, 1), "state": "failure"},
            ],
            22: [],
        }
        report = self.collect(repo=PORTFOLIO_REPO)
        january, february = report["rollups"]["monthly"]
        self.assertEqual(january["ci_cd"]["releases"], {"published": 1, "deployment_provenance": 0})
        self.assertEqual(february["ci_cd"]["releases"], {"published": 1, "deployment_provenance": 1})
        self.assertEqual(february["ci_cd"]["deployments"], {"created": 2, "by_state": {"success": 1, "unreported": 1}})
        self.assertNotIn("deployment_states", self.cache)

        self.api.fail.add("/deployments/22/statuses")
        partial = self.collect()
        self.assertEqual(partial["coverage"]["deployment_states"]["status"], "partial")
        self.assertEqual(partial["rollups"]["monthly"][-1]["ci_cd"]["releases"], {
            "published": 1, "deployment_provenance": None,
        })
        self.assertEqual(partial["rollups"]["monthly"][-1]["ci_cd"]["deployments"], {"created": 2, "by_state": None})
        self.assertEqual(partial["rollups"]["monthly"][0]["ci_cd"]["deployments"], {"created": 0, "by_state": {}})

    def test_alert_openings_resolutions_severity_and_reopened_state(self):
        dismissed = {"number": 1, "created_at": at(31, 23, 1), "updated_at": at(1),
                     "state": "dismissed", "dismissed_at": at(1),
                     "rule": {"security_severity_level": "high", "severity": "error"}}
        self.api.code_scanning = [
            {**dismissed, "state": "open", "updated_at": at(2)}, dismissed,
            {"number": 2, "created_at": at(1), "state": "fixed", "fixed_at": at(2),
             "rule": {"severity": "warning"}},
        ]
        self.api.dependabot = [
            {"number": 1, "created_at": at(31, 23, 1), "updated_at": at(1), "state": "fixed", "fixed_at": at(1),
             "security_vulnerability": {"severity": "critical"}, "security_advisory": {"severity": "high"}},
            {"number": 2, "created_at": at(2), "updated_at": at(2), "state": "auto_dismissed",
             "auto_dismissed_at": at(2), "security_vulnerability": {}, "security_advisory": {"severity": "low"}},
        ]
        report = self.collect()
        january, february = report["rollups"]["monthly"]
        self.assertEqual(january["quality"]["code_scanning"]["opened"], {"total": 1, "by_severity": {"high": 1}})
        self.assertEqual(february["quality"]["code_scanning"]["resolved"], {
            "total": 1, "by_severity": {"warning": 1}, "by_reason": {"fixed": 1},
        })
        self.assertEqual(february["quality"]["dependabot"]["opened"], {"total": 1, "by_severity": {"low": 1}})
        self.assertEqual(february["quality"]["dependabot"]["resolved"], {
            "total": 2, "by_severity": {"critical": 1, "low": 1}, "by_reason": {"auto_dismissed": 1, "fixed": 1},
        })
        self.assertIn("2 (critical 1, low 1)", render_markdown(report))

    def test_conflicting_alerts_without_revision_leave_source_unavailable(self):
        opened = {"number": 1, "created_at": at(1), "state": "open", "rule": {}}
        self.api.code_scanning = [opened, {**opened, "state": "fixed", "fixed_at": at(2)}]
        report = self.collect()
        self.assertIn("changed during pagination", report["coverage"]["code_scanning"]["reason"])
        self.assertIsNone(report["rollups"]["lifetime"]["quality"]["code_scanning"])

    def test_missing_alert_timestamp_preserves_opened_counts(self):
        self.api.code_scanning = [
            {"number": 1, "created_at": at(1), "updated_at": at(2), "state": "dismissed", "rule": {}},
        ]
        report = self.collect()
        january, february = report["rollups"]["monthly"]
        self.assertEqual(report["coverage"]["code_scanning"]["status"], "partial")
        self.assertEqual(january["quality"]["code_scanning"]["resolved"]["total"], 0)
        self.assertEqual(february["quality"]["code_scanning"]["opened"], {"total": 1, "by_severity": {"unknown": 1}})
        self.assertIsNone(february["quality"]["code_scanning"]["resolved"])

    def test_empty_and_missing_phase_two_sources_are_distinct(self):
        self.api.fail = {"/releases", "/dependabot/alerts", "/deployments"}
        report = self.collect()
        lifetime = report["rollups"]["lifetime"]
        self.assertEqual(lifetime["ci_cd"]["workflow_runs"], {
            "total": 0, "unfinished": 0, "by_conclusion": {},
            "duration": distribution([], "seconds"), "by_workflow": {},
        })
        self.assertIsNone(lifetime["ci_cd"]["releases"])
        self.assertIsNone(lifetime["ci_cd"]["deployments"])
        self.assertIsNone(lifetime["quality"]["dependabot"])
        self.assertEqual(lifetime["quality"]["code_scanning"]["opened"]["total"], 0)
        self.assertEqual(report["coverage"]["dependabot"]["status"], "unavailable")
        self.assertEqual(report["coverage"]["code_scanning"]["status"], "complete")

    def test_rejects_checkout_output(self):
        with self.assertRaisesRegex(Unavailable, "outside Git worktrees"):
            prepare_output(Path(__file__).resolve().parent / "report")


class CLITests(unittest.TestCase):
    def run_report(self, directory, api, *options):
        args = ["engineering_report.py", "--repo", REPO, "--output-dir", str(directory), *options]
        with patch("sys.argv", args), patch("engineering_report.read_token", return_value="fixture-secret"), patch(
            "engineering_report.GitHub", return_value=api
        ), redirect_stdout(io.StringIO()) as stdout, redirect_stderr(io.StringIO()) as stderr:
            old_mask = os.umask(0o077)
            try:
                return main(), stdout.getvalue(), stderr.getvalue()
            finally:
                os.umask(old_mask)

    def test_cli_publishes_private_pair_and_reuses_cache(self):
        api = Fixture()
        with TemporaryDirectory() as directory:
            output = Path(directory)
            self.assertEqual(self.run_report(output, api)[0], 0)
            first = (output / "current").resolve()
            api.calls.clear()
            self.assertEqual(self.run_report(output, api)[0], 0)
            current = (output / "current").resolve()
            self.assertNotEqual(first, current)
            self.assertEqual(api.calls, INVENTORIES)
            report = json.loads((current / "report.json").read_text())
            self.assertIn(report["as_of"], (current / "report.md").read_text())
            self.assertEqual(report["schema_version"], 2)
            for path in (current, *current.iterdir(), output / "cache.json"):
                self.assertEqual(path.stat().st_mode & 0o077, 0)
            self.assertNotIn("fixture-secret", (output / "cache.json").read_text())

    def test_cli_marks_intentional_dependabot_skip(self):
        api = Fixture()
        api.fail.add("/dependabot/alerts")
        with TemporaryDirectory() as directory:
            output = Path(directory)
            status, _, stderr = self.run_report(output, api, "--skip-dependabot")
            self.assertEqual((status, stderr), (0, ""))
            self.assertNotIn("/dependabot/alerts", api.calls)
            report = json.loads((output / "current" / "report.json").read_text())
            self.assertEqual(report["coverage"]["dependabot"]["status"], "not_collected")
            self.assertIsNone(report["rollups"]["lifetime"]["quality"]["dependabot"])

    def test_cli_partial_publication_and_bad_arguments_have_distinct_statuses(self):
        for options, expected_waits in (({}, [1, 2]), ({"forbidden": True, "retry_after": 2}, [2, 2])):
            with self.subTest(options=options), TemporaryDirectory() as directory:
                output = Path(directory)
                self.assertEqual(self.run_report(output, Fixture())[0], 0)
                first = (output / "current").readlink()
                cache = (output / "cache.json").read_bytes()
                waits = []
                requests = []

                def open_response(request, **kwargs):
                    requests.append(request.full_url)
                    return clipped_response(**options)

                api = GitHub(REPO, "fixture", opener=open_response, sleep=waits.append)
                with self.assertRaises(SystemExit) as usage:
                    self.run_report(output, api, "--max-wait", "-1")
                self.assertEqual(usage.exception.code, 2)
                self.assertEqual((output / "current").readlink(), first)
                self.assertEqual((output / "cache.json").read_bytes(), cache)
                self.assertEqual(requests, [])

                status, stdout, stderr = self.run_report(output, api)
                self.assertEqual(status, 3)
                self.assertIn("Report published", stdout)
                self.assertIn("Incomplete GitHub coverage", stderr)
                self.assertEqual(waits, expected_waits)
                self.assertEqual(requests, [f"{API}/repos/{REPO}"] * 3)
                current = output / "current"
                self.assertNotEqual(current.readlink(), first)
                report = json.loads((current / "report.json").read_text())
                self.assertEqual(report["coverage"]["commits"]["status"], "unavailable")
                self.assertIn("retry budget exhausted", report["coverage"]["commits"]["reason"])
                self.assertIn(report["as_of"], (current / "report.md").read_text())

    @unittest.skipUnless(sys.platform == "darwin", "requires real macOS ACL inheritance")
    def test_cli_refuses_inherited_acl_before_writing(self):
        with TemporaryDirectory(dir="/private/tmp") as parent:
            parent = Path(parent)
            parent.chmod(0o755)
            subprocess.run(["/bin/chmod", "+a", "everyone allow list,search,file_inherit,directory_inherit",
                            parent], check=True)
            output = parent / "private\noutput"
            output.mkdir(mode=0o700)
            subprocess.run(["/usr/bin/xattr", "-w", "com.example.fixture", "fixture", output], check=True)
            acl = subprocess.check_output(["/bin/ls", "-ldbe", output])
            self.assertIn(b"inherited allow", acl)
            self.assertEqual(output.stat().st_mode & 0o777, 0o700)

            api = Fixture()
            status, stdout, stderr = self.run_report(output, api)
            self.assertEqual(status, 1)
            self.assertEqual(stdout, "")
            self.assertIn("macOS ACL", stderr)
            self.assertEqual(api.calls, [])
            self.assertEqual(list(output.iterdir()), [])


if __name__ == "__main__":
    unittest.main()
