"""Fixture coverage for the private engineering activity report."""

from contextlib import redirect_stderr, redirect_stdout
from email.message import Message
import io
import json
import os
from pathlib import Path
import ssl
from tempfile import TemporaryDirectory
import unittest
from unittest.mock import patch
from urllib.error import HTTPError, URLError

from engineering_metrics import build_report, distribution, render_markdown, timestamp
from engineering_report import (
    API, GitHub, Unavailable, collect, issue_events, main, prepare_output, read_churn,
)


SHA_A = "a" * 40
SHA_B = "b" * 40
REPO = "owner/repo"
AS_OF = "2026-02-03T12:00:00Z"


def at(day, hour=0, month=2):
    return f"2026-{month:02d}-{day:02d}T{hour:02d}:00:00Z"


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
        }[endpoint]

    def pages(self, endpoint, **params):
        self.call(endpoint)
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


class ReportTests(unittest.TestCase):
    def setUp(self):
        self.api = Fixture()
        self.cache = {}

    def collect(self, as_of=AS_OF):
        return build_report(REPO, as_of, *collect(self.api, self.cache, as_of))

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
        self.assertEqual(self.api.calls, ["", "/branches/main", "/commits", "/pulls", "/issues"])

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

    def test_cli_publishes_private_pair_and_reuses_cache(self):
        with TemporaryDirectory() as directory, patch(
            "sys.argv", ["engineering_report.py", "--repo", REPO, "--output-dir", directory]
        ), patch("engineering_report.read_token", return_value="fixture-secret"), patch(
            "engineering_report.GitHub", return_value=self.api
        ), redirect_stdout(io.StringIO()), redirect_stderr(io.StringIO()):
            old_mask = os.umask(0o077)
            try:
                self.assertEqual(main(), 0)
                first = (Path(directory) / "current").resolve()
                self.assertEqual(main(), 0)
                current = (Path(directory) / "current").resolve()
                self.assertNotEqual(first, current)
                report = json.loads((current / "report.json").read_text())
                self.assertIn(report["as_of"], (current / "report.md").read_text())
                self.assertEqual(report["schema_version"], 1)
                for path in (current, *current.iterdir(), Path(directory) / "cache.json"):
                    self.assertEqual(path.stat().st_mode & 0o077, 0)
                self.assertNotIn("fixture-secret", (Path(directory) / "cache.json").read_text())
            finally:
                os.umask(old_mask)

    def test_rejects_checkout_output(self):
        with self.assertRaisesRegex(Unavailable, "outside Git worktrees"):
            prepare_output(Path(__file__).resolve().parent / "report")


if __name__ == "__main__":
    unittest.main()
