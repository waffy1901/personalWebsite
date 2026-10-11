#!/usr/bin/env python3
import io
import runpy
import subprocess
import sys
import tempfile
import types
import unittest
from contextlib import redirect_stderr, redirect_stdout
from pathlib import Path
from unittest.mock import patch


REPO_ROOT = Path(__file__).resolve().parents[1]
CHECKER_PATH = REPO_ROOT / "scripts" / "check-deployed-security-headers.py"
CHECKER = types.SimpleNamespace()
CHECKER.__dict__.update(runpy.run_path(str(CHECKER_PATH)))
IMMUTABLE_URL = "https://6acaa4319dcb990008176716--waffy.netlify.app"
HSTS_HEADER = "Strict-Transport-Security"
CONFIGURED_HSTS = "max-age=31536000; includeSubDomains"
NETLIFY_HSTS = CONFIGURED_HSTS + "; preload"


def curl_response(header_lines):
    lines = ["HTTP/1.1 200 OK", *header_lines, "", "__HTTP_STATUS__:200", ""]
    return "\r\n".join(lines)


class DeployedSecurityHeadersTest(unittest.TestCase):
    def setUp(self):
        self.expected_headers = CHECKER.load_expected_headers(REPO_ROOT)

    def run_checker(
        self, extra_header_lines=(), *, site_url="https://example.test/",
        actual_headers=None, repo_root=REPO_ROOT,
    ):
        headers = self.expected_headers if actual_headers is None else actual_headers
        expected_lines = [
            f"{name}: {value}" for name, value in headers.items()
        ]
        result = subprocess.CompletedProcess(
            args=["curl"],
            returncode=0,
            stdout=curl_response([*extra_header_lines, *expected_lines]),
            stderr="",
        )
        stdout = io.StringIO()
        stderr = io.StringIO()
        argv = [
            "check-deployed-security-headers.py",
            "--repo",
            str(repo_root),
            "--site-url",
            site_url,
            "--retries",
            "0",
        ]

        with (
            patch.object(CHECKER.subprocess, "run", return_value=result),
            patch.object(sys, "argv", argv),
            redirect_stdout(stdout),
            redirect_stderr(stderr),
        ):
            return_code = CHECKER.main()

        return return_code, stdout.getvalue(), stderr.getvalue()

    def test_observed_immutable_netlify_hsts_passes(self):
        headers = {**self.expected_headers, HSTS_HEADER: NETLIFY_HSTS}
        for site_url in (IMMUTABLE_URL, IMMUTABLE_URL + "/"):
            with self.subTest(site_url=site_url):
                return_code, stdout, stderr = self.run_checker(
                    site_url=site_url, actual_headers=headers,
                )
                self.assertEqual(return_code, 0, stderr)
                self.assertIn("immutable Netlify HSTS preload allowance", stdout)
                self.assertEqual(stderr, "")

    def test_configured_hsts_passes_without_allowance(self):
        for site_url in (IMMUTABLE_URL, "https://waffy.dev/",
                         "https://main--waffy.netlify.app/"):
            with self.subTest(site_url=site_url):
                return_code, stdout, stderr = self.run_checker(site_url=site_url)
                self.assertEqual(return_code, 0, stderr)
                self.assertIn("match netlify.toml", stdout)
                self.assertNotIn("allowance", stdout)

    def test_valid_immutable_dns_label_boundary(self):
        # 24 deploy characters + two hyphens + 37 site characters = 63.
        for site in ("a", "waffy-1901", "a" * 37):
            with self.subTest(site=site):
                return_code, stdout, stderr = self.run_checker(
                    site_url=f"https://6acaa4319dcb990008176716--{site}.netlify.app",
                    actual_headers={**self.expected_headers, HSTS_HEADER: NETLIFY_HSTS},
                )
                self.assertEqual(return_code, 0, stderr)
                self.assertIn("allowance", stdout)

    def test_preload_fails_outside_exact_immutable_url_class(self):
        invalid_urls = (
            "https://waffy.dev/",
            "https://waffy.netlify.app/",
            "https://main--waffy.netlify.app/",
            "https://deploy-preview-259--waffy.netlify.app/",
            IMMUTABLE_URL.replace("https://", "http://"),
            IMMUTABLE_URL.replace("https://", "HTTPS://"),
            IMMUTABLE_URL.replace("6acaa", "6ACAA"),
            IMMUTABLE_URL.replace("waffy", "Waffy"),
            IMMUTABLE_URL.replace("netlify.app", "NETLIFY.APP"),
            IMMUTABLE_URL.replace("6acaa4319dcb990008176716", "6acaa4319dcb99000817671"),
            IMMUTABLE_URL.replace("6acaa4319dcb990008176716", "6acaa4319dcb9900081767160"),
            IMMUTABLE_URL.replace("6acaa", "gacaa"),
            IMMUTABLE_URL.replace("waffy", ""),
            IMMUTABLE_URL.replace("waffy", "-waffy"),
            IMMUTABLE_URL.replace("waffy", "waffy-"),
            IMMUTABLE_URL.replace("waffy", "waffy--site"),
            IMMUTABLE_URL.replace("waffy", "waffy_site"),
            IMMUTABLE_URL.replace("waffy", "a" * 38),
            IMMUTABLE_URL.replace("waffy", "%77affy"),
            IMMUTABLE_URL.replace("https://", "https://user@"),
            IMMUTABLE_URL.replace("https://", "https://user:password@"),
            IMMUTABLE_URL + ":443",
            IMMUTABLE_URL + ".",
            IMMUTABLE_URL + ".evil.test",
            IMMUTABLE_URL + "@evil.test",
            IMMUTABLE_URL + "/path",
            IMMUTABLE_URL + "//",
            IMMUTABLE_URL + "/%2f",
            IMMUTABLE_URL + "?query=1",
            IMMUTABLE_URL + "/?query=1",
            IMMUTABLE_URL + "#fragment",
            IMMUTABLE_URL + "/#fragment",
            " " + IMMUTABLE_URL,
            IMMUTABLE_URL + " ",
            IMMUTABLE_URL + "\n",
        )
        for site_url in invalid_urls:
            with self.subTest(site_url=site_url):
                return_code, stdout, stderr = self.run_checker(
                    site_url=site_url,
                    actual_headers={**self.expected_headers, HSTS_HEADER: NETLIFY_HSTS},
                )
                self.assertEqual(return_code, 1)
                self.assertEqual(stdout, "")
                self.assertIn(f"Unexpected {HSTS_HEADER} header", stderr)

    def test_immutable_hsts_still_rejects_missing_weaker_or_unexpected_values(self):
        invalid_values = (
            None, "max-age=300; includeSubDomains; preload",
            "max-age=31536000; preload", "preload", "",
            CONFIGURED_HSTS + "; PRELOAD",
            CONFIGURED_HSTS + ";preload",
            NETLIFY_HSTS + "; preload",
            NETLIFY_HSTS + "; unexpected",
            "max-age=31536000; preload; includeSubDomains",
        )
        for value in invalid_values:
            with self.subTest(value=value):
                headers = dict(self.expected_headers)
                if value is None:
                    del headers[HSTS_HEADER]
                else:
                    headers[HSTS_HEADER] = value
                return_code, stdout, stderr = self.run_checker(
                    site_url=IMMUTABLE_URL, actual_headers=headers,
                )
                self.assertEqual(return_code, 1)
                self.assertEqual(stdout, "")
                self.assertIn(f"Unexpected {HSTS_HEADER} header", stderr)

    def test_immutable_hsts_rejects_duplicate_values(self):
        for first, second in (
            (CONFIGURED_HSTS, CONFIGURED_HSTS),
            (CONFIGURED_HSTS, NETLIFY_HSTS),
            (NETLIFY_HSTS, CONFIGURED_HSTS),
            (NETLIFY_HSTS, NETLIFY_HSTS),
        ):
            with self.subTest(first=first, second=second):
                return_code, stdout, stderr = self.run_checker(
                    (f"{HSTS_HEADER}: {first}",), site_url=IMMUTABLE_URL,
                    actual_headers={**self.expected_headers, HSTS_HEADER: second},
                )
                self.assertEqual(return_code, 1)
                self.assertEqual(stdout, "")
                self.assertIn("Actual (2 value(s))", stderr)

    def test_preload_allowance_does_not_hide_other_header_drift(self):
        for name, value in self.expected_headers.items():
            if name == HSTS_HEADER:
                continue
            for actual_value in (None, value + " unexpected"):
                with self.subTest(header=name, actual_value=actual_value):
                    headers = {**self.expected_headers, HSTS_HEADER: NETLIFY_HSTS}
                    if actual_value is None:
                        del headers[name]
                    else:
                        headers[name] = actual_value
                    return_code, stdout, stderr = self.run_checker(
                        site_url=IMMUTABLE_URL, actual_headers=headers,
                    )
                    self.assertEqual(return_code, 1)
                    self.assertEqual(stdout, "")
                    self.assertIn(f"Unexpected {name} header", stderr)

    def test_preload_allowance_preserves_independent_configured_baseline(self):
        replacements = (
            (CONFIGURED_HSTS, "max-age=300; includeSubDomains"),
            (CONFIGURED_HSTS, NETLIFY_HSTS),
            ("form-action 'self' https://formspree.io", "form-action 'self' *"),
            ('X-Content-Type-Options = "nosniff"', 'X-Content-Type-Options = "unsafe"'),
        )
        for old, new in replacements:
            with self.subTest(replacement=new), tempfile.TemporaryDirectory() as tmp:
                root = Path(tmp)
                (root / "netlify.toml").write_text(
                    (REPO_ROOT / "netlify.toml").read_text().replace(old, new),
                    encoding="utf-8",
                )
                # Matching configured/deployed drift must still fail the baseline.
                headers = CHECKER.load_expected_headers(root)
                headers[HSTS_HEADER] += "; preload"
                return_code, stdout, stderr = self.run_checker(
                    site_url=IMMUTABLE_URL, actual_headers=headers, repo_root=root,
                )
                self.assertEqual(return_code, 1)
                self.assertEqual(stdout, "")
                self.assertIn("does not meet the required baseline", stderr)

    def test_matching_headers_pass(self):
        return_code, stdout, stderr = self.run_checker()

        self.assertEqual(return_code, 0)
        self.assertIn("match netlify.toml", stdout)
        self.assertEqual(stderr, "")

    def test_minimum_policy_rejects_permissive_csp_tokens(self):
        headers = dict(self.expected_headers)
        headers["Content-Security-Policy"] = headers["Content-Security-Policy"].replace(
            "form-action 'self' https://formspree.io",
            "form-action 'self' * https://formspree.io",
        )

        failures = CHECKER.validate_minimum_policy(headers)

        self.assertIn(
            "Content-Security-Policy form-action contains unexpected token '*'.",
            failures,
        )

    def test_minimum_policy_rejects_duplicate_csp_directives(self):
        headers = dict(self.expected_headers)
        headers["Content-Security-Policy"] = (
            "script-src *; " + headers["Content-Security-Policy"]
        )

        failures = CHECKER.validate_minimum_policy(headers)

        self.assertIn(
            "Content-Security-Policy contains duplicate script-src directives.",
            failures,
        )
        self.assertIn(
            "Content-Security-Policy script-src is missing required token \"'self'\".",
            failures,
        )

    def test_minimum_policy_rejects_unexpected_csp_directives(self):
        headers = dict(self.expected_headers)
        headers["Content-Security-Policy"] += "; worker-src *"

        failures = CHECKER.validate_minimum_policy(headers)

        self.assertIn(
            "Content-Security-Policy contains unexpected directive worker-src.",
            failures,
        )

    def test_duplicate_expected_headers_fail(self):
        for header_name, expected_value in self.expected_headers.items():
            duplicate_value = (
                "default-src 'none'"
                if header_name.lower() == "content-security-policy"
                else expected_value
            )

            with self.subTest(header=header_name):
                return_code, stdout, stderr = self.run_checker(
                    (f"{header_name}: {duplicate_value}",)
                )

                self.assertEqual(return_code, 1)
                self.assertEqual(stdout, "")
                self.assertIn(f"Unexpected {header_name} header", stderr)
                self.assertIn("Actual (2 value(s))", stderr)

    def test_duplicate_unrelated_header_is_ignored(self):
        return_code, stdout, stderr = self.run_checker(
            ("Set-Cookie: first=value", "Set-Cookie: second=value")
        )

        self.assertEqual(return_code, 0)
        self.assertIn("match netlify.toml", stdout)
        self.assertEqual(stderr, "")


if __name__ == "__main__":
    unittest.main()
