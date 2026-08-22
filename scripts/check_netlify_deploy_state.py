#!/usr/bin/env python3
import argparse
import json
import sys


TERMINAL_FAILURE_STATES = {"error", "rejected"}
NO_CONTENT_CHANGE_ERROR_MESSAGE = (
    "Failed during stage 'checking build content for changes': "
    "Canceled build due to no content change"
)


def _optional_string(deploy, field):
    value = deploy.get(field)
    if value is None:
        return ""
    if not isinstance(value, str):
        raise ValueError(f"latest deploy field {field!r} must be a string or null")
    if "\n" in value or "\r" in value:
        raise ValueError(f"latest deploy field {field!r} must not contain newlines")
    return value


def classify_deploys(deploys, expected_commit):
    if not isinstance(expected_commit, str) or not expected_commit:
        raise ValueError("expected commit must be a nonempty string")
    if not isinstance(deploys, list):
        raise ValueError("Netlify response must be a JSON list")

    if not deploys:
        return {
            "decision": "wait",
            "state": "",
            "commit_ref": "",
            "deploy_url": "",
        }

    deploy = deploys[0]
    if not isinstance(deploy, dict):
        raise ValueError("latest deploy entry must be a JSON object")

    state = _optional_string(deploy, "state")
    commit_ref = _optional_string(deploy, "commit_ref")
    deploy_ssl_url = _optional_string(deploy, "deploy_ssl_url")
    ssl_url = _optional_string(deploy, "ssl_url")
    deploy_url = deploy_ssl_url or ssl_url
    error_message = _optional_string(deploy, "error_message")

    skipped = deploy.get("skipped")
    if skipped is not None and not isinstance(skipped, bool):
        raise ValueError(
            "latest deploy field 'skipped' must be a boolean or null"
        )

    decision = "wait"
    if commit_ref == expected_commit:
        if skipped is True:
            decision = "skipped"
        elif state == "error" and error_message == NO_CONTENT_CHANGE_ERROR_MESSAGE:
            decision = "skipped"
        elif state == "ready":
            decision = "ready"
        elif state in TERMINAL_FAILURE_STATES:
            decision = "failed"

    return {
        "decision": decision,
        "state": state,
        "commit_ref": commit_ref,
        "deploy_url": deploy_url,
    }


def main():
    parser = argparse.ArgumentParser(
        description="Classify the latest Netlify production deploy for a commit."
    )
    parser.add_argument(
        "--expected-commit",
        required=True,
        help="Exact Git commit SHA expected from the newest production deploy.",
    )
    args = parser.parse_args()

    try:
        deploys = json.load(sys.stdin)
        result = classify_deploys(deploys, args.expected_commit)
    except (json.JSONDecodeError, ValueError) as error:
        print(f"Invalid Netlify deploy response: {error}", file=sys.stderr)
        return 2

    json.dump(result, sys.stdout, sort_keys=True)
    sys.stdout.write("\n")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
