#!/usr/bin/env python3
import io
import runpy
import subprocess
import sys
import types
import unittest
from contextlib import redirect_stderr, redirect_stdout
from pathlib import Path
from unittest.mock import patch


REPO_ROOT = Path(__file__).resolve().parents[1]
CHECKER_PATH = REPO_ROOT / "scripts" / "check-deployed-security-headers.py"
CHECKER = types.SimpleNamespace()
CHECKER.__dict__.update(runpy.run_path(str(CHECKER_PATH)))


def curl_response(header_lines):
    lines = ["HTTP/1.1 200 OK", *header_lines, "", "__HTTP_STATUS__:200", ""]
    return "\r\n".join(lines)


class DeployedSecurityHeadersTest(unittest.TestCase):
    def setUp(self):
        self.expected_headers = CHECKER.load_expected_headers(REPO_ROOT)

    def run_checker(self, extra_header_lines=()):
        expected_lines = [
            f"{name}: {value}" for name, value in self.expected_headers.items()
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
            str(REPO_ROOT),
            "--site-url",
            "https://example.test/",
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
