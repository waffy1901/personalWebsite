#!/usr/bin/env python3
"""Prepare frozen candidate packets and import observed, local-only run evidence."""

import argparse
import json
import os
import random
import re
import secrets
import sys
import tempfile
import unittest
from pathlib import Path

import protocol as p


def freeze(file):
    p.require(p.DISTRIBUTION == "core", "only the private core pack can be frozen")
    att = p.read_json(file)
    snap = p.fingerprint()
    record = {**snap, "validation": att}
    p.validate_freeze(record, snap)
    benchmark_path, approval_path = p.freeze_paths(snap, att["setup"])
    for path, value in ((benchmark_path, snap), (approval_path, record)):
        try:
            p.save_new(path, value)
        except FileExistsError:
            p.require(p.read_json(path) == value, "an existing freeze pins different bytes or approval")
    return approval_path


def environment(data, official=False):
    p.fields(data, [*p.ENV_FIELDS, "image", "token_budget", "usd_budget"], "operating conditions")
    for key in p.ENV_FIELDS:
        p.text_value(data[key], key)
        if official:
            p.require(data[key].strip().lower() not in ("unknown", "unconfigured", "example"), f"record exact {key}")
    image = data["image"]
    p.require((image is None and not official) or (isinstance(image, str) and re.fullmatch(r"sha256:[0-9a-f]{64}", image)),
              "official grading requires a locally provisioned immutable Node image ID")
    for key in ("token_budget", "usd_budget"):
        if data[key] is not None:
            p.require(p.number(data[key], key, key == "token_budget") > 0, f"{key} must be positive")
    p.check_secrets(data)
    return data


def roster_key(benchmark, models):
    return benchmark + "-" + p.digest(p.canonical(sorted(models))) + ".json"


def plan_campaign(campaign, env, seed, models, official=False, routes=None):
    p.require(not official or p.DISTRIBUTION == "core", "official campaigns require the registered private core pack")
    path = p.RESULTS / "campaigns" / p.name(campaign) / "plan.json"
    p.require(not path.exists(), "campaign already registered")
    env = environment(env, official)
    p.require(len(models) >= 2 and len(set(models)) == len(models), "choose at least two distinct exact model IDs")
    for model in models:
        p.name(model)
    mode = "official" if official else "preview"
    spec, snap = p.suite(), p.fingerprint()
    requested = {"models": models, "provider": p.PROVIDER, "effort": p.EFFORT, "environment": env}
    if routes is not None:
        requested["routes"] = routes
    frozen = None
    if official:
        frozen = p.digest(p.canonical(p.approved_freeze(snap, requested)))
    elif routes is not None:
        p.campaign_setup(requested)
    rng = random.Random(seed)
    slots, tasks = [], {}
    for tid in spec["tasks"]:
        task = p.task(tid)
        tasks[tid] = {"version": task["version"], "fixture": p.package_hash(p.package(task)),
                      "prompt": p.digest(p.prompt(task).encode()), "minutes": task["minutes"], "kind": task["kind"]}
    for rep in range(1, spec["repetitions"] + 1):
        for tid in rng.sample(spec["tasks"], len(spec["tasks"])):
            for model in rng.sample(models, len(models)):
                slots.append({"id": f"r{len(slots) + 1:03}", "blind": secrets.token_hex(12),
                              "task": tid, "repeat": rep, "model": model})
    plan = {"schema": 1, "campaign": campaign, "mode": mode, "distribution": p.DISTRIBUTION,
            "seed": seed, "created": p.now(),
            "version": spec["version"], "benchmark": snap["sha256"], "base": spec["base"],
            **requested, "freeze": frozen, "tasks": tasks, "slots": slots}
    if official:
        registration = p.RESULTS / "registrations" / roster_key(plan["benchmark"], models)
        try:
            p.save_new(registration, plan)
        except FileExistsError:
            saved = p.read_json(registration)
            p.require(all(saved.get(k) == plan[k] for k in ("campaign", "seed", "freeze", *requested)),
                      "this frozen roster already has an official campaign")
            plan = saved  # Resume a registration interrupted before plan publication.
    p.save_new(path, plan)
    return path


def evidence_template():
    return {"status": None, "model": None, "provider": None, "effort": None, "route_source": None, "route_sha256": None,
            "initial_fixture": None, "initial_prompt": None,
            "environment": None, "started": None, "ended": None, "events": [],
            "usage": {"tokens": None, "cost_usd": None, "source": None},
            "gates": dict.fromkeys(p.GATES, "unknown"), "gate_evidence": "", "notes": ""}


def packet_fingerprint(directory):
    source = p.inventory(directory)
    p.require("TASK.md" in source, "missing candidate prompt")
    prompt_text = source.pop("TASK.md")
    return {"initial_fixture": p.package_hash(source), "initial_prompt": p.digest(prompt_text.encode())}


def prepare(campaign, slot):
    folder, plan, chosen = p.slot_info(campaign, slot)
    run = folder / slot
    if run.exists():
        p.require(p.read_json(run / "issued.json")["plan"] == p.digest(p.canonical(plan)), "changed registration")
        meta = plan["tasks"][chosen["task"]]
        p.require(packet_fingerprint(run / "candidate") == {"initial_fixture": meta["fixture"], "initial_prompt": meta["prompt"]},
                  "issued packet differs from the registered bytes")
        return run
    first = next((s["id"] for s in plan["slots"] if not (folder / s["id"] / "record.json").exists()), None)
    p.require(slot == first, "follow the frozen schedule and record every previous outcome")
    spec = p.task(chosen["task"])
    source = p.package(spec)
    metadata = plan["tasks"][spec["id"]]
    p.require(p.package_hash(source) == metadata["fixture"] and p.digest(p.prompt(spec).encode()) == metadata["prompt"],
              "fixture or prompt drift")
    with tempfile.TemporaryDirectory(dir=folder) as temp:
        staged = Path(temp, "run")
        guest = staged / "candidate"
        for rel, text in {**source, "TASK.md": p.prompt(spec)}.items():
            file = guest / rel
            file.parent.mkdir(mode=0o700, parents=True, exist_ok=True)
            file.write_bytes(text.encode())
        p.save_new(staged / "evidence-template.json", evidence_template())
        p.save_new(staged / "issued.json", {"issued": p.now(), "plan": p.digest(p.canonical(plan))})
        staged.rename(run)
    return run


def validate_events(events, completed):
    p.require(isinstance(events, list), "events must be an ordered array")
    for e in events:
        if e.get("kind") == "message":
            p.fields(e, ("kind", "role", "text"), "message")
            p.require(e["role"] in ("user", "assistant"), "invalid transcript role")
            p.text_value(e["text"], "message text")
        else:
            p.fields(e, ("kind", "name", "input", "output", "exit_code"), "tool event")
            p.require(e["kind"] == "tool" and isinstance(e["input"], str) and isinstance(e["output"], str), "invalid tool event")
            p.text_value(e["name"], "tool name")
            p.require(e["exit_code"] is None or type(e["exit_code"]) is int, "invalid command exit code")
            if e["name"] == "shell":
                p.require(type(e["exit_code"]) is int or not completed, "record shell exit codes")
    if events:
        p.require(events[0].get("role") == "user", "first transcript event must be the user prompt")
    if completed:
        p.require(events and events[-1].get("role") == "assistant", "completed run needs its final response")


def import_evidence(campaign, slot, evidence, tree=None):
    folder, plan, chosen = p.slot_info(campaign, slot)
    run = folder / slot
    issued = p.read_json(run / "issued.json")
    p.require(issued["plan"] == p.digest(p.canonical(plan)), "registration changed after issue")
    p.check_secrets(evidence)
    # Earlier preview observations did not record a route fingerprint.
    if isinstance(evidence, dict) and "route_sha256" not in evidence:
        evidence = {**evidence, "route_sha256": None}
    p.fields(evidence, evidence_template(), "run observation")
    status = evidence["status"]
    p.require(status in ("completed", "timeout", "aborted", "unavailable"), "invalid run status")
    p.fields(evidence["gates"], p.GATES, "operator gate observations")
    p.require(all(v in ("pass", "fail", "unknown") for v in evidence["gates"].values()), "invalid gate observation")
    p.require(isinstance(evidence["gate_evidence"], str), "gate evidence must be text")
    if any(v != "unknown" for v in evidence["gates"].values()):
        p.text_value(evidence["gate_evidence"], "observed safety and isolation evidence")
    p.fields(evidence["usage"], ("tokens", "cost_usd", "source"), "usage")
    usage = evidence["usage"]
    for key in ("tokens", "cost_usd"):
        if usage[key] is not None:
            p.number(usage[key], key, key == "tokens")
            p.text_value(usage["source"], "observed telemetry provenance")
    p.require(isinstance(evidence["notes"], str), "notes must be text")
    complete = status == "completed"
    for key in ("model", "effort", "provider", "route_source"):
        if evidence[key] is not None:
            p.text_value(evidence[key], key)
    for key in ("initial_fixture", "initial_prompt", "route_sha256"):
        if evidence[key] is not None:
            p.require(p.is_sha256(evidence[key]), f"invalid measured {key} SHA-256")
    if evidence["environment"] is not None:
        environment(evidence["environment"])
    if usage["source"] is not None:
        p.text_value(usage["source"], "usage source")
    if complete or status == "timeout":
        for key in ("model", "effort", "provider", "route_source"):
            p.text_value(evidence[key], key)
        p.require(all(evidence[key] is not None for key in ("initial_fixture", "initial_prompt", "environment")),
                  "record the observed packet hashes and environment")
    if status != "completed":
        p.text_value(evidence["notes"], "incomplete run reason")
    t0, t1 = evidence["started"], evidence["ended"]
    seconds = None
    if t0 is not None or t1 is not None or status in ("completed", "timeout"):
        start, end = p.moment(t0), p.moment(t1)
        p.require(p.moment(issued["issued"]) <= start <= end <= p.moment(p.now()), "invalid observation time window")
        seconds = (end - start).total_seconds()
    spec = p.task(chosen["task"])
    text = p.prompt(spec)
    events = evidence["events"]
    validate_events(events, complete)
    p.require(not complete or tree is not None, "completed run requires the stopped candidate tree")
    before = {**p.package(spec), "TASK.md": text}
    after = p.inventory(tree) if tree is not None else before
    changes = p.difference(before, after)
    p.check_secrets(changes)
    meta = plan["tasks"][chosen["task"]]
    mismatches = [k for k, expected in (("model", chosen["model"]), ("provider", plan["provider"]),
                  ("effort", plan["effort"]),
                  ("initial_fixture", meta["fixture"]), ("initial_prompt", meta["prompt"])) if evidence[k] != expected]
    if p.environment_sha256(evidence["environment"]) != p.environment_sha256(plan["environment"]):
        mismatches.append("environment")
    if events and events[0]["text"] != text:
        mismatches.append("transcript_prompt")
    if "routes" in plan and evidence["route_sha256"] != plan["routes"][chosen["model"]]:
        mismatches.append("route_sha256")
    out_of_scope = [path for path, content in changes.items() if path not in spec["editable"] or content is None]
    result = {"schema": 1, "slot": slot, "task": chosen["task"], "repeat": chosen["repeat"], "plan": issued["plan"],
              "benchmark": plan["benchmark"], "base": plan["base"], "fixture": meta["fixture"], "prompt": meta["prompt"],
              "minutes": meta["minutes"], "kind": meta["kind"],
              "task_version": spec["version"], "harness_version": plan["version"],
              "requested_model": chosen["model"], "requested_effort": plan["effort"], "requested_provider": plan["provider"],
              "issued": issued["issued"], "observed": evidence, "seconds": seconds, "mismatches": mismatches,
              "out_of_scope": out_of_scope, "changes": changes, "patch": p.patch_text(before, changes)}
    if "routes" in plan:
        result["requested_route_sha256"] = plan["routes"][chosen["model"]]
    p.save_new(run / "record.json", result)
    return run / "record.json"


def main():
    os.umask(0o077)
    parser = argparse.ArgumentParser(description=__doc__)
    commands = parser.add_subparsers(dest="cmd", required=True)
    commands.add_parser("fingerprint")
    commands.add_parser("pack-sha").add_argument("directory", type=Path)
    commands.add_parser("calibrate")
    commands.add_parser("packet-fingerprint").add_argument("directory", type=Path)
    commands.add_parser("environment")
    setup = commands.add_parser("validation-setup", help="describe the exact operating setup for independent review")
    setup.add_argument("--environment", required=True, type=Path)
    setup.add_argument("--routes", required=True, type=Path)
    commands.add_parser("freeze").add_argument("validation", type=Path)
    new = commands.add_parser("plan")
    new.add_argument("campaign")
    new.add_argument("--environment", required=True, type=Path)
    new.add_argument("--seed", required=True, type=int)
    new.add_argument("--official", action="store_true")
    new.add_argument("--routes", type=Path, help="model IDs mapped to SHA-256 digests of the actual route configurations")
    new.add_argument("--model", action="append")
    for cmd in ("prepare", "import"):
        op = commands.add_parser(cmd)
        op.add_argument("campaign")
        op.add_argument("slot")
        if cmd == "import":
            op.add_argument("evidence", type=Path)
            op.add_argument("--tree", type=Path)
    a = parser.parse_args()
    if a.cmd == "fingerprint":
        print(json.dumps(p.fingerprint(), indent=2))
    elif a.cmd == "pack-sha":
        print(p.pack_sha256(a.directory))
    elif a.cmd == "calibrate":
        root = p.selected_pack().root if p.DISTRIBUTION == "core" else p.HERE
        pattern = "test_*.py" if p.DISTRIBUTION == "core" else "test_demo.py"
        tests = unittest.defaultTestLoader.discover(str(root), pattern=pattern)
        p.require(tests.countTestCases() > 0, "no calibration tests found")
        if not unittest.TextTestRunner(verbosity=1).run(tests).wasSuccessful():
            sys.exit(1)
    elif a.cmd == "packet-fingerprint":
        print(json.dumps(packet_fingerprint(a.directory), indent=2))
    elif a.cmd == "environment":
        print(json.dumps({**dict.fromkeys(p.ENV_FIELDS, "unconfigured"), "image": None, "token_budget": None, "usd_budget": None}, indent=2))
    elif a.cmd == "validation-setup":
        setup = p.operating_setup(environment(p.read_json(a.environment), official=True), p.read_json(a.routes))
        print(json.dumps(setup, indent=2))
    elif a.cmd == "freeze":
        print(freeze(a.validation))
    elif a.cmd == "plan":
        routes = p.read_json(a.routes) if a.routes is not None else None
        print(plan_campaign(a.campaign, p.read_json(a.environment), a.seed, a.model or p.DEFAULT_MODELS, a.official, routes))
    elif a.cmd == "prepare":
        print(prepare(a.campaign, a.slot))
    else:
        print(import_evidence(a.campaign, a.slot, p.read_json(a.evidence), a.tree))


if __name__ == "__main__":
    try:
        main()
    except (OSError, ValueError, KeyError, TypeError, RuntimeError, AttributeError) as exc:
        sys.exit(str(exc))
