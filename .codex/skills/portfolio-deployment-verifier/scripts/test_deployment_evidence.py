#!/usr/bin/env python3
import copy
import unittest
from verify_deployment_evidence import verify, load_classifier

TARGET = "a" * 40
OTHER = "b" * 40


def fixture():
    tag = "deploy-20261007T140000Z-aaaaaaa"
    url = "https://deploy-123--waffy.netlify.app"
    run_url = "https://github.com/waffy1901/personalWebsite/actions/runs/42"
    capture = {"captured_at": "2026-10-07T14:00:00Z", "site": {"id": "site-123",
               "published_deploy": {"id": "deploy-123", "state": "ready", "commit_ref": TARGET,
                                    "deploy_ssl_url": url}}}
    packet = {"target_sha": TARGET, "site_id": "site-123", "site_before": capture,
              "site_after": copy.deepcopy(capture), "workflow": {"id": 42, "run_attempt": 1,
              "path": ".github/workflows/release-on-deploy.yml", "repository": {"full_name": "waffy1901/personalWebsite"},
              "head_sha": TARGET, "head_branch": "main", "event": "push", "status": "completed",
              "conclusion": "success", "html_url": run_url},
              "release": {"tag_name": tag, "draft": False, "prerelease": False,
                          "target_commitish": "main", "body": f"Commit {TARGET}\nWorkflow {run_url}\nDeploy {url}",
                          "html_url": f"https://github.com/waffy1901/personalWebsite/releases/tag/{tag}"},
              "resolved_tag": {"tag_name": tag, "commit_sha": TARGET}}
    packet["site_after"]["captured_at"] = "2026-10-07T14:01:00Z"
    return packet


class DeploymentTests(unittest.TestCase):
    def test_exact_links_prove_provenance_only(self):
        result = verify(fixture())
        self.assertTrue(result["provenance_verified"])
        self.assertFalse(result["live_behavior_verified"])
        self.assertEqual(result["classification"], "exact_target")

    def test_branch_target_commitish_cannot_replace_tag_resolution(self):
        packet = fixture()
        packet["resolved_tag"]["commit_sha"] = OTHER
        with self.assertRaises(ValueError):
            verify(packet)

    def test_green_workflow_without_release_is_incomplete(self):
        packet = fixture()
        packet["release"] = packet["resolved_tag"] = None
        self.assertFalse(verify(packet)["provenance_verified"])

    def test_newest_ready_attempt_does_not_replace_published_pointer(self):
        packet = fixture()
        for key in ("site_before", "site_after"):
            packet[key]["site"]["published_deploy"]["commit_ref"] = OTHER
        packet["target_attempt"] = {"context": "production", "state": "ready", "commit_ref": TARGET}
        result = verify(packet)
        self.assertEqual(result["classification"], "different_commit")
        self.assertFalse(result["provenance_verified"])

    def test_production_advancement_requires_exact_ancestry(self):
        packet = fixture()
        for key in ("site_before", "site_after"):
            packet[key]["site"]["published_deploy"]["commit_ref"] = OTHER
        packet["ancestry"] = {"ancestor": TARGET, "descendant": OTHER, "is_ancestor": True}
        self.assertEqual(verify(packet)["classification"], "production_advanced")
        packet["ancestry"]["descendant"] = "c" * 40
        self.assertEqual(verify(packet)["classification"], "different_commit")

    def test_skip_has_no_target_production_claim(self):
        for mode in ("explicit", "no content"):
            packet = fixture()
            packet["release"] = packet["resolved_tag"] = None
            for key in ("site_before", "site_after"):
                packet[key]["site"]["published_deploy"]["commit_ref"] = OTHER
            attempt = {"context": "production", "commit_ref": TARGET}
            if mode == "explicit":
                attempt["skipped"] = True
            else:
                attempt.update(state="error", error_message="Failed during stage 'checking build content for changes': Canceled build due to no content change")
            packet["target_attempt"] = attempt
            result = verify(packet)
            self.assertEqual(result["classification"], "target_skipped")
            self.assertFalse(result["provenance_verified"])

    def test_generic_error_or_other_commit_is_not_skip(self):
        for attempt in ({"commit_ref": TARGET, "state": "error", "error_message": "unrelated error"},
                        {"commit_ref": OTHER, "skipped": True}):
            self.assertNotEqual(load_classifier()([attempt], TARGET)["decision"], "skipped")

    def test_deployment_race_including_same_sha_new_id_stays_unverified(self):
        for field, value in (("commit_ref", OTHER), ("id", "deploy-456")):
            packet = fixture()
            packet["site_after"]["site"]["published_deploy"][field] = value
            result = verify(packet)
            self.assertEqual(result["classification"], "production_changed_during_checks")
            self.assertFalse(result["provenance_verified"])

    def test_malformed_or_nonready_published_data_is_rejected(self):
        for field, value in (("commit_ref", "abc"), ("id", "bad\nvalue"), ("state", "building"),
                             ("deploy_ssl_url", "https://user:secret@example.com"),
                             ("deploy_ssl_url", "http://example.com")):
            packet = fixture()
            packet["site_before"]["site"]["published_deploy"][field] = value
            with self.assertRaises(ValueError):
                verify(packet)

    def test_wrong_workflow_site_or_draft_release_cannot_verify(self):
        for case in ("workflow", "site", "draft", "body"):
            packet = fixture()
            if case == "workflow":
                packet["workflow"]["head_sha"] = OTHER
            elif case == "site":
                packet["site_after"]["site"]["id"] = "site-other"
            elif case == "draft":
                packet["release"]["draft"] = True
            else:
                packet["release"]["body"] = "unrelated release"
            with self.assertRaises(ValueError):
                verify(packet)


if __name__ == "__main__":
    unittest.main()
