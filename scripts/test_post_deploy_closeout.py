#!/usr/bin/env python3
"""Offline API fixtures: closeout must not write until all gates have passed."""
import base64
import copy
from datetime import datetime, timezone
import json
from pathlib import Path
import re
import sys
import unittest

sys.dont_write_bytecode = True
import post_deploy_closeout as c

ROOT = Path(__file__).resolve().parents[1]
SHA = "a" * 40
STAMP = "2026-11-05T01:00:00Z"
NOW = datetime(2026, 11, 5, 2, tzinfo=timezone.utc)
BODY = "## Acceptance\n- [ ] Canonical routes return the configured status.\nRetain the reviewed source implementation.\n"


def contract():
    return {"version": 1, "issue": 123, "body_sha256": c.digest(BODY),
            "evidence_needed": ["Source", "Local checks", "Production HTTP"],
            "requirements": [{"line": 2, "text": BODY.splitlines()[1], "evidence": ["http.routes", "checks.test"]},
                             {"line": 3, "text": BODY.splitlines()[2], "evidence": ["source.merged_pr"]}],
            "context_lines": [1]}


def project():
    fields = {"Status": {"optionId": "validation", "name": "Validation"}, "Priority": {"optionId": "next", "name": "Next"},
              "Severity": {"optionId": "low", "name": "Low"}, "Area": {"optionId": "seo", "name": "SEO / Architecture"},
              "Evidence needed": {"options": [{"id": str(i), "name": n} for i, n in enumerate(contract()["evidence_needed"])]},
              "Owner note": {"text": "Keep me"}, "Effort": {"number": 8}, "Updated": {"derived_lifecycle": True},
              "Closed": {"derived_lifecycle": True}}
    return {"id": "project", "url": c.PROJECT_URL, "public": True, "item_id": "item", "status_field": "status", "done_option": "done",
            "definitions": [{"id": "status", "name": "Status", "dataType": "SINGLE_SELECT",
                             "options": [{"id": "validation", "name": "Validation"}, {"id": "done", "name": "Done"}]}],
            "memberships": [{"id": "item", "project": {"id": "project", "url": c.PROJECT_URL, "public": True}}], "fields": fields}


class FakeAPI:
    def __init__(self):
        self.site_id = "site-123"
        self.run = {"id": 42, "run_attempt": 1, "head_sha": SHA, "head_branch": "main", "event": "push",
                    "path": c.UPSTREAM, "workflow_id": 7, "name": "Create deployment release", "status": "completed",
                    "conclusion": "success", "html_url": f"https://github.com/{c.REPO}/actions/runs/42",
                    "repository": {"full_name": c.REPO}, "head_repository": {"full_name": c.REPO},
                    "run_started_at": STAMP, "updated_at": "2026-11-05T01:30:00Z"}
        self.event = {"action": "completed", "repository": {"full_name": c.REPO}, "workflow_run": copy.deepcopy(self.run)}
        self.jobs = []
        for i, (name, steps) in enumerate(c.REQUIRED_STEPS.items(), 1):
            self.jobs.append({"id": i, "run_id": 42, "head_sha": SHA, "name": name, "status": "completed", "conclusion": "success",
                              "started_at": STAMP, "completed_at": "2026-11-05T01:25:00Z",
                              "steps": [{"name": name, "number": n, "status": "completed", "conclusion": "success",
                                         "started_at": STAMP, "completed_at": "2026-11-05T01:20:00Z"} for n, name in enumerate(steps, 1)]})
        self.pr = {"number": 456, "merged": True, "merge_commit_sha": SHA, "merged_at": STAMP, "changed_files": 2,
                   "base": {"ref": "main", "repo": {"full_name": c.REPO}}, "head": {"repo": {"full_name": c.REPO}},
                   "html_url": f"https://github.com/{c.REPO}/pull/456"}
        self.files = [{"filename": ".github/closeout/issue-123.json", "status": "added"}, {"filename": "main/src/App.jsx", "status": "modified"}]
        self.contract = contract()
        self.release = {"id": 4, "tag_name": "deploy-20261105T011000Z-aaaaaaa", "draft": False, "prerelease": False,
                        "published_at": "2026-11-05T01:10:00Z", "html_url": f"https://github.com/{c.REPO}/releases/tag/deploy-20261105T011000Z-aaaaaaa",
                        "body": f"Automated release for deployment commit {SHA}.\n\n- Branch: main\n- Workflow run: {self.run['html_url']}\n- Site: https://waffy.dev\n- Netlify deploy: https://deploy123--waffy.netlify.app\n- Netlify deploy ID: deploy123"}
        self.tag = {"type": "commit", "sha": SHA}
        self.site_value = {"id": self.site_id, "name": "waffy", "custom_domain": "waffy.dev", "published_deploy": {
            "id": "deploy123", "site_id": self.site_id, "context": "production", "commit_ref": SHA, "state": "ready", "skipped": False}}
        self.issue_value = {"id": "issue", "number": 123, "url": f"https://github.com/{c.REPO}/issues/123", "body": BODY,
                            "title": "Keep title", "state": "OPEN", "stateReason": None, "locked": False,
                            "milestone": {"id": "milestone", "title": "Keep milestone"}, "assignees": ["alice", "waffy1901"], "labels": ["bug", "seo"]}
        self.project_value = project()
        self.comment_values = []
        self.writes, self.reads = [], []
        self.fail = None
        self.hook = lambda *args: None
        self.bot_closed = False

    def read(self, method, value):
        self.reads.append(method)
        self.hook(method, self)
        return copy.deepcopy(value)

    def get(self, path):
        if path.startswith("actions/runs/"):
            return self.read("run", self.run)
        if path == "pulls/456":
            return self.read("pr", self.pr)
        if path.startswith("git/ref/tags/"):
            return self.read("tag", {"object": self.tag})
        if path.startswith("git/tags/"):
            return self.read("tag", {"object": {"type": "commit", "sha": SHA}})
        raise AssertionError(path)

    def pages(self, path, key=None):
        if path.endswith("/jobs"):
            return self.read("jobs", self.jobs)
        if path.startswith("commits/"):
            return [{"number": 456}]
        if path == "pulls/456/files":
            return self.read("files", self.files)
        if path == "releases":
            return self.read("releases", [self.release])
        raise AssertionError(path)

    def content(self, path, sha):
        self.assert_sha = sha
        if path == c.UPSTREAM:
            return (ROOT / c.UPSTREAM).read_text()
        return json.dumps(self.contract)

    def site(self):
        return self.read("site", self.site_value)

    def issue(self, number):
        return self.read("issue", self.issue_value)

    def project(self, issue):
        if self.fail == "project access":
            raise c.Pending("Project 2 write access unavailable")
        return self.read("project", self.project_value)

    def comments(self, number):
        return self.read("comments", self.comment_values)

    def comment(self, comment_id):
        result = self.read("comment", next(c for c in self.comment_values if c["id"] == comment_id))
        if self.fail == "comment readback":
            result["body"] += "tampered"
        return result

    def post_comment(self, number, body):
        self.writes.append("comment")
        result = {"id": 99, "node_id": "comment-node", "body": body, "user": {"id": c.BOT_ID},
                  "created_at": "2026-11-05T02:00:00Z", "updated_at": "2026-11-05T02:00:00Z",
                  "issue_url": f"https://api.github.com/repos/{c.REPO}/issues/123",
                  "html_url": f"https://github.com/{c.REPO}/issues/123#issuecomment-99"}
        self.comment_values.append(result)
        if self.fail == "lost comment response":
            raise c.Pending("lost comment response")
        return copy.deepcopy(result)

    def close_issue(self, number, body):
        self.writes.append("close")
        if self.fail == "close":
            raise c.Pending("close failed")
        self.issue_value.update(body=body, state="CLOSED", stateReason="COMPLETED")
        self.bot_closed = True
        if self.fail == "close readback":
            self.issue_value["labels"].append("concurrent")

    def closed_by_bot(self, number, after):
        return self.bot_closed

    def set_done(self, project):
        self.writes.append("done")
        if self.fail == "done":
            raise c.Pending("project write failed")
        self.project_value = c.done_project(self.project_value)
        if self.fail == "project readback":
            self.project_value["fields"]["Owner note"] = {"text": "concurrent"}


class CloseoutTests(unittest.TestCase):
    def setUp(self):
        self.api = FakeAPI()
        self.report = {}

    def run_closeout(self):
        return c.execute(self.api, self.api.event, NOW, self.report)

    def assert_pending_without_writes(self):
        with self.assertRaises((c.Pending, ValueError)):
            self.run_closeout()
        self.assertEqual([], self.api.writes)

    def test_happy_path_preserves_metadata_and_extra_fields(self):
        issue, project_before = copy.deepcopy(self.api.issue_value), copy.deepcopy(self.api.project_value)
        result = self.run_closeout()
        self.assertEqual("verified", result["status"])
        self.assertEqual(["comment", "close", "done"], self.api.writes)
        self.assertEqual(c.final_issue(issue), self.api.issue_value)
        self.assertEqual(c.done_project(project_before), self.api.project_value)
        self.assertGreaterEqual(self.api.reads.count("site"), 5)
        self.assertGreaterEqual(self.api.reads.count("comment"), 4)
        self.assertIn("human-reviewed", self.api.comment_values[0]["body"])

    def test_required_upstream_steps_fail_closed(self):
        for job in range(3):
            for result in ("skipped", "failure", "cancelled", None):
                with self.subTest(job=job, result=result):
                    self.api = FakeAPI()
                    self.api.jobs[job]["steps"][0]["conclusion"] = result
                    self.assert_pending_without_writes()

    def test_green_workflow_skipped_deploy(self):
        self.api.jobs[2]["conclusion"] = "skipped"
        self.assert_pending_without_writes()

    def test_wrong_run_sha_branch_repository_attempt(self):
        for key, value in (("head_sha", "b" * 40), ("run_attempt", 2), ("event", "workflow_dispatch"),
                           ("head_branch", "other"), ("path", "other.yml"), ("repository", {"full_name": "foreign/repo"})):
            with self.subTest(key=key):
                self.api = FakeAPI()
                self.api.run[key] = value
                self.assert_pending_without_writes()

    def test_stale_run(self):
        self.api.run["updated_at"] = "2026-11-03T01:30:00Z"
        self.assert_pending_without_writes()

    def test_wrong_job_sha_or_previous_attempt(self):
        self.api.jobs[0]["head_sha"] = "b" * 40
        self.assert_pending_without_writes()
        self.api = FakeAPI()
        self.api.jobs[0]["started_at"] = "2026-11-04T01:00:00Z"
        self.assert_pending_without_writes()

    def test_release_wrong_run_attempt_deploy_or_tag(self):
        for change in ("run", "attempt", "deploy", "tag"):
            with self.subTest(change=change):
                self.api = FakeAPI()
                if change == "run":
                    self.api.release["body"] = self.api.release["body"].replace("/runs/42", "/runs/4242")
                elif change == "attempt":
                    self.api.release["published_at"] = "2026-11-04T01:10:00Z"
                elif change == "deploy":
                    self.api.release["body"] += ".attacker.test"
                else:
                    self.api.tag["sha"] = "b" * 40
                self.assert_pending_without_writes()

    def test_annotated_tag_is_peeled(self):
        self.api.tag = {"type": "tag", "sha": "b" * 40}
        self.assertEqual("verified", self.run_closeout()["status"])

    def test_wrong_published_sha_and_identity(self):
        for field, value in (("commit_ref", "b" * 40), ("id", "other"), ("site_id", "other"), ("state", "error")):
            with self.subTest(field=field):
                self.api = FakeAPI()
                self.api.site_value["published_deploy"][field] = value
                self.assert_pending_without_writes()

    def test_malformed_supplied_provider_url_blocks(self):
        self.api.site_value["published_deploy"]["deploy_ssl_url"] = "http://unsafe.invalid/path"
        self.assert_pending_without_writes()

    def test_advisory_browser_does_not_supply_evidence(self):
        self.api.contract["evidence_needed"].append("Browser")
        self.api.jobs.append({"id": 88, "name": "Advisory production browser smoke", "conclusion": "success"})
        self.assert_pending_without_writes()

    def test_project_external_account_cannot_be_omitted(self):
        self.api.project_value["fields"]["Evidence needed"]["options"].append({"id": "external", "name": "External account"})
        self.assert_pending_without_writes()

    def test_body_drift_including_prechecked_criteria(self):
        for body in (BODY + "New prose requirement\n", BODY.replace("[ ]", "[x]")):
            with self.subTest(body=body):
                self.api = FakeAPI()
                self.api.issue_value["body"] = body
                self.assert_pending_without_writes()

    def test_incomplete_or_ambiguous_pr_files(self):
        self.api.pr["changed_files"] += 1
        self.assert_pending_without_writes()
        self.api = FakeAPI()
        self.api.files[1] = {"filename": ".github/closeout/issue-124.json", "status": "added"}
        self.assert_pending_without_writes()

    def test_missing_contract_or_renamed_contract(self):
        self.api.files[0]["status"] = "renamed"
        self.assert_pending_without_writes()
        self.api = FakeAPI()
        self.api.files[0]["filename"] = "unrelated.json"
        self.assert_pending_without_writes()

    def test_manually_closed_issue_is_never_reclosed(self):
        self.api.issue_value["state"] = "CLOSED"
        self.assert_pending_without_writes()

    def test_missing_project_credential_and_access(self):
        with self.assertRaises(c.Pending):
            c.API("repo", "", "netlify", "site")
        self.api.fail = "project access"
        self.assert_pending_without_writes()

    def test_concurrent_project_change_prevents_first_write(self):
        def change(method, api):
            if method == "project" and api.reads.count("project") == 2:
                api.project_value["fields"]["Owner note"] = {"text": "changed"}
        self.api.hook = change
        self.assert_pending_without_writes()

    def test_pointer_changes_before_first_write(self):
        def change(method, api):
            if method == "comments" and api.reads.count("comments") == 2:
                api.site_value["published_deploy"]["id"] = "different"
        self.api.hook = change
        self.assert_pending_without_writes()

    def test_comment_readback_mismatch_stops_closure(self):
        self.api.fail = "comment readback"
        with self.assertRaises(c.Pending):
            self.run_closeout()
        self.assertEqual(["comment"], self.api.writes)
        self.assertEqual("OPEN", self.api.issue_value["state"])

    def test_final_readback_mismatches_are_partial_not_success(self):
        for failure in ("close readback", "project readback"):
            with self.subTest(failure=failure):
                self.api = FakeAPI()
                self.api.fail = failure
                with self.assertRaises(c.Pending):
                    self.run_closeout()
                self.assertTrue(self.report["writes_attempted"])
                self.assertNotEqual("verified", self.report["status"])

    def test_successful_rerun_has_no_duplicate_comments_or_writes(self):
        self.run_closeout()
        self.api.writes.clear()
        self.assertEqual("verified", self.run_closeout()["status"])
        self.assertEqual([], self.api.writes)
        self.assertEqual(1, len(self.api.comment_values))

    def test_lost_comment_response_is_resumable(self):
        self.api.fail = "lost comment response"
        with self.assertRaises(c.Pending):
            self.run_closeout()
        self.api.fail = None
        self.assertEqual("verified", self.run_closeout()["status"])
        self.assertEqual(["comment", "close", "done"], self.api.writes)

    def test_partial_close_and_project_failure_resume_from_original_expectation(self):
        for failure in ("close", "done"):
            with self.subTest(failure=failure):
                self.api = FakeAPI()
                self.api.fail = failure
                with self.assertRaises(c.Pending):
                    self.run_closeout()
                self.api.fail = None
                self.assertEqual("verified", self.run_closeout()["status"])
                self.assertEqual(1, self.api.writes.count("comment"))

    def test_private_values_in_public_project_are_only_fingerprinted(self):
        private_url = "https://github.com/example/private-repo/pull/7"
        self.api.project_value["fields"]["Linked pull requests"] = {"pullRequests": [{"url": private_url}]}
        before = c.fingerprint(self.api.project_value)
        self.api.fail = "done"
        with self.assertRaises(c.Pending):
            self.run_closeout()
        body = self.api.comment_values[0]["body"]
        encoded = re.search(r"<!-- closeout-baseline:([A-Za-z0-9+/=]+) -->", body)[1]
        saved = base64.b64decode(encoded).decode()
        self.assertNotIn(private_url, body)
        self.assertNotIn(private_url, saved)
        self.assertEqual(before, json.loads(saved)["expected"]["project_before"])
        self.api.fail = None
        self.api.project_value["fields"]["Linked pull requests"]["pullRequests"].clear()
        self.api.writes.clear()
        self.assert_pending_without_writes()

    def test_manual_close_after_comment_does_not_authorize_project_write(self):
        self.api.fail = "close"
        with self.assertRaises(c.Pending):
            self.run_closeout()
        self.api.fail = None
        self.api.issue_value = c.final_issue(self.api.issue_value)
        self.api.writes.clear()
        self.assert_pending_without_writes()

    def test_rerun_rejects_changed_baseline_or_comment_author(self):
        self.run_closeout()
        self.api.project_value["fields"]["Effort"] = {"number": 9}
        self.api.writes.clear()
        self.assert_pending_without_writes()
        self.api = FakeAPI()
        self.run_closeout()
        self.api.comment_values[0]["user"]["id"] = 123
        self.api.writes.clear()
        self.assert_pending_without_writes()


    def test_edited_evidence_comment_stops_recovery_even_with_original_body(self):
        self.api.fail = "close"
        with self.assertRaises(c.Pending):
            self.run_closeout()
        self.api.fail = None
        self.api.writes.clear()
        original = self.api.comment_values[0]
        original["node_id"] = "IC_example"
        wire = c.API("repo-token", "project-token", "netlify-token", self.api.site_id)
        wire.get = lambda path: copy.deepcopy(original)
        record = {"id": original["node_id"], "body": original["body"], "lastEditedAt": None}
        wire.graphql = lambda *args: {"node": record}
        self.assertEqual(original, wire.comment(original["id"]))
        record["lastEditedAt"] = original["created_at"]
        self.api.comment = wire.comment
        with self.assertRaisesRegex(c.Pending, "comment was edited"):
            self.run_closeout()
        self.assertEqual([], self.api.writes)


class DataAndPaginationTests(unittest.TestCase):
    def test_line_mapping_is_complete_and_checklists_cannot_be_context(self):
        data = contract()
        c.validate_contract(data, BODY, 123)
        data["context_lines"].append(2)
        data["requirements"].pop(0)
        data["evidence_needed"] = ["Source"]
        with self.assertRaises(c.Pending):
            c.validate_contract(data, BODY, 123)
        data = contract()
        data["context_lines"] = []
        with self.assertRaises(c.Pending):
            c.validate_contract(data, BODY, 123)

    def test_duplicate_json_keys_and_unknown_evidence_rejected(self):
        with self.assertRaises(c.Pending):
            c.strict_json('{"version":1,"version":1}')
        data = contract()
        data["requirements"][0]["evidence"] = ["browser.arbitrary"]
        with self.assertRaises(c.Pending):
            c.validate_contract(data)

    def test_checkboxes_only_change(self):
        original = "# Title\r\n- [ ] one\r\n  - [X] two\r\n3. [ ] three\r\nProse stays.\r\n"
        self.assertEqual(original.replace("[ ]", "[x]").replace("[X]", "[x]"), c.completed_body(original))

    def api(self):
        return c.API("repo", "project", "netlify", "site")

    def test_comment_readback_compares_stable_metadata_across_endpoints(self):
        api = self.api()
        comment = FakeAPI().post_comment(123, "exact evidence")
        listed = {**comment, "user": {**comment["user"], "avatar_url": "https://avatar.example/list"}}
        detail = {**comment, "user": {**comment["user"], "avatar_url": "https://avatar.example/detail"}}
        api.pages = lambda path: [listed]
        api.get = lambda path: detail
        api.graphql = lambda *args: {"node": {"id": comment["node_id"], "body": comment["body"], "lastEditedAt": None}}
        self.assertEqual(api.comments(123), [api.comment(comment["id"])])
        listed["user"]["id"] = 1
        self.assertNotEqual(api.comments(123), [api.comment(comment["id"])])

    def test_rest_pagination_all_pages_and_count(self):
        api = self.api()
        calls = []
        def request(method, path):
            calls.append(path)
            if len(calls) == 1:
                return {"total_count": 2, "jobs": [{"id": 1}]}, {"Link": f'<https://api.github.com/repos/{c.REPO}/actions/runs/42/attempts/1/jobs?per_page=100&page=2>; rel="next"'}
            return {"total_count": 2, "jobs": [{"id": 2}]}, {}
        api.request = request
        self.assertEqual([{"id": 1}, {"id": 2}], api.pages("actions/runs/42/attempts/1/jobs", "jobs"))
        self.assertEqual(2, len(calls))
        api.request = lambda *args: ({"total_count": 2, "jobs": [{"id": 1}]}, {})
        with self.assertRaises(c.Pending):
            api.pages("actions/runs/42/attempts/1/jobs", "jobs")

    def test_rest_rejects_foreign_pagination_origin(self):
        api = self.api()
        api.request = lambda *args: ([], {"Link": '<https://attacker.test/a>; rel="next"'})
        with self.assertRaises(c.Pending):
            api.pages("releases")

    def test_graphql_pagination_all_pages_and_incomplete_cursor(self):
        api = self.api()
        calls = []
        def graphql(query, variables, credential):
            calls.append(variables.copy())
            return {"node": {"labels": {"nodes": [{"id": str(len(calls))}], "pageInfo": {
                "hasNextPage": len(calls) == 1, "endCursor": "cursor"}}}}
        api.graphql = graphql
        self.assertEqual([{"id": "1"}, {"id": "2"}], api.typed_connection("issue", "Issue", "labels", "id"))
        self.assertEqual("cursor", calls[1]["cursor"])
        api.graphql = lambda *args: {"node": {"labels": {"nodes": [], "pageInfo": {"hasNextPage": True, "endCursor": None}}}}
        with self.assertRaises(c.Pending):
            api.typed_connection("issue", "Issue", "labels", "id")

    def test_upstream_workflow_catalog_pin_is_current(self):
        self.assertEqual(c.UPSTREAM_HASH, c.digest((ROOT / c.UPSTREAM).read_text()))


class ProjectSnapshotTests(unittest.TestCase):
    def setUp(self):
        self.api = c.API("repo", "project", "netlify", "site")
        self.issue = FakeAPI().issue_value
        self.definitions, self.values = [], []
        for name in ("Status", "Priority", "Severity", "Area"):
            options = [{"id": "done", "name": "Done"}, {"id": "active", "name": "Active"}]
            self.definitions.append({"__typename": "ProjectV2SingleSelectField", "id": name, "name": name,
                                     "dataType": "SINGLE_SELECT", "options": options})
            self.values.append({"__typename": "ProjectV2ItemFieldSingleSelectValue",
                                "field": {"id": name}, "optionId": "active", "name": "Active"})
        options = [{"id": "source", "name": "Source"}, {"id": "http", "name": "Production HTTP"}]
        self.definitions.append({"__typename": "ProjectV2MultiSelectField", "id": "evidence", "name": "Evidence needed",
                                 "dataType": "MULTI_SELECT", "multiSelectOptions": options})
        self.values.append({"__typename": "ProjectV2ItemFieldMultiSelectValue",
                            "field": {"id": "evidence"}, "options": options})
        for name in ("Created", "Updated", "Closed"):
            self.definitions.append({"__typename": "ProjectV2Field", "id": name, "name": name, "dataType": name.upper()})
            self.values.append({"__typename": "ProjectV2ItemFieldDateValue",
                                "field": {"id": name}, "date": "2026-11-05"})
        self.definitions.append({"__typename": "ProjectV2Field", "id": "extra", "name": "Extra", "dataType": "NUMBER"})
        self.values.append({"__typename": "ProjectV2ItemFieldNumberValue", "field": {"id": "extra"}, "number": 42})
        self.memberships = [{"id": "item", "isArchived": False, "project": {"id": "project", "url": c.PROJECT_URL, "public": True},
                             "content": {"id": "issue", "url": self.issue["url"]}}]
        self.api.graphql = lambda *args: {"user": {"projectV2": {"id": "project", "url": c.PROJECT_URL, "public": True, "viewerCanUpdate": True}}}
        self.api.typed_connection = self.connection

    def connection(self, node_id, typename, field, selection, credential="project"):
        return copy.deepcopy({"fields": self.definitions, "fieldValues": self.values, "projectItems": self.memberships}[field])

    def test_multiselect_options_and_extra_values_preserved(self):
        result = self.api.project(self.issue)
        self.assertEqual(["Production HTTP", "Source"], [o["name"] for o in result["fields"]["Evidence needed"]["options"]])
        self.assertEqual({"number": 42}, result["fields"]["Extra"])
        self.assertEqual({"date": "2026-11-05"}, result["fields"]["Created"])
        self.assertEqual({"derived_lifecycle": True}, result["fields"]["Updated"])
        self.assertEqual({"derived_lifecycle": True}, result["fields"]["Closed"])
        self.assertEqual("done", result["done_option"])

    def test_computed_field_pages_are_read_by_item_and_definition(self):
        typename = "ProjectV2ItemFieldLabelValue"
        self.definitions.append({"__typename": "ProjectV2Field", "id": "labels", "name": "Labels", "dataType": "LABELS"})
        self.values.append({"__typename": typename, "field": {"id": "labels"}})
        project_query = self.api.graphql
        calls = []
        changed_definition = False

        def graphql(query, variables, credential="project"):
            if "fieldValueByName" not in query:
                return project_query(query, variables, credential)
            calls.append(variables)
            first = variables["cursor"] is None
            label = {"id": "b", "name": "second"} if first else {"id": "a", "name": "first"}
            return {"node": {"fieldValueByName": {"__typename": typename,
                "field": {"id": "changed" if changed_definition and not first else "labels"},
                "labels": {"nodes": [label], "pageInfo": {"hasNextPage": first, "endCursor": "next"}}}}}

        self.api.graphql = graphql
        result = self.api.project(self.issue)
        self.assertEqual([{"id": "item", "name": "Labels", "cursor": cursor} for cursor in (None, "next")], calls)
        self.assertEqual([{"id": "a", "name": "first"}, {"id": "b", "name": "second"}], result["fields"]["Labels"]["labels"])
        changed_definition = True
        with self.assertRaisesRegex(c.Pending, "nested Project field identity changed"):
            self.api.project(self.issue)

    def test_duplicate_membership_or_field_definition_blocks(self):
        self.memberships.append({**self.memberships[0], "id": "duplicate-item"})
        with self.assertRaises(c.Pending):
            self.api.project(self.issue)
        self.memberships.pop()
        self.definitions.append({**self.definitions[-1], "id": "different-id"})
        with self.assertRaises(c.Pending):
            self.api.project(self.issue)

    def test_unsupported_extra_schema_or_value_blocks(self):
        self.definitions[-1]["dataType"] = "FUTURE_TYPE"
        with self.assertRaises(c.Pending):
            self.api.project(self.issue)
        self.definitions[-1]["dataType"] = "NUMBER"
        self.values[-1] = {"__typename": "ProjectV2ItemIssueFieldValue"}
        with self.assertRaises(c.Pending):
            self.api.project(self.issue)

    def test_unknown_option_is_not_silently_omitted(self):
        self.values[4]["options"] = self.values[4]["options"] + [{"id": "unknown", "name": "Browser"}]
        with self.assertRaises(c.Pending):
            self.api.project(self.issue)

    def test_private_project_or_other_membership_is_not_published(self):
        self.api.graphql = lambda *args: {"user": {"projectV2": {"id": "project", "url": c.PROJECT_URL, "public": False, "viewerCanUpdate": True}}}
        with self.assertRaisesRegex(c.Pending, "private Project"):
            self.api.project(self.issue)
        self.api.graphql = lambda *args: {"user": {"projectV2": {"id": "project", "url": c.PROJECT_URL, "public": True, "viewerCanUpdate": True}}}
        self.memberships.append({"id": "private", "project": {"id": "other", "public": False}})
        with self.assertRaisesRegex(c.Pending, "private/inaccessible"):
            self.api.project(self.issue)

    def test_custom_updated_date_is_preserved(self):
        self.definitions[6]["dataType"] = "DATE"
        result = self.api.project(self.issue)
        self.assertEqual({"date": "2026-11-05"}, result["fields"]["Updated"])


if __name__ == "__main__":
    unittest.main()
