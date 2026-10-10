#!/usr/bin/env python3
"""Require the site's published deployment to identify the selected attempt."""
import argparse
import json
import sys

sys.dont_write_bytecode = True
from check_netlify_deploy_state import (  # noqa: E402
    deploy_id, require_pattern, strict_json, validate_deploy, validate_inputs,
)


def classify_site(site, expected_commit, expected_site, expected_deploy):
    validate_inputs(expected_commit, expected_site)
    deploy_id(expected_deploy)
    if not isinstance(site, dict) or site.get("id") != expected_site:
        raise ValueError("site id does not match expected site")
    name = require_pattern(site.get("name"), r"[a-z0-9]+(?:-[a-z0-9]+)*", "site name")
    label = f"{expected_deploy}--{name}"
    if len(label) > 63:
        raise ValueError("immutable deployment hostname exceeds DNS label limit")
    published = site.get("published_deploy")
    validate_deploy(published, expected_site)
    if published["state"] != "ready" or published.get("skipped") is True:
        raise ValueError("published deployment must be ready and non-skipped")
    matches = (published["id"] == expected_deploy and
               published["commit_ref"] == expected_commit)
    return {"decision": "published" if matches else "wait",
            "deploy_id": expected_deploy,
            "deploy_url": f"https://{label}.netlify.app"}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--expected-commit", required=True)
    parser.add_argument("--expected-site", required=True)
    parser.add_argument("--expected-deploy", required=True)
    parser.add_argument("--require-published", action="store_true")
    parser.add_argument("--expected-url")
    args = parser.parse_args()
    try:
        result = classify_site(strict_json(sys.stdin), args.expected_commit,
                               args.expected_site, args.expected_deploy)
        if args.require_published and result["decision"] != "published":
            raise ValueError("site no longer publishes the selected target deployment")
        if args.expected_url is not None and result["deploy_url"] != args.expected_url:
            raise ValueError("immutable deployment URL changed")
    except (ValueError, UnicodeError) as error:
        print(f"Invalid Netlify published deployment: {error}", file=sys.stderr)
        return 2
    json.dump(result, sys.stdout, sort_keys=True)
    sys.stdout.write("\n")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
