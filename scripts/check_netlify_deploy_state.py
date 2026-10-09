#!/usr/bin/env python3
"""Classify a validated exact-target attempt; readiness is not publication."""
import argparse
import json
import re
import sys


TERMINAL_FAILURE_STATES = {"error", "rejected"}
NO_CONTENT_CHANGE_ERROR_MESSAGE = (
    "Failed during stage 'checking build content for changes': "
    "Canceled build due to no content change"
)


def require_pattern(value, pattern, field):
    if not isinstance(value, str) or re.fullmatch(pattern, value) is None:
        raise ValueError(f"{field} is missing or unsafe")
    return value


def validate_inputs(expected_commit, expected_site):
    require_pattern(expected_commit, r"[0-9a-f]{40}", "expected commit")
    require_pattern(expected_site, r"[a-z0-9]+(?:-[a-z0-9]+)*", "expected site")


def deploy_id(value):
    return require_pattern(value, r"[a-z0-9]{1,63}", "deployment id")


def _optional_string(deploy, field):
    value = deploy.get(field)
    if value is None:
        return ""
    if not isinstance(value, str):
        raise ValueError(f"deploy field {field!r} must be a string or null")
    if any(ord(char) < 32 or ord(char) == 127 for char in value):
        raise ValueError(f"deploy field {field!r} must not contain control characters")
    return value


def validate_deploy(deploy, expected_site):
    if not isinstance(deploy, dict):
        raise ValueError("deploy must be a JSON object")
    if deploy.get("site_id") != expected_site:
        raise ValueError("deploy site_id does not match expected site")
    deploy_id(deploy.get("id"))
    require_pattern(deploy.get("commit_ref"), r"[0-9a-f]{40}", "deploy commit_ref")
    require_pattern(deploy.get("state"), r"[a-z][a-z0-9_-]*", "deploy state")
    if deploy.get("context") != "production":
        raise ValueError("deploy context must be production")
    _optional_string(deploy, "error_message")
    skipped = deploy.get("skipped")
    if skipped is not None and not isinstance(skipped, bool):
        raise ValueError("deploy field 'skipped' must be a boolean or null")


def strict_json(stream):
    def pairs(items):
        result = {}
        for key, value in items:
            if key in result:
                raise ValueError("duplicate JSON object member")
            result[key] = value
        return result

    def invalid_constant(_value):
        raise ValueError("invalid JSON constant")

    return json.load(stream, object_pairs_hook=pairs, parse_constant=invalid_constant)


def classify_deploys(deploys, expected_commit, expected_site, selected_id=""):
    validate_inputs(expected_commit, expected_site)
    if selected_id:
        deploy_id(selected_id)
        if not isinstance(deploys, dict) or deploys.get("id") != selected_id:
            raise ValueError("selected deployment identity changed")
        candidates = [deploys]
    else:
        if not isinstance(deploys, list):
            raise ValueError("Netlify response must be a JSON list")
        candidates = deploys

    result = {"decision": "wait", "state": "", "commit_ref": "", "deploy_id": ""}
    for deploy in candidates:
        validate_deploy(deploy, expected_site)
        if deploy["commit_ref"] != expected_commit:
            if selected_id:
                raise ValueError("selected deployment commit changed")
            continue
        decision = "wait"
        if deploy.get("skipped") is True:
            decision = "skipped"
        elif (deploy["state"] == "error" and
              deploy.get("error_message") == NO_CONTENT_CHANGE_ERROR_MESSAGE):
            decision = "skipped"
        elif deploy["state"] == "ready":
            decision = "ready"
        elif deploy["state"] in TERMINAL_FAILURE_STATES:
            decision = "failed"
        return {"decision": decision, "state": deploy["state"],
                "commit_ref": deploy["commit_ref"], "deploy_id": deploy["id"]}
    return result


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--expected-commit", required=True)
    parser.add_argument("--expected-site", required=True)
    parser.add_argument("--selected-deploy-id", default="")
    args = parser.parse_args()
    try:
        result = classify_deploys(strict_json(sys.stdin), args.expected_commit,
                                  args.expected_site, args.selected_deploy_id)
    except (ValueError, UnicodeError) as error:
        print(f"Invalid Netlify deploy response: {error}", file=sys.stderr)
        return 2
    json.dump(result, sys.stdout, sort_keys=True)
    sys.stdout.write("\n")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
