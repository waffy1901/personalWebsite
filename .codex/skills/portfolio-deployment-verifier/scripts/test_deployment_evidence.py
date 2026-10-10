#!/usr/bin/env python3
import copy
import json
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest
from verify_deployment_evidence import verify, load_classifier

TARGET = "a" * 40
OTHER = "b" * 40


def attempt_fixture(**overrides):
    attempt = {"id": "6ac57980be631d00088913fe", "context": "production", "site_id": "site-123",
               "state": "ready", "commit_ref": TARGET}
    attempt.update(overrides)
    return attempt


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
        packet["target_attempt"] = attempt_fixture()
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
            attempt = attempt_fixture(state="error")
            if mode == "explicit":
                attempt["skipped"] = True
            else:
                attempt.update(state="error", error_message="Failed during stage 'checking build content for changes': Canceled build due to no content change")
            packet["target_attempt"] = attempt
            result = verify(packet)
            self.assertEqual(result["classification"], "target_skipped")
            self.assertFalse(result["provenance_verified"])

    def test_skipped_attempt_requires_the_expected_site(self):
        for mode in ("explicit", "no content"):
            for site_id in (None, "site-other"):
                with self.subTest(mode=mode, site_id=site_id):
                    packet = fixture()
                    packet["release"] = packet["resolved_tag"] = None
                    for key in ("site_before", "site_after"):
                        packet[key]["site"]["published_deploy"]["commit_ref"] = OTHER
                    attempt = attempt_fixture(state="error")
                    del attempt["site_id"]
                    if site_id is not None:
                        attempt["site_id"] = site_id
                    if mode == "explicit":
                        attempt["skipped"] = True
                    else:
                        attempt.update(state="error", error_message="Failed during stage 'checking build content for changes': Canceled build due to no content change")
                    packet["target_attempt"] = attempt
                    with self.assertRaises(ValueError):
                        verify(packet)

    def test_release_requires_the_complete_workflow_url(self):
        for suffix in ("42", "/jobs/7", "?attempt=2", "#logs"):
            with self.subTest(suffix=suffix):
                packet = fixture()
                url = packet["workflow"]["html_url"]
                packet["release"]["body"] = packet["release"]["body"].replace(url, url + suffix)
                with self.assertRaises(ValueError):
                    verify(packet)

    def test_release_requires_the_complete_deploy_url(self):
        for suffix in (".attacker.test", ":8443", "/another-deploy", "?preview=1", "#other-deploy"):
            with self.subTest(suffix=suffix):
                packet = fixture()
                url = packet["site_after"]["site"]["published_deploy"]["deploy_ssl_url"]
                packet["release"]["body"] = packet["release"]["body"].replace(url, url + suffix)
                with self.assertRaises(ValueError):
                    verify(packet)

    def test_cli_rejects_provenance_counterexamples(self):
        packets = []
        for kind in ("workflow", "deploy"):
            packet = fixture()
            url = (packet["workflow"]["html_url"] if kind == "workflow"
                   else packet["site_after"]["site"]["published_deploy"]["deploy_ssl_url"])
            suffix = "42" if kind == "workflow" else ".attacker.test"
            packet["release"]["body"] = packet["release"]["body"].replace(url, url + suffix)
            packets.append((kind, packet))
        for site_id in (None, "site-other"):
            packet = fixture()
            packet["release"] = packet["resolved_tag"] = None
            for key in ("site_before", "site_after"):
                packet[key]["site"]["published_deploy"]["commit_ref"] = OTHER
            packet["target_attempt"] = attempt_fixture(state="error", skipped=True)
            del packet["target_attempt"]["site_id"]
            if site_id is not None:
                packet["target_attempt"]["site_id"] = site_id
            packets.append((f"site-{site_id}", packet))
        script = Path(__file__).with_name("verify_deployment_evidence.py")
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "packet.json"
            for case, packet in packets:
                with self.subTest(case=case):
                    path.write_text(json.dumps(packet))
                    result = subprocess.run([sys.executable, str(script), "--packet", str(path)],
                                            text=True, capture_output=True)
                    self.assertEqual(result.returncode, 2, result.stdout + result.stderr)
                    self.assertEqual(result.stdout, "")

    def test_generic_error_or_other_commit_is_not_skip(self):
        for attempt in (attempt_fixture(state="error", error_message="unrelated error"),
                        attempt_fixture(commit_ref=OTHER, state="error", skipped=True)):
            self.assertNotEqual(load_classifier()([attempt], TARGET, "site-123")["decision"], "skipped")

    def run_cli(self, packet):
        script = Path(__file__).with_name("verify_deployment_evidence.py")
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "packet.json"
            path.write_text(json.dumps(packet))
            return subprocess.run([sys.executable, str(script), "--packet", str(path)],
                                  text=True, capture_output=True)

    def test_cli_accepts_exact_target_with_captured_attempt(self):
        packet = fixture()
        packet["target_attempt"] = attempt_fixture()
        result = self.run_cli(packet)
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
        self.assertEqual(result.stderr, "")
        evidence = json.loads(result.stdout)
        self.assertEqual(evidence["classification"], "exact_target")
        self.assertTrue(evidence["provenance_verified"])
        self.assertFalse(evidence["live_behavior_verified"])

    def modern_fixture(self, raw_url="https://main--waffy.netlify.app"):
        packet = fixture()
        immutable_url = f"https://{'a' * 24}--waffy.netlify.app"
        old_url = packet["site_before"]["site"]["published_deploy"]["deploy_ssl_url"]
        packet["release"]["body"] = packet["release"]["body"].replace(old_url, immutable_url)
        for key in ("site_before", "site_after"):
            capture = packet[key]["site"]
            capture["name"] = "waffy"
            capture["published_deploy"].update(id="a" * 24, site_id="site-123",
                                                context="production", deploy_ssl_url=raw_url)
        return packet, immutable_url

    def assert_cli_provenance(self, packet):
        result = self.run_cli(packet)
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
        evidence = json.loads(result.stdout)
        self.assertEqual(evidence["classification"], "exact_target")
        self.assertTrue(evidence["provenance_verified"])
        self.assertFalse(evidence["live_behavior_verified"])
        return evidence

    def assert_cli_invalid(self, packet):
        result = self.run_cli(packet)
        self.assertEqual(result.returncode, 2, result.stdout + result.stderr)
        self.assertEqual(result.stdout, "")
        self.assertIn("Invalid deployment evidence:", result.stderr)

    def test_cli_accepts_canonical_url_and_exact_historical_alias(self):
        for modern in (False, True):
            with self.subTest(modern=modern):
                packet, immutable_url = self.modern_fixture()
                self.assert_cli_provenance(packet)
                alias = "https://main--waffy.netlify.app"
                packet["release"]["body"] = packet["release"]["body"].replace(immutable_url, alias)
                if not modern:
                    for key in ("site_before", "site_after"):
                        del packet[key]["site"]["name"]
                        for field in ("site_id", "context"):
                            del packet[key]["site"]["published_deploy"][field]
                self.assert_cli_provenance(packet)

    def test_cli_canonical_url_supports_missing_or_null_optional_raw_urls(self):
        for raw in ("absent", "null", "ssl-only", "immutable"):
            with self.subTest(raw=raw):
                packet, immutable_url = self.modern_fixture(None)
                for key in ("site_before", "site_after"):
                    deploy = packet[key]["site"]["published_deploy"]
                    if raw == "absent":
                        del deploy["deploy_ssl_url"]
                    elif raw == "ssl-only":
                        deploy["ssl_url"] = "https://waffy.netlify.app"
                    elif raw == "immutable":
                        deploy["deploy_ssl_url"] = immutable_url
                self.assertEqual(self.assert_cli_provenance(packet)["published_after"]["immutable_url"],
                                 immutable_url)

    def test_cli_rejects_altered_canonical_and_historical_url_tokens(self):
        for historical in (False, True):
            for suffix in (".attacker.test", ":443", ":8443", "/", "/other", "?x=1", "#other"):
                with self.subTest(historical=historical, suffix=suffix):
                    packet, immutable_url = self.modern_fixture()
                    url = "https://main--waffy.netlify.app" if historical else immutable_url
                    packet["release"]["body"] = packet["release"]["body"].replace(immutable_url, url + suffix)
                    self.assert_cli_invalid(packet)

    def test_cli_canonical_fallback_cannot_hide_malformed_raw_metadata(self):
        for field in ("deploy_ssl_url", "ssl_url"):
            for raw in ("", {}, 0, "http://waffy.netlify.app", "https://user@waffy.netlify.app",
                        "https://waffy.netlify.app:bad", "https://waffy.netlify.app:443",
                        "https://waffy.netlify.app/other", "https://waffy.netlify.app?x=1",
                        "https://waffy.netlify.app#other", "https://waffy.netlify.app\n"):
                with self.subTest(field=field, raw=raw):
                    packet, _ = self.modern_fixture()
                    for key in ("site_before", "site_after"):
                        packet[key]["site"]["published_deploy"][field] = raw
                    self.assert_cli_invalid(packet)

    def test_cli_canonical_derivation_requires_complete_valid_identity(self):
        for field, value in (("site_id", "wrong-site"), ("site_id", None),
                             ("context", "deploy-preview"), ("context", None),
                             ("id", "unsafe-id"), ("id", "a" * 64),
                             ("skipped", "false"), ("skipped", True),
                             ("commit_ref", "A" * 40), ("state", "building")):
            with self.subTest(field=field, value=value):
                packet, _ = self.modern_fixture()
                for key in ("site_before", "site_after"):
                    packet[key]["site"]["published_deploy"][field] = value
                self.assert_cli_invalid(packet)
        for name in (None, "", "bad.site", "waffy:443", "UPPER", "a" * 64):
            with self.subTest(name=name):
                packet, _ = self.modern_fixture()
                for key in ("site_before", "site_after"):
                    packet[key]["site"]["name"] = name
                self.assert_cli_invalid(packet)
        for field in ("name", "site_id", "context"):
            for raw in (None, "https://main--waffy.netlify.app"):
                with self.subTest(missing=field, raw=raw):
                    packet, _ = self.modern_fixture(raw)
                    for key in ("site_before", "site_after"):
                        capture = packet[key]["site"]
                        del (capture if field == "name" else capture["published_deploy"])[field]
                    self.assert_cli_invalid(packet)

    def test_cli_canonical_identity_mismatch_and_capture_race_do_not_verify(self):
        for field, value in (("id", "b" * 24), ("name", "another-site")):
            for race in (False, True):
                with self.subTest(field=field, race=race):
                    packet, _ = self.modern_fixture()
                    for key in (("site_after",) if race else ("site_before", "site_after")):
                        capture = packet[key]["site"]
                        (capture if field == "name" else capture["published_deploy"])[field] = value
                    if race:
                        result = self.run_cli(packet)
                        self.assertEqual(result.returncode, 1, result.stdout + result.stderr)
                        evidence = json.loads(result.stdout)
                        self.assertEqual(evidence["classification"], "production_changed_during_checks")
                        self.assertFalse(evidence["provenance_verified"])
                    else:
                        self.assert_cli_invalid(packet)

    def test_cli_accepts_both_supported_skip_signals(self):
        for mode in ("explicit", "no content"):
            with self.subTest(mode=mode):
                packet = fixture()
                packet["release"] = packet["resolved_tag"] = None
                for key in ("site_before", "site_after"):
                    packet[key]["site"]["published_deploy"]["commit_ref"] = OTHER
                attempt = attempt_fixture(state="error")
                if mode == "explicit":
                    attempt["skipped"] = True
                else:
                    attempt["error_message"] = "Failed during stage 'checking build content for changes': Canceled build due to no content change"
                packet["target_attempt"] = attempt
                result = self.run_cli(packet)
                self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
                self.assertEqual(result.stderr, "")
                evidence = json.loads(result.stdout)
                self.assertEqual(evidence["classification"], "target_skipped")
                self.assertFalse(evidence["provenance_verified"])
                self.assertFalse(evidence["live_behavior_verified"])
                self.assertEqual(evidence["published_after"]["sha"], OTHER)

    def test_cli_rejects_malformed_captured_attempt_metadata(self):
        for field, value in (("id", None), ("id", "unsafe-id"), ("state", None),
                             ("commit_ref", "abc"), ("context", "deploy-preview"),
                             ("site_id", "site-other"), ("skipped", "true")):
            with self.subTest(field=field, value=value):
                packet = fixture()
                packet["target_attempt"] = attempt_fixture(**{field: value})
                result = self.run_cli(packet)
                self.assertEqual(result.returncode, 2, result.stdout + result.stderr)
                self.assertEqual(result.stdout, "")
                self.assertIn("Invalid deployment evidence:", result.stderr)

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
