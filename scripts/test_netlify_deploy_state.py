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
MISSING = object()


def deploy(
    *,
    commit_ref=EXPECTED_COMMIT,
    state="building",
    skipped=MISSING,
    error_message=MISSING,
):
    payload = {
        "commit_ref": commit_ref,
        "state": state,
        "deploy_ssl_url": "https://example-deploy.netlify.app",
    }
    if skipped is not MISSING:
        payload["skipped"] = skipped
    if error_message is not MISSING:
        payload["error_message"] = error_message
    return payload


class NetlifyDeployStateTest(unittest.TestCase):
    def decision(self, payload):
        return checker.classify_deploys(payload, EXPECTED_COMMIT)["decision"]

    def test_no_content_message_matches_netlify_signal(self):
        self.assertEqual(
            checker.NO_CONTENT_CHANGE_ERROR_MESSAGE,
            "Failed during stage 'checking build content for changes': "
            "Canceled build due to no content change",
        )

    def test_missing_false_and_null_skipped_values_allow_ready(self):
        for skipped in (MISSING, False, None):
            with self.subTest(skipped=skipped):
                self.assertEqual(
                    self.decision([deploy(state="ready", skipped=skipped)]),
                    "ready",
                )

    def test_true_skipped_value_is_skipped(self):
        self.assertEqual(self.decision([deploy(skipped=True)]), "skipped")

    def test_skipped_takes_precedence_over_ready_and_error(self):
        for state in ("ready", "error"):
            with self.subTest(state=state):
                self.assertEqual(
                    self.decision([deploy(state=state, skipped=True)]),
                    "skipped",
                )

    def test_no_content_error_with_null_skipped_value_is_skipped(self):
        result = checker.classify_deploys(
            [
                deploy(
                    state="error",
                    skipped=None,
                    error_message=checker.NO_CONTENT_CHANGE_ERROR_MESSAGE,
                )
            ],
            EXPECTED_COMMIT,
        )

        self.assertEqual(result["decision"], "skipped")
        self.assertNotIn("error_message", result)

    def test_genuine_error_with_null_skipped_value_is_failed(self):
        self.assertEqual(
            self.decision(
                [
                    deploy(
                        state="error",
                        skipped=None,
                        error_message="Build command failed",
                    )
                ]
            ),
            "failed",
        )

    def test_no_content_error_message_requires_exact_match(self):
        exact = checker.NO_CONTENT_CHANGE_ERROR_MESSAGE
        altered_messages = (
            exact.lower(),
            f"{exact} ",
            exact.replace("no content change", "no changed content"),
        )

        for error_message in altered_messages:
            with self.subTest(error_message=error_message):
                self.assertEqual(
                    self.decision(
                        [
                            deploy(
                                state="error",
                                skipped=None,
                                error_message=error_message,
                            )
                        ]
                    ),
                    "failed",
                )

    def test_rejected_is_failed_even_with_no_content_message(self):
        self.assertEqual(
            self.decision(
                [
                    deploy(
                        state="rejected",
                        skipped=None,
                        error_message=checker.NO_CONTENT_CHANGE_ERROR_MESSAGE,
                    )
                ]
            ),
            "failed",
        )

    def test_skipped_and_no_content_signals_for_other_commit_wait(self):
        cases = (
            deploy(commit_ref=OTHER_COMMIT, state="error", skipped=True),
            deploy(
                commit_ref=OTHER_COMMIT,
                state="error",
                skipped=None,
                error_message=checker.NO_CONTENT_CHANGE_ERROR_MESSAGE,
            ),
        )

        for payload in cases:
            with self.subTest(payload=payload):
                self.assertEqual(self.decision([payload]), "wait")

    def test_no_content_message_only_overrides_the_error_state(self):
        self.assertEqual(
            self.decision(
                [
                    deploy(
                        state="ready",
                        skipped=None,
                        error_message=checker.NO_CONTENT_CHANGE_ERROR_MESSAGE,
                    )
                ]
            ),
            "ready",
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

    def test_nonterminal_and_unknown_states_wait(self):
        for state in ("processing", "retrying", "future-state"):
            with self.subTest(state=state):
                self.assertEqual(self.decision([deploy(state=state)]), "wait")

    def test_empty_response_waits(self):
        self.assertEqual(self.decision([]), "wait")

    def test_invalid_response_shapes_fail_closed(self):
        invalid_payloads = ({}, ["not-an-object"])

        for payload in invalid_payloads:
            with self.subTest(payload=payload):
                with self.assertRaises(ValueError):
                    checker.classify_deploys(payload, EXPECTED_COMMIT)

    def test_invalid_skipped_types_fail_closed(self):
        for skipped in ("true", 1, 0.0, [], {}):
            with self.subTest(skipped=skipped):
                with self.assertRaisesRegex(ValueError, "'skipped'"):
                    checker.classify_deploys(
                        [deploy(state="ready", skipped=skipped)], EXPECTED_COMMIT
                    )

    def test_invalid_error_message_types_and_newlines_fail_closed(self):
        invalid_messages = (
            True,
            1,
            [],
            {},
            "line one\nline two",
            "line one\rline two",
        )

        for error_message in invalid_messages:
            with self.subTest(error_message=error_message):
                with self.assertRaisesRegex(ValueError, "'error_message'"):
                    checker.classify_deploys(
                        [
                            deploy(
                                state="error",
                                skipped=None,
                                error_message=error_message,
                            )
                        ],
                        EXPECTED_COMMIT,
                    )

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
