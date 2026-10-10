#!/usr/bin/env python3
import io
import subprocess
import sys
import unittest
from pathlib import Path

sys.dont_write_bytecode = True
import check_netlify_published_deploy as checker  # noqa: E402
from check_netlify_deploy_state import strict_json  # noqa: E402

COMMIT = "a" * 40
SITE = "synthetic-site-id"
DEPLOY = "a" * 24
OTHER = "b" * 24
URL = f"https://{DEPLOY}--portfolio.netlify.app"


def deployment(**fields):
    return {"id": DEPLOY, "site_id": SITE, "commit_ref": COMMIT,
            "state": "ready", "context": "production", "skipped": False, **fields}


def site(**fields):
    return {"id": SITE, "name": "portfolio", "published_deploy": deployment(), **fields}


class PublishedDeployTest(unittest.TestCase):
    def classify(self, response):
        return checker.classify_site(response, COMMIT, SITE, DEPLOY)

    def test_exact_published_identity_emits_constructed_immutable_url(self):
        result = self.classify(site())
        self.assertEqual(result, {"decision": "published", "deploy_id": DEPLOY,
                                  "deploy_url": URL})

    def test_provider_alias_url_is_never_trusted_as_immutable_evidence(self):
        for alias in (None, "https://main--portfolio.netlify.app", "http://evil.invalid",
                      "https://bad\ninjected=true", {}, ""):
            self.assertEqual(self.classify(site(published_deploy=deployment(
                deploy_ssl_url=alias, ssl_url=alias)))["deploy_url"], URL)

    def test_valid_different_id_or_sha_waits(self):
        for fields in ({"id": OTHER}, {"commit_ref": "b" * 40},
                       {"id": OTHER, "commit_ref": "b" * 40}):
            self.assertEqual(self.classify(site(published_deploy=deployment(**fields)))[
                "decision"], "wait")

    def test_site_identity_and_url_construction_fail_closed(self):
        for field, values in {
            "id": (None, "other-site", SITE + "\n"),
            "name": (None, "", "UPPER", "a.b", "-site", "site-", "x" * 64,
                     "site\ninjected=true", "site/path", "site:80", "síté"),
            "published_deploy": (None, [], 1, "ready"),
        }.items():
            for value in values:
                with self.subTest(field=field, value=value):
                    with self.assertRaises(ValueError):
                        self.classify(site(**{field: value}))
            missing = site()
            del missing[field]
            with self.assertRaises(ValueError):
                self.classify(missing)
        for invalid in (None, [], "site"):
            with self.assertRaises(ValueError):
                self.classify(invalid)

    def test_published_metadata_fails_closed(self):
        for field, values in {
            "id": (None, "", "bad/id", "a\ninjected=true", "a" * 64),
            "site_id": (None, "other-site"),
            "commit_ref": (None, "", "A" * 40, "a" * 39, COMMIT + "\n"),
            "state": (None, "", "building", "error", "ready\n"),
            "context": (None, "deploy-preview"),
            "skipped": (True, "false", 0, []),
        }.items():
            for value in values:
                with self.subTest(field=field, value=value):
                    with self.assertRaises(ValueError):
                        self.classify(site(published_deploy=deployment(**{field: value})))
            if field != "skipped":
                missing = deployment()
                del missing[field]
                with self.assertRaises(ValueError):
                    self.classify(site(published_deploy=missing))

    def test_missing_and_null_skipped_are_non_skipped(self):
        published = deployment()
        del published["skipped"]
        self.assertEqual(self.classify(site(published_deploy=published))["decision"], "published")
        published["skipped"] = None
        self.assertEqual(self.classify(site(published_deploy=published))["decision"], "published")

    def test_malformed_json_rejected(self):
        for data in ('', '{', '{"id":1,"id":2}', '{"id":NaN}', '{"id":Infinity}'):
            with self.assertRaises(ValueError):
                strict_json(io.StringIO(data))

    def test_expected_identity_must_be_safe(self):
        for sha, site_id, deploy_id in (("short", SITE, DEPLOY),
                                      (COMMIT, "site/path", DEPLOY),
                                      (COMMIT, SITE, "bad\nid")):
            with self.assertRaises(ValueError):
                checker.classify_site(site(), sha, site_id, deploy_id)

    def test_cli_rejects_without_echoing_response(self):
        result = subprocess.run([sys.executable, str(Path(checker.__file__)),
                                 "--expected-commit", COMMIT, "--expected-site", SITE,
                                 "--expected-deploy", DEPLOY],
                                input='{"private":"do-not-disclose"', text=True,
                                capture_output=True, check=False)
        self.assertEqual(result.returncode, 2)
        self.assertEqual(result.stdout, "")
        self.assertNotIn("do-not-disclose", result.stderr)


if __name__ == "__main__":
    unittest.main()
