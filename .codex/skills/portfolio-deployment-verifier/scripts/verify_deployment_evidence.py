#!/usr/bin/env python3
"""Verify captured deployment provenance; never fetch or mutate providers."""
import argparse
from datetime import datetime
import importlib.util
import json
from pathlib import Path
import re
import sys
from urllib.parse import urlsplit

REPOSITORY = "waffy1901/personalWebsite"
WORKFLOW = ".github/workflows/release-on-deploy.yml"
SHA = re.compile(r"[0-9a-f]{40}")


def load_deploy_helpers():
    source = Path(__file__).resolve().parents[4] / "scripts/check_netlify_deploy_state.py"
    spec = importlib.util.spec_from_file_location("portfolio_deploy_classifier", source)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def load_classifier():
    return load_deploy_helpers().classify_deploys


def timestamp(value):
    if not isinstance(value, str):
        raise ValueError("capture timestamps must be strings")
    parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    if parsed.tzinfo is None:
        raise ValueError("capture timestamps require a UTC offset")
    return parsed


def https_url(value):
    if not isinstance(value, str) or any(char.isspace() or ord(char) < 32 or ord(char) == 127 for char in value) or "\\" in value:
        raise ValueError("deploy URL must be a safe HTTPS URL")
    parsed = urlsplit(value)
    if parsed.scheme != "https" or not parsed.hostname or parsed.username is not None or parsed.password is not None:
        raise ValueError("deploy URL must use HTTPS without credentials")
    if (parsed.port is not None or value != f"https://{parsed.netloc}"
            or not re.fullmatch(r"[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?)*", parsed.netloc)):
        raise ValueError("deploy URL must be an HTTPS hostname without port, path, query, or fragment")
    return value


def published(snapshot, site_id):
    if not isinstance(snapshot, dict) or not isinstance(snapshot.get("site"), dict):
        raise ValueError("each capture requires a site object and captured_at")
    timestamp(snapshot.get("captured_at"))
    site = snapshot["site"]
    if site.get("id") != site_id:
        raise ValueError("site capture does not match the expected site id")
    deploy = site.get("published_deploy")
    if not isinstance(deploy, dict):
        raise ValueError("site published_deploy is missing or malformed")
    if deploy.get("state") != "ready" or deploy.get("skipped") is True:
        raise ValueError("published_deploy is not ready")
    if not isinstance(deploy.get("commit_ref"), str) or not SHA.fullmatch(deploy["commit_ref"]):
        raise ValueError("published commit_ref must be an exact lowercase SHA")
    if not isinstance(deploy.get("id"), str) or not re.fullmatch(r"[A-Za-z0-9_-]+", deploy["id"]):
        raise ValueError("published deploy id is missing or unsafe")
    # Historical captures can lack these fields; present contradictory metadata
    # must never fall back to the legacy raw-link compatibility path.
    for field, expected in (("site_id", site_id), ("context", "production")):
        if field in deploy and deploy[field] != expected:
            raise ValueError(f"published deploy {field} does not match the expected identity")
    if deploy.get("skipped") is not None and not isinstance(deploy["skipped"], bool):
        raise ValueError("published skipped must be a boolean or null")
    helpers = load_deploy_helpers()
    if "name" in site:
        helpers.require_pattern(site["name"], r"[a-z0-9]+(?:-[a-z0-9]+)*", "site name")
    immutable_url = None
    if "name" in site and "site_id" in deploy and "context" in deploy:
        helpers.validate_inputs(deploy["commit_ref"], site_id)
        helpers.validate_deploy(deploy, site_id)
        label = f"{deploy['id']}--{site['name']}"
        if len(label) > 63:
            raise ValueError("immutable deployment hostname exceeds DNS label limit")
        immutable_url = f"https://{label}.netlify.app"
    # Validate both supplied URL fields, including an unused fallback. Missing
    # optional URLs are supported by the producer when identity is complete.
    urls = [https_url(deploy[field]) for field in ("deploy_ssl_url", "ssl_url")
            if field in deploy and deploy[field] is not None]
    if not urls and immutable_url is None:
        raise ValueError("published deploy requires a URL or complete immutable identity")
    result = {"id": deploy["id"], "sha": deploy["commit_ref"],
              "url": urls[0] if urls else immutable_url}
    if immutable_url is not None:
        result["immutable_url"] = immutable_url
    return result


def verify(packet):
    if not isinstance(packet, dict):
        raise ValueError("evidence packet must be an object")
    target = packet.get("target_sha")
    if not isinstance(target, str) or not SHA.fullmatch(target):
        raise ValueError("target_sha must be an exact lowercase 40-character SHA")
    site_id = packet.get("site_id")
    if not isinstance(site_id, str) or not site_id:
        raise ValueError("expected site_id is required")
    before = published(packet.get("site_before"), site_id)
    after = published(packet.get("site_after"), site_id)
    if timestamp(packet["site_after"]["captured_at"]) < timestamp(packet["site_before"]["captured_at"]):
        raise ValueError("final site read precedes the initial read")
    run = packet.get("workflow")
    if not isinstance(run, dict) or type(run.get("id")) is not int or type(run.get("run_attempt")) is not int or run["run_attempt"] < 1:
        raise ValueError("workflow run and attempt identity are required")
    run_url = f"https://github.com/{REPOSITORY}/actions/runs/{run['id']}"
    if (run.get("head_sha") != target or run.get("path", "").split("@", 1)[0] != WORKFLOW
            or run.get("head_branch") != "main" or run.get("event") not in ("push", "workflow_dispatch")
            or run.get("html_url") != run_url or run.get("repository", {}).get("full_name") != REPOSITORY):
        raise ValueError("workflow repository/path/event/ref/SHA does not match the target")
    workflow_success = run.get("status") == "completed" and run.get("conclusion") == "success"
    gaps = [] if workflow_success else ["exact deployment workflow has not succeeded"]
    result = {"target_sha": target, "published_before": before, "published_after": after,
              "capture_times": [packet["site_before"]["captured_at"], packet["site_after"]["captured_at"]],
              "workflow_url": run_url, "run_attempt": run["run_attempt"],
              "workflow_success": workflow_success, "provenance_verified": False,
              "live_behavior_verified": False, "gaps": gaps}
    attempt = packet.get("target_attempt")
    skipped = False
    if attempt is not None:
        if not isinstance(attempt, dict) or attempt.get("context") != "production":
            raise ValueError("target_attempt must be a captured production deploy")
        if attempt.get("site_id") != site_id:
            raise ValueError("target_attempt does not match the expected site id")
        skipped = load_classifier()([attempt], target, site_id)["decision"] == "skipped"
    if before != after:
        result["classification"] = "production_changed_during_checks"
        gaps.append("published deployment changed; observations cannot be bound to one deployment instance")
        return result
    if skipped:
        if after["sha"] == target or packet.get("release") is not None:
            raise ValueError("skipped target conflicts with a published target or supplied deploy release")
        result["classification"] = "target_skipped"
        gaps.append("target has source/CI evidence only; no target production deployment was verified")
        return result
    if after["sha"] != target:
        result["classification"] = "different_commit"
        ancestry = packet.get("ancestry")
        if ancestry == {"ancestor": target, "descendant": after["sha"], "is_ancestor": True}:
            result["classification"] = "production_advanced"
        gaps.append("requested commit is not the published deployment")
        return result
    result["classification"] = "exact_target"
    release, tag = packet.get("release"), packet.get("resolved_tag")
    if release is None or tag is None:
        gaps.append("matching deployment release and independently resolved tag are required")
        return result
    if not isinstance(release, dict) or not isinstance(tag, dict):
        raise ValueError("release and resolved_tag must be objects")
    tag_name = release.get("tag_name")
    if (not isinstance(tag_name, str) or not re.fullmatch(r"deploy-[0-9]{8}T[0-9]{6}Z-" + target[:7], tag_name)
            or release.get("draft") is not False or release.get("prerelease") is not False
            or release.get("html_url") != f"https://github.com/{REPOSITORY}/releases/tag/{tag_name}"
            or tag.get("tag_name") != tag_name or tag.get("commit_sha") != target):
        raise ValueError("deployment release/tag does not resolve to the exact target")
    body = release.get("body")
    deploy_urls = {after["url"], after.get("immutable_url")} - {None}
    if (not isinstance(body, str) or target not in body or run_url not in body.split()
            or not deploy_urls.intersection(body.split())):
        raise ValueError("release body does not link the exact commit, workflow, and published deploy URL")
    result["release_url"] = release["html_url"]
    result["resolved_tag"] = tag
    result["provenance_verified"] = workflow_success
    return result


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--packet", required=True, type=Path)
    args = parser.parse_args()
    try:
        result = verify(json.loads(args.packet.read_text()))
    except (ValueError, OSError, TypeError, AttributeError) as error:
        print(f"Invalid deployment evidence: {error}", file=sys.stderr)
        return 2
    print(json.dumps(result, indent=2, sort_keys=True))
    if result["provenance_verified"] or (result["classification"] == "target_skipped" and result["workflow_success"]):
        return 0
    return 1


if __name__ == "__main__":
    sys.exit(main())
