#!/usr/bin/env python3
import importlib.util
import subprocess
import sys
import unittest
from pathlib import Path
from unittest.mock import patch


sys.dont_write_bytecode = True

REPO_ROOT = Path(__file__).resolve().parents[1]
CHECKER_PATH = REPO_ROOT / "scripts" / "check-deployed-artifacts.py"
MODULE_NAME = "deployed_artifacts_checker"
SPEC = importlib.util.spec_from_file_location(MODULE_NAME, CHECKER_PATH)
CHECKER = importlib.util.module_from_spec(SPEC)
sys.modules[MODULE_NAME] = CHECKER
SPEC.loader.exec_module(CHECKER)


def curl_output(
    body,
    *,
    status=200,
    effective_url="https://example.test/artifact.bin",
    redirect_url="",
    content_type="application/octet-stream",
):
    metadata = (
        f"\n{CHECKER.CURL_MARKER}{status}\t{effective_url}\t"
        f"{redirect_url}\t{content_type}"
    ).encode()
    return body + metadata


class DeployedArtifactsTest(unittest.TestCase):
    def validate(
        self,
        *,
        expected=b"expected bytes",
        actual=b"expected bytes",
        status=200,
        effective_url="https://example.test/artifact.bin",
        redirect_url="",
        content_type="application/octet-stream; charset=utf-8",
    ):
        artifact = CHECKER.Artifact("artifact.bin", "application/octet-stream")
        response = CHECKER.HttpResponse(
            status=status,
            effective_url=effective_url,
            redirect_url=redirect_url,
            content_type=content_type,
            body=actual,
        )
        return CHECKER.validate_artifact_response(
            artifact,
            expected,
            response,
            "https://example.test/artifact.bin",
        )

    def test_matching_artifact_passes_with_charset_parameter(self):
        self.assertEqual(self.validate(), [])

    def test_wrong_status_fails(self):
        failures = self.validate(status=404)

        self.assertEqual(len(failures), 1)
        self.assertIn("expected HTTP 200, got 404", failures[0])

    def test_redirect_fails(self):
        failures = self.validate(
            status=301,
            redirect_url="https://example.test/other.bin",
        )

        self.assertEqual(len(failures), 1)
        self.assertIn("redirect target", failures[0])

    def test_content_type_mismatch_fails(self):
        failures = self.validate(content_type="text/html")

        self.assertEqual(len(failures), 1)
        self.assertIn("expected Content-Type", failures[0])

    def test_byte_mismatch_reports_lengths_and_hashes(self):
        failures = self.validate(expected=b"expected", actual=b"deployed")

        self.assertEqual(len(failures), 1)
        self.assertIn("deployed bytes differ", failures[0])
        self.assertIn("sha256", failures[0])

    def test_binary_bytes_are_compared_without_decoding(self):
        binary = bytes(range(256))

        self.assertEqual(self.validate(expected=binary, actual=binary), [])

    def test_fetch_delegates_retry_policy_to_curl(self):
        completed = subprocess.CompletedProcess(
            args=["curl"],
            returncode=0,
            stdout=curl_output(b"ok"),
            stderr=b"",
        )

        with patch.object(CHECKER.subprocess, "run", return_value=completed) as run:
            result = CHECKER.fetch(
                "https://example.test/artifact.bin",
                timeout=10,
                retries=1,
                retry_delay=2,
            )

        self.assertEqual(result.status, 200)
        self.assertEqual(result.body, b"ok")
        command = run.call_args.args[0]
        self.assertEqual(command[command.index("--retry") + 1], "1")
        self.assertEqual(command[command.index("--retry-delay") + 1], "2")
        self.assertEqual(command[command.index("--max-redirs") + 1], "0")


if __name__ == "__main__":
    unittest.main()
