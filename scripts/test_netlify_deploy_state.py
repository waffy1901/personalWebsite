#!/usr/bin/env python3
import json
import subprocess
import sys
import unittest
from pathlib import Path


sys.dont_write_bytecode = True

SCRIPTS_DIR = Path(__file__).resolve().parent
CHECKER_PATH = SCRIPTS_DIR / "check_netlify_deploy_state.py"
sys.path.insert(0, str(SCRIPTS_DIR))

import check_netlify_deploy_state as checker  # noqa: E402


EXPECTED_COMMIT = "a" * 40
OTHER_COMMIT = "b" * 40


def deploy(*, commit_ref=EXPECTED_COMMIT, state="building", skipped=False):
    return {
        "commit_ref": commit_ref,
        "state": state,
        "skipped": skipped,
        "deploy_ssl_url": "https://example-deploy.netlify.app",
    }


class NetlifyDeployStateTest(unittest.TestCase):
    def decision(self, payload):
        return checker.classify_deploys(payload, EXPECTED_COMMIT)["decision"]

    def test_exact_skipped_deploy_is_skipped(self):
        self.assertEqual(
            self.decision([deploy(state="error", skipped=True)]),
            "skipped",
        )

    def test_skipped_takes_precedence_over_ready_and_error(self):
        for state in ("ready", "error"):
            with self.subTest(state=state):
                self.assertEqual(
                    self.decision([deploy(state=state, skipped=True)]),
                    "skipped",
                )

    def test_skipped_deploy_for_other_commit_waits(self):
        self.assertEqual(
            self.decision(
                [deploy(commit_ref=OTHER_COMMIT, state="error", skipped=True)]
            ),
            "wait",
        )

    def test_exact_ready_deploy_is_ready(self):
        result = checker.classify_deploys(
            [deploy(state="ready")], EXPECTED_COMMIT
        )

        self.assertEqual(result["decision"], "ready")
        self.assertEqual(result["commit_ref"], EXPECTED_COMMIT)
        self.assertEqual(
            result["deploy_url"], "https://example-deploy.netlify.app"
        )

    def test_exact_terminal_failure_is_failed(self):
        for state in ("error", "rejected"):
            with self.subTest(state=state):
                self.assertEqual(self.decision([deploy(state=state)]), "failed")

    def test_nonterminal_and_unknown_states_wait(self):
        for state in ("processing", "retrying", "future-state"):
            with self.subTest(state=state):
                self.assertEqual(self.decision([deploy(state=state)]), "wait")

    def test_empty_response_waits(self):
        self.assertEqual(self.decision([]), "wait")

    def test_invalid_response_shapes_fail_closed(self):
        invalid_payloads = ({}, ["not-an-object"], [{"skipped": "true"}])

        for payload in invalid_payloads:
            with self.subTest(payload=payload):
                with self.assertRaises(ValueError):
                    checker.classify_deploys(payload, EXPECTED_COMMIT)

    def test_only_newest_deploy_is_considered(self):
        payload = [
            deploy(commit_ref=OTHER_COMMIT, state="ready"),
            deploy(commit_ref=EXPECTED_COMMIT, state="ready"),
        ]

        self.assertEqual(self.decision(payload), "wait")

    def test_cli_rejects_malformed_json_without_echoing_it(self):
        malformed = '{"secret": "do-not-log"'
        result = subprocess.run(
            [
                sys.executable,
                str(CHECKER_PATH),
                "--expected-commit",
                EXPECTED_COMMIT,
            ],
            input=malformed,
            check=False,
            capture_output=True,
            text=True,
        )

        self.assertEqual(result.returncode, 2)
        self.assertIn("Invalid Netlify deploy response", result.stderr)
        self.assertNotIn("do-not-log", result.stderr)
        self.assertEqual(result.stdout, "")

    def test_cli_emits_structured_result(self):
        result = subprocess.run(
            [
                sys.executable,
                str(CHECKER_PATH),
                "--expected-commit",
                EXPECTED_COMMIT,
            ],
            input=json.dumps([deploy(state="ready")]),
            check=False,
            capture_output=True,
            text=True,
        )

        self.assertEqual(result.returncode, 0)
        self.assertEqual(json.loads(result.stdout)["decision"], "ready")
        self.assertEqual(result.stderr, "")


if __name__ == "__main__":
    unittest.main()
