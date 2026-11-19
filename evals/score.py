#!/usr/bin/env python3
"""Create blinded review packets and deterministic reports over every registered slot."""

import argparse
import csv
import json
import os
import re
import sys
import tempfile
from collections import Counter
from pathlib import Path
from statistics import median

import protocol as p


def final_answer(observed):
    try:
        value = p.parse_json(observed["events"][-1]["text"])
        p.fields(value, ("summary", "answer"), "final response")
        p.text_value(value["summary"], "summary")
        p.require(isinstance(value["answer"], dict), "answer must be an object")
        return value["answer"]
    except (ValueError, KeyError, TypeError, IndexError):
        return None


def blind_packet(plan, slot, record):
    # Omit transport attribution, chronology, assignment, usage, operator notes and grade.
    names = [*plan["models"], record["observed"]["model"]]
    patterns = [r"[\s_.-]*".join(re.escape(bit) for bit in re.split(r"[\s_.-]+", name) if bit)
                for name in names if isinstance(name, str) and name]
    patterns += [r"(?:gpt[ -]?)?6[. -][12][ -]?(?:sol|astra)(?:[ -]?max)?",
                 r"(?:sol|astra)[ -]?6[. -][12](?:[ -]?max)?"]
    redact = re.compile("|".join(patterns), re.I)
    def conceal(value):
        if isinstance(value, list):
            return [conceal(item) for item in value]
        if isinstance(value, dict):
            return {k: conceal(v) for k, v in value.items()}
        return redact.sub("[model]", value) if isinstance(value, str) else value
    return {"blind_id": slot["blind"], "task": slot["task"], "kind": record["kind"],
            "rubric": (p.HERE / "rubric.md").read_text(),
            "task_guidance": p.read_json(p.selected_pack().grading / "reviewer-notes.json")[slot["task"]],
            "starting_files": p.package(p.task(slot["task"])), "task_minutes": record["minutes"],
            "gate_evidence": conceal(record["observed"]["gate_evidence"]),
            "boundary": {k: conceal(record["observed"]["environment"][k]) for k in
                         ("isolation", "tool_permissions", "network_policy")},
            "events": conceal(record["observed"]["events"]),
            "patch": conceal(record["patch"])}


def review_template(packet):
    return {"blind_id": packet["blind_id"], "packet": p.digest(p.canonical(packet)), "reviewer": None,
            "quality": None, "contract": None, "verification": None, "review_minutes": None, "fix_minutes": None,
            "fixes": {"minor": None, "major": None, "blocker": None},
            "gates": dict.fromkeys(p.GATES, "unknown"), "prose_only_false_positives": None, "rationale": ""}


def blind(campaign):
    folder, plan = p.load_plan(campaign)
    out = folder / "blinded"
    for slot in plan["slots"]:
        record = folder / slot["id"] / "record.json"
        if not record.exists():
            continue
        run = p.read_json(record)
        if run["observed"]["status"] != "completed":
            continue
        packet = blind_packet(plan, slot, run)
        for suffix, obj in (("packet", packet), ("form", review_template(packet))):
            dest = out / f"{slot['blind']}.{suffix}.json"
            if dest.exists():
                p.require(p.read_json(dest) == obj, "existing blind packet changed")
            else:
                p.save_new(dest, obj)
    return out


def accept_review(campaign, review):
    folder, plan = p.load_plan(campaign)
    ident = p.name(review["blind_id"])
    slot = next((s for s in plan["slots"] if s["blind"] == ident), None)
    p.require(slot is not None, "unregistered blind ID")
    packet = p.read_json(folder / "blinded" / (ident + ".packet.json"))
    record = p.read_json(folder / slot["id"] / "record.json")
    p.require(packet == blind_packet(plan, slot, record), "packet changed")
    p.fields(review, review_template(packet), "blinded review")
    p.require(review["packet"] == p.digest(p.canonical(packet)), "review does not match packet")
    p.text_value(review["reviewer"], "human reviewer identifier")
    p.text_value(review["rationale"], "human review rationale")
    for key in ("quality", "contract", "verification"):
        p.require(p.number(review[key], key, True) <= 4, "rating must be between zero and four")
    for key in ("review_minutes", "fix_minutes"):
        p.number(review[key], key)
    p.fields(review["fixes"], ("minor", "major", "blocker"), "fix counts")
    for key, n in review["fixes"].items():
        p.number(n, key, True)
    prose_fp = review["prose_only_false_positives"]
    if packet["kind"] == "review":
        p.number(prose_fp, "unsupported prose-only findings", True)
    else:
        p.require(prose_fp is None, "prose-only review counts apply only to review tasks")
    p.fields(review["gates"], p.GATES, "reviewer gates")
    p.require(all(v in ("pass", "fail", "unknown") for v in review["gates"].values()), "invalid review gate")
    p.check_secrets(review)
    dest = folder / "reviews" / (ident + ".json")
    p.save_new(dest, review)
    return dest


def correction(review):
    fixes, minutes = review["fixes"], review["fix_minutes"]
    if fixes["blocker"] or minutes > 25:
        return 0
    if not any(fixes.values()) and minutes == 0:
        return 1
    if fixes["major"] == 0 and fixes["minor"] <= 2 and minutes <= 10:
        return 0.7
    return 0.3


def efficiency(row, env):
    fractions = [row["seconds"] / (row["minutes"] * 60)]
    for key, ceiling in (("tokens", "token_budget"), ("cost_usd", "usd_budget")):
        if env[ceiling] is not None:
            if row[key] is None:
                return None
            fractions.append(row[key] / env[ceiling])
    credits = [1 if f <= .5 else .8 if f <= .75 else .6 if f <= 1 else 0 for f in fractions]
    return sum(credits) / len(credits)


def objective(task_id, record, env):
    spec = p.task(task_id)
    answer = final_answer(record["observed"])
    if spec["kind"] == "implementation":
        changed = {k: v for k, v in record["changes"].items() if k in spec["editable"] and v is not None}
        result = p.grader("edit_tasks").grade(task_id, p.package(spec), changed, answer or {}, image=env["image"])
    else:
        result = p.grader("text_tasks").grade(task_id, answer or {})
    checks = result["assertions"]
    p.require(checks and all(type(v) is bool for v in checks.values()), "grader returned invalid assertions")
    return checks, result["review_counts"], answer is not None


def score_slot(folder, plan, slot):
    tid = slot["task"]
    meta = plan["tasks"][tid]
    row = {"slot": slot["id"], "model": slot["model"], "task": tid, "kind": meta["kind"], "repeat": slot["repeat"],
           "observed_model": None, "conditions_match": None,
           "minutes": meta["minutes"], "status": "missing", "seconds": None, "tokens": None, "cost_usd": None,
           "telemetry_source": None, "iterations": None, "review_minutes": None, "fix_minutes": None, "fixes": None,
           "assertions": None, "review_counts": None, "operator_gates": None, "reviewer_gates": None,
           "categories": None, "raw_score": None, "decision_score": None, "quality_points": None,
           "prose_only_false_positives": None, "failures": []}
    file = folder / slot["id"] / "record.json"
    if not file.exists():
        row["failures"].append("missing_run")
        return row
    run = p.read_json(file)
    p.require(run["plan"] == p.digest(p.canonical(plan)) and run["slot"] == slot["id"], "run no longer matches schedule")
    obs = run["observed"]
    row.update(status=obs["status"], observed_model=obs["model"], conditions_match=not run["mismatches"],
               seconds=run["seconds"], tokens=obs["usage"]["tokens"], cost_usd=obs["usage"]["cost_usd"],
               telemetry_source=obs["usage"]["source"], operator_gates=obs["gates"],
               iterations=sum(e.get("role") == "assistant" for e in obs["events"]))
    fail = row["failures"]
    fail.extend("gate:" + k for k, v in obs["gates"].items() if v == "fail")
    fail.extend("conditions:" + k for k in run["mismatches"])
    if run["out_of_scope"]:
        fail.append("out_of_scope")
    if obs["status"] != "completed":
        fail.append(obs["status"])
        row["reason"] = obs["notes"]
        if obs["status"] == "timeout":
            if not obs["events"] or run["seconds"] < meta["minutes"] * 60:
                fail.append("insufficient_timeout_evidence")
            if any(plan["environment"][budget] is not None and row[metric] is None
                   for metric, budget in (("tokens", "token_budget"), ("cost_usd", "usd_budget"))):
                fail.append("required_usage_unknown")
            if "unknown" in obs["gates"].values():
                fail.append("unresolved_gate")
            if not run["mismatches"] and not {"insufficient_timeout_evidence", "required_usage_unknown", "unresolved_gate"}.intersection(fail):
                row["decision_score"] = row["quality_points"] = 0
        return row
    if run["seconds"] > meta["minutes"] * 60:
        fail.append("over_time_budget")
    review_path = folder / "reviews" / (slot["blind"] + ".json")
    review = p.read_json(review_path) if review_path.exists() else None
    if review:
        p.require(review["packet"] == p.digest(p.canonical(blind_packet(plan, slot, run))), "review no longer bound to evidence")
        row.update(reviewer_gates=review["gates"], review_minutes=review["review_minutes"],
                   fix_minutes=review["fix_minutes"], fixes=review["fixes"], prose_only_false_positives=review["prose_only_false_positives"])
        fail.extend("gate:" + k for k, v in review["gates"].items() if v == "fail" and "gate:" + k not in fail)
        if review["prose_only_false_positives"]:
            fail.append("unsupported_prose_findings")
    else:
        fail.append("awaiting_blind_review")
    try:
        checks, counts, valid_format = objective(tid, run, plan["environment"])
    except RuntimeError as exc:
        fail.append("grader_unavailable")
        row["reason"] = str(exc)
        return row
    row.update(assertions=checks, review_counts=counts)
    if not valid_format:
        fail.append("invalid_final_format")
    if not all(checks.values()):
        fail.append("failed_assertions")
    if counts and counts["fp"]:
        fail.append("false_positive")
    weights = p.suite()["weights"]
    ratios = {"functional": sum(checks.values()) / len(checks), "efficiency": efficiency(row, plan["environment"])}
    if review:
        ratios.update({k: review[k] / 4 for k in ("quality", "contract", "verification")})
        ratios["correction"] = correction(review)
    row["categories"] = {k: round(weights[k] * ratios[k], 3) if ratios.get(k) is not None else None for k in weights}
    if review and all(v is not None for v in row["categories"].values()):
        row["raw_score"] = round(sum(row["categories"].values()), 2)
    elif ratios["efficiency"] is None:
        fail.append("required_usage_unknown")
    if review and any("unknown" in gates.values() for gates in (obs["gates"], review["gates"])):
        fail.append("unresolved_gate")
    if run["mismatches"] or row["raw_score"] is None or "unresolved_gate" in fail:
        return row
    if any(f.startswith("gate:") or f in ("out_of_scope", "over_time_budget") for f in fail):
        row["decision_score"] = 0
        row["quality_points"] = 0
    else:
        row["decision_score"] = row["raw_score"]
        row["quality_points"] = sum(row["categories"][k] for k in ("functional", "quality", "contract", "verification"))
    return row


def spread(values):
    values = sorted(v for v in values if v is not None)
    if not values:
        return {"n": 0, "median": None, "min": None, "max": None, "iqr": None}
    # Linear interpolation at the 25th and 75th percentiles, including n=1.
    def percentile(frac):
        index = (len(values) - 1) * frac
        low = int(index)
        return values[low] + (values[min(low + 1, len(values) - 1)] - values[low]) * (index - low)
    return {"n": len(values), "median": median(values), "min": values[0], "max": values[-1],
            "iqr": round(percentile(.75) - percentile(.25), 3)}


def summary(rows):
    matched = [r for r in rows if r["conditions_match"]]
    counts = [r["review_counts"] for r in matched if r["review_counts"] is not None]
    matrix = {k: sum(c[k] for c in counts) for k in ("tp", "fp", "fn", "tn", "clean_fp", "negative_opportunities")} if counts else None
    def rate(num, denom):
        return num / denom if denom else None
    fp = rate(matrix["clean_fp"], matrix["negative_opportunities"]) if matrix else None
    def per_unit(key, multiplier):
        valid = [r for r in rows if r["quality_points"] is not None and r["decision_score"] is not None and r[key] is not None]
        denom = sum(r[key] for r in valid)
        return {"n": len(valid), "value": sum(r["quality_points"] for r in valid) * multiplier / denom if denom else None}
    completed = sum(r["status"] == "completed" for r in matched)
    prose_fp = [r["prose_only_false_positives"] for r in matched if r["prose_only_false_positives"] is not None]
    return {"scheduled": len(rows), "returned_completed": sum(r["status"] == "completed" for r in rows),
            "completed": completed, "completion_rate": completed / len(rows),
            "results": {key: spread(r[key] for r in matched) for key in
                        ("decision_score", "seconds", "tokens", "cost_usd", "review_minutes", "fix_minutes")},
            "review_counts": matrix, "false_positive_rate": fp,
            "precision": rate(matrix["tp"], matrix["tp"] + matrix["fp"]) if matrix else None,
            "recall": rate(matrix["tp"], matrix["tp"] + matrix["fn"]) if matrix else None,
            "prose_only_false_positives": {"reviewed": len(prose_fp), "count": sum(prose_fp) if prose_fp else None},
            "points_per_minute": per_unit("seconds", 60), "points_per_dollar": per_unit("cost_usd", 1),
            "failures": dict(sorted(Counter(f for r in rows for f in r["failures"]).items()))}


def decision(plan, rows):
    if plan["mode"] != "official":
        return {"status": "NON-COMPARATIVE PREVIEW", "answer": "Preview evidence cannot select a workhorse."}
    if any(r["decision_score"] is None or r["status"] in ("aborted", "unavailable", "missing")
           or not r["operator_gates"] or any(v == "unknown" for v in r["operator_gates"].values())
           or (r["status"] == "completed" and (not r["reviewer_gates"] or
               any(v == "unknown" for v in r["reviewer_gates"].values()))) or
           any(f.startswith("conditions:") or f in ("awaiting_blind_review", "required_usage_unknown",
               "insufficient_timeout_evidence", "grader_unavailable") for f in r["failures"]) for r in rows):
        return {"status": "incomplete", "answer": "The registered comparison still lacks comparable evidence."}
    base = plan["models"][0]
    table = {(r["model"], r["task"], r["repeat"]): r["decision_score"] for r in rows}
    comparisons = {}
    blocked = sorted({r["model"] for r in rows if any(f.startswith("gate:") for f in r["failures"])})
    for other in plan["models"][1:]:
        tasks = {}
        for tid in plan["tasks"]:
            diffs = [table[other, tid, i] - table[base, tid, i] for i in range(1, p.suite()["repetitions"] + 1)]
            tasks[tid] = {**spread(diffs), "wins": sum(d > 0 for d in diffs), "losses": sum(d < 0 for d in diffs),
                          "ties": sum(d == 0 for d in diffs), "kind": plan["tasks"][tid]["kind"]}
        typical = median(t["median"] for t in tasks.values())
        # Direction must recur in at least two thirds of tasks and repetitions.
        def stable(sign):
            return abs(typical) >= 3 and typical * sign > 0 and sum(
                t["median"] * sign > 0 and (t["wins"] if sign > 0 else t["losses"]) * 3 >= 2 * t["n"]
                for t in tasks.values()) * 3 >= 2 * len(tasks)
        if other in blocked or base in blocked:
            verdict = "Hard-gate failure; disqualified models cannot be recommended."
        elif stable(1):
            verdict = f"Prefer {other} on this core task bank."
        elif stable(-1):
            verdict = f"Prefer {base} on this core task bank."
        else:
            verdict = "Too mixed or too small to justify changing the default."
        def gain(key, unit):
            pairs = {}
            for r in rows:
                if r["model"] in (base, other):
                    pairs.setdefault((r["task"], r["repeat"]), {})[r["model"]] = r
            both = [(v[base], v[other]) for v in pairs.values() if all(r[key] is not None for r in v.values())]
            added = sum(b[key] - a[key] for a, b in both) / unit
            points = sum(b["quality_points"] - a["quality_points"] for a, b in both)
            return {"pairs": len(both), "delta_units": added if both else None,
                    "delta_points": points if both else None, "points_per_added_unit": points / added if added > 0 else None}
        review = [t for t in tasks.values() if t["kind"] == "review"]
        review_note = "Additional independently authored reviews are needed to select a high-risk reviewer."
        if review and not blocked:
            delta = median(t["median"] for t in review)
            review_note = f"On the review subset the median paired difference is {delta:+.2f} points. " + review_note
        comparisons[other] = {"relative_to": base, "median_task_delta": typical, "tasks": tasks, "answer": verdict,
                              "review_guidance": review_note, "incremental_minutes": gain("seconds", 60),
                              "incremental_usd": gain("cost_usd", 1)}
    return {"status": "adjudicated", "disqualified": blocked, "comparisons": comparisons,
            "answer": " ".join(c["answer"] for c in comparisons.values())}


def display(value):
    return "unknown" if value is None else (f"{value:.2f}".rstrip("0").rstrip(".") if type(value) is float else str(value))


def markdown(report):
    lines = [f"# Model evaluation - {report['decision']['status']}", "", report["decision"]["answer"], "",
             f"Benchmark `{report['benchmark']}` at `{report['base']}`.", "",
             "| Model | Completed / planned | Median / IQR (points) | Median seconds | Median tokens / USD | Median review / fix min | Structured FP rate / extra prose FPs | Quality points/min / USD |",
             "|---|---:|---:|---:|---:|---:|---:|---:|"]
    for model, agg in report["models"].items():
        vals = agg["results"]
        def metric(k, m="median"):
            return display(vals[k][m])
        lines.append(f"| {model} | {agg['completed']} / {agg['scheduled']} | {metric('decision_score')} / {metric('decision_score','iqr')} | "
                     f"{metric('seconds')} | {metric('tokens')} / {metric('cost_usd')} | {metric('review_minutes')} / {metric('fix_minutes')} | "
                     f"{display(agg['false_positive_rate'])} / {display(agg['prose_only_false_positives']['count'])} | {display(agg['points_per_minute']['value'])} / {display(agg['points_per_dollar']['value'])} |")
    lines += ["", "| Task | Model | Scored / planned | Median | Range | Failure counts |", "|---|---|---:|---:|---|---|"]
    for tid, models in report["tasks"].items():
        for model, agg in models.items():
            scores = agg["results"]["decision_score"]
            failures = ", ".join(f"{k} ({v})" for k, v in agg["failures"].items()) or "none"
            lines.append(f"| {tid} | {model} | {scores['n']} / {agg['scheduled']} | {display(scores['median'])} | "
                         f"{display(scores['min'])} to {display(scores['max'])} | {failures} |")
    for model, comparison in report["decision"].get("comparisons", {}).items():
        lines += ["", f"### {model} relative to {comparison['relative_to']}", "", comparison["answer"], "",
                  "| Task | Work type | Median paired gain | Wins / losses / ties |", "|---|---|---:|---:|"]
        for t, a in comparison["tasks"].items():
            lines.append(f"| {t} | {a['kind']} | {display(a['median'])} | {a['wins']} / {a['losses']} / {a['ties']} |")
        lines += ["", comparison["review_guidance"]]
        for key, label in (("incremental_minutes", "minute"), ("incremental_usd", "dollar")):
            gain = comparison[key]
            lines.append(f"Across {gain['pairs']} measured pairs, points gained per additional {label} were "
                         f"{display(gain['points_per_added_unit'])} (net units {display(gain['delta_units'])}).")
    lines += ["", "## Evidence and limits", "", *report["limitations"], "",
              "The JSON and CSV include one row per scheduled run, observed gates and assertion outcomes.", ""]
    return "\n".join(lines)


def report(campaign):
    folder, plan = p.load_plan(campaign)
    rows = [score_slot(folder, plan, s) for s in plan["slots"]]
    obj = {"schema": 1, "campaign": campaign, "mode": plan["mode"], "distribution": plan["distribution"],
           "version": plan["version"],
           "benchmark": plan["benchmark"], "base": plan["base"], "environment": plan["environment"],
           "models": {m: summary([r for r in rows if r["model"] == m]) for m in plan["models"]},
           "tasks": {tid: {m: summary([r for r in rows if r["model"] == m and r["task"] == tid])
                           for m in plan["models"]} for tid in plan["tasks"]},
           "runs": rows, "decision": decision(plan, rows), "limitations": [
               "Source evidence comes from the pinned snapshot and synthetic fixtures. Local checks and blinded human observations are recorded separately.",
               "Synthetic browser and provider captures do not establish live browser, production HTTP or external-account outcomes.",
               "Unknown usage is excluded from rate denominators. The JSON records metric coverage. Correction minutes are measured separately from review time.",
               "Preview runs exercise the protocol. Only an official, frozen core campaign can inform model selection."
               if plan["mode"] == "preview" else
               "Three repetitions describe this task bank. The review subset is small. Builder familiarity may benefit a future Astra contestant."]}
    dest = folder / "reports" / p.digest(p.canonical(obj))[:20]
    if dest.exists():
        return dest
    dest.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(dir=dest.parent) as tmp:
        stage = Path(tmp, "report")
        p.save_new(stage / "report.json", obj)
        (stage / "report.md").write_text(markdown(obj))
        with (stage / "runs.csv").open("w", newline="") as f:
            keys = list(dict.fromkeys(k for row in rows for k in row))
            writer = csv.DictWriter(f, keys)
            writer.writeheader()
            for row in rows:
                writer.writerow({k: json.dumps(v, ensure_ascii=False, sort_keys=True) if isinstance(v, (list, dict)) else v for k, v in row.items()})
        stage.rename(dest)
    return dest


def main():
    os.umask(0o077)
    parser = argparse.ArgumentParser(description=__doc__)
    subs = parser.add_subparsers(dest="cmd", required=True)
    for cmd in ("blind", "review", "report"):
        op = subs.add_parser(cmd)
        op.add_argument("campaign")
        if cmd == "review":
            op.add_argument("form", type=Path)
    args = parser.parse_args()
    if args.cmd == "review":
        print(accept_review(args.campaign, p.read_json(args.form)))
    elif args.cmd == "blind":
        print(blind(args.campaign))
    else:
        print(report(args.campaign))


if __name__ == "__main__":
    try:
        main()
    except (OSError, ValueError, KeyError, TypeError, RuntimeError, AttributeError) as exc:
        sys.exit(str(exc))
