#!/usr/bin/env python3
"""Summarize Codex token telemetry without exposing session content."""

from __future__ import annotations

import argparse
import json
import sys
from collections import defaultdict
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


TOKEN_KEYS = (
    "input_tokens",
    "cached_input_tokens",
    "cache_write_input_tokens",
    "output_tokens",
    "reasoning_output_tokens",
)


def parse_time(value: str) -> datetime:
    if value.endswith("Z"):
        value = f"{value[:-1]}+00:00"
    parsed = datetime.fromisoformat(value)
    if parsed.tzinfo is None:
        raise ValueError("time boundary must include a UTC offset or Z")
    return parsed.astimezone(timezone.utc)


def metadata_from(path: Path) -> dict[str, Any] | None:
    try:
        with path.open(encoding="utf-8") as handle:
            first_line = handle.readline()
    except OSError:
        return None
    try:
        record = json.loads(first_line)
    except (json.JSONDecodeError, ValueError, RecursionError):
        return None
    if not isinstance(record, dict):
        return None
    if record.get("type") != "session_meta" or not isinstance(record.get("payload"), dict):
        return None
    # Never retain arbitrary session metadata (which can include instructions).
    # Linkage, identity, route, and start-time fields are the entire index schema.
    payload = record["payload"]
    metadata = {
        key: payload[key]
        for key in ("id", "session_id", "timestamp", "parent_thread_id", "forked_from_id", "agent_role", "agent_path")
        if isinstance(payload.get(key), str)
    }
    source = payload.get("source")
    subagent = source.get("subagent") if isinstance(source, dict) else None
    if isinstance(subagent, dict):
        safe_subagent = {"other": subagent["other"]} if isinstance(subagent.get("other"), str) else {}
        for key in ("agent_role", "agent_path"):
            if isinstance(subagent.get(key), str):
                safe_subagent[key] = subagent[key]
        spawn = subagent.get("thread_spawn")
        if isinstance(spawn, dict):
            safe_spawn = {
                key: spawn[key]
                for key in ("parent_thread_id", "agent_role", "agent_path")
                if isinstance(spawn.get(key), str)
            }
            if safe_spawn:
                safe_subagent["thread_spawn"] = safe_spawn
        if safe_subagent:
            metadata["source"] = {"subagent": safe_subagent}
    return metadata


def session_index(session_dir: Path) -> list[tuple[Path, dict[str, Any]]]:
    indexed = []
    for path in sorted(session_dir.rglob("*.jsonl")):
        metadata = metadata_from(path)
        if metadata is not None:
            indexed.append((path, metadata))
    return indexed


def metadata_time(metadata: dict[str, Any]) -> datetime | None:
    value = metadata.get("timestamp")
    if not isinstance(value, str):
        return None
    try:
        return parse_time(value)
    except ValueError:
        return None


def metadata_ids(metadata: dict[str, Any]) -> set[str]:
    return {value for key in ("session_id", "id") if isinstance((value := metadata.get(key)), str)}


def session_identity(metadata: dict[str, Any], fallback: str) -> str:
    for key in ("id", "session_id"):
        value = metadata.get(key)
        if isinstance(value, str):
            return value
    return fallback


def subagent_metadata(metadata: dict[str, Any]) -> dict[str, Any]:
    source = metadata.get("source")
    if not isinstance(source, dict):
        return {}
    subagent = source.get("subagent")
    return subagent if isinstance(subagent, dict) else {}


def parent_ids(metadata: dict[str, Any]) -> set[str]:
    links = {
        value
        for key in ("parent_thread_id", "forked_from_id")
        if isinstance((value := metadata.get(key)), str)
    }
    subagent = subagent_metadata(metadata)
    spawn = subagent.get("thread_spawn")
    if isinstance(spawn, dict) and isinstance(spawn.get("parent_thread_id"), str):
        links.add(spawn["parent_thread_id"])
    if subagent.get("other") == "guardian" and isinstance(metadata.get("session_id"), str):
        links.add(metadata["session_id"])
    return links


def derived_role(metadata: dict[str, Any], root_session_id: str) -> str:
    if metadata.get("id") == root_session_id:
        return "coordinator"
    subagent = subagent_metadata(metadata)
    if subagent.get("other") == "guardian":
        return "guardian"
    spawn = subagent.get("thread_spawn") if isinstance(subagent.get("thread_spawn"), dict) else {}
    for source in (metadata, spawn):
        value = source.get("agent_role")
        if isinstance(value, str) and value:
            return value
    for source in (metadata, spawn):
        path = source.get("agent_path")
        if isinstance(path, str) and path.strip("/"):
            return f"agent:{path.rstrip('/').split('/')[-1]}"
    return "unavailable"


def parse_labels(values: list[str]) -> dict[str, tuple[str, str, str, str]]:
    labels = {}
    for value in values:
        session, separator, fields = value.partition("=")
        parts = fields.split("|")
        if not separator or not session or len(parts) != 4 or any(not part for part in parts):
            raise ValueError("session labels must be SESSION=PHASE|ROLE|REQUESTED_MODEL|REQUESTED_EFFORT")
        labels[session] = tuple(parts)  # type: ignore[assignment]
    return labels


def select_sessions(session_dir: Path, root_session_id: str, since: datetime) -> tuple[list[tuple[Path, dict[str, Any]]], list[str]]:
    indexed = session_index(session_dir)
    warnings: list[str] = []
    identities: dict[str, tuple[Path, dict[str, Any]]] = {}
    for path, metadata in indexed:
        identity = metadata.get("id")
        if isinstance(identity, str):
            identities[identity] = (path, metadata)

    exact_roots = [(path, metadata) for path, metadata in indexed if metadata.get("id") == root_session_id]
    root = exact_roots[0] if len(exact_roots) == 1 else identities.get(root_session_id)
    if root is None:
        candidates = [(path, metadata) for path, metadata in indexed if root_session_id in path.name]
        root = candidates[0] if len(candidates) == 1 else None
    if root is None:
        raise ValueError(f"root session ID not found: {root_session_id}")

    selected_ids = metadata_ids(root[1]) | {root_session_id}
    selected_paths = {root[0]}
    changed = True
    while changed:
        changed = False
        for path, metadata in indexed:
            if path not in selected_paths and parent_ids(metadata) & selected_ids:
                selected_paths.add(path)
                selected_ids.update(metadata_ids(metadata))
                changed = True

    selected = []
    for path, metadata in indexed:
        if path not in selected_paths:
            continue
        started = metadata_time(metadata)
        if path != root[0] and (started is None or started < since):
            warnings.append(f"excluded descendant {path.name}: outside or missing time boundary")
            continue
        selected.append((path, metadata))
    return selected, warnings


def number(value: Any) -> int | None:
    return value if isinstance(value, int) and not isinstance(value, bool) and value >= 0 else None


def empty_metrics() -> dict[str, int | None]:
    return {
        "response_count": 0,
        "input": 0,
        "cached_input": 0,
        "cache_write_input": 0,
        "uncached_input": 0,
        "output": 0,
        "reasoning_output": 0,
        "total": 0,
    }


def unavailable_metrics() -> dict[str, int | None]:
    return {key: None for key in empty_metrics()}


def summarize_selected(
    selected: list[tuple[Path, dict[str, Any]]],
    *,
    phase: str,
    requested_model: str,
    requested_effort: str,
    since: datetime,
    labels: dict[str, tuple[str, str, str, str]],
    root_session_id: str,
) -> tuple[list[dict[str, Any]], list[str], datetime | None]:
    groups: dict[tuple[str, str, str, str, str], list[dict[str, int | None]]] = defaultdict(list)
    warnings: list[str] = []
    latest_observation: datetime | None = None
    ignored_compaction_baselines: dict[str, int] = defaultdict(int)
    ignored_relay_snapshots: dict[str, int] = defaultdict(int)
    for path, metadata in selected:
        session_id = session_identity(metadata, path.stem)
        label = labels.get(session_id)
        session_phase, role, _, _ = label or (
            phase, derived_role(metadata, root_session_id), requested_model, requested_effort,
        )
        model = "unavailable"
        effort = "unavailable"
        telemetry_seen = False
        compaction_pending = False
        last_counted_fingerprint: tuple[int | None, ...] | None = None
        pending_observation: tuple[
            tuple[str, str, str, str, str], dict[str, int | None], tuple[int | None, ...], datetime
        ] | None = None

        def commit_pending() -> None:
            nonlocal pending_observation, telemetry_seen, latest_observation, last_counted_fingerprint
            if pending_observation is None:
                return
            key, observation, fingerprint, observed_at = pending_observation
            groups[key].append(observation)
            telemetry_seen = True
            last_counted_fingerprint = fingerprint
            latest_observation = max(latest_observation, observed_at) if latest_observation else observed_at
            pending_observation = None

        try:
            handle = path.open(encoding="utf-8")
        except OSError as error:
            warnings.append(f"could not read selected session {path.name}: {error}")
            continue
        with handle:
            for line in handle:
                try:
                    record = json.loads(line)
                except json.JSONDecodeError:
                    commit_pending()
                    warnings.append(f"ignored malformed JSONL record in {path.name}")
                    continue
                except (ValueError, RecursionError):
                    commit_pending()
                    warnings.append(f"ignored decoder-rejected JSONL record in {path.name}")
                    continue
                if not isinstance(record, dict):
                    commit_pending()
                    warnings.append(f"ignored non-object JSONL record in {path.name}")
                    continue
                record_type = record.get("type")
                payload = record.get("payload")
                if pending_observation is not None:
                    if (
                        record_type == "inter_agent_communication_metadata"
                        and isinstance(payload, dict)
                        and payload.get("trigger_turn") is False
                        and all(value is not None for value in pending_observation[2])
                        and pending_observation[2] == last_counted_fingerprint
                    ):
                        ignored_relay_snapshots[session_id] += 1
                        pending_observation = None
                    else:
                        commit_pending()
                if not isinstance(payload, dict):
                    continue
                if record_type == "turn_context":
                    model = payload.get("model") if isinstance(payload.get("model"), str) else "unavailable"
                    effort = payload.get("effort") if isinstance(payload.get("effort"), str) else "unavailable"
                    continue
                if record_type == "compacted":
                    compaction_pending = True
                    continue
                if record_type != "event_msg" or payload.get("type") != "token_count":
                    continue
                timestamp = record.get("timestamp")
                if not isinstance(timestamp, str):
                    warnings.append(f"excluded token telemetry without a timestamp in {path.name}")
                    continue
                try:
                    observed_at = parse_time(timestamp)
                except ValueError:
                    warnings.append(f"excluded token telemetry with an invalid timestamp in {path.name}")
                    continue
                if observed_at < since:
                    continue
                info = payload.get("info")
                usage = info.get("last_token_usage") if isinstance(info, dict) else None
                if not isinstance(usage, dict):
                    warnings.append(f"missing last_token_usage in {path.name}")
                    continue
                values = {key: number(usage.get(key)) for key in TOKEN_KEYS}
                reported_total = number(usage.get("total_tokens"))
                if any(isinstance(usage.get(key), bool) for key in TOKEN_KEYS + ("total_tokens",)):
                    warnings.append(f"invalid boolean token metric in {path.name}")
                zero_components = all(value == 0 for value in values.values())
                if compaction_pending and zero_components and reported_total not in (None, 0):
                    ignored_compaction_baselines[session_id] += 1
                    continue
                # The next non-marker token record resumes ordinary validation.
                compaction_pending = False
                total_consistent = (
                    reported_total is None
                    or values["input_tokens"] is None
                    or values["output_tokens"] is None
                    or reported_total == values["input_tokens"] + values["output_tokens"]
                )
                reasoning_consistent = (
                    values["reasoning_output_tokens"] is None
                    or values["output_tokens"] is None
                    or values["reasoning_output_tokens"] <= values["output_tokens"]
                )
                if any(value is None for value in values.values()):
                    warnings.append(f"incomplete token telemetry in {path.name}")
                if not total_consistent:
                    warnings.append(f"inconsistent total_tokens telemetry in {path.name}")
                if not reasoning_consistent:
                    warnings.append(f"reasoning output exceeds output telemetry in {path.name}")
                key = (session_phase, role, session_id, model, effort)
                fingerprint = tuple(values[token_key] for token_key in TOKEN_KEYS) + (reported_total,)
                pending_observation = (key, {
                    "input": values["input_tokens"],
                    "cached_input": values["cached_input_tokens"],
                    "cache_write_input": values["cache_write_input_tokens"],
                    "output": values["output_tokens"],
                    "reasoning_output": values["reasoning_output_tokens"] if reasoning_consistent else None,
                    "total_consistent": int(total_consistent),
                }, fingerprint, observed_at)

        commit_pending()

        if not telemetry_seen:
            groups.setdefault((session_phase, role, session_id, model, effort), [])

    rows = []
    for key in sorted(groups):
        observations = groups[key]
        metrics = unavailable_metrics()
        metrics["response_count"] = len(observations) if observations else None
        if observations:
            for name in ("input", "cached_input", "cache_write_input", "output", "reasoning_output"):
                values = [item[name] for item in observations]
                metrics[name] = sum(value for value in values if value is not None) if all(value is not None for value in values) else None
        if all(metrics[name] is not None for name in ("input", "cached_input", "cache_write_input")):
            uncached = int(metrics["input"] or 0) - int(metrics["cached_input"] or 0) - int(metrics["cache_write_input"] or 0)
            if uncached < 0:
                warnings.append(f"inconsistent cached-input telemetry for session {key[2]}")
            else:
                metrics["uncached_input"] = uncached
        total_consistent = all(item["total_consistent"] == 1 for item in observations)
        if metrics["input"] is not None and metrics["output"] is not None and total_consistent:
            metrics["total"] = int(metrics["input"] or 0) + int(metrics["output"] or 0)
        elif observations and not total_consistent:
            warnings.append(f"total unavailable for session {key[2]} because reported total_tokens is inconsistent")
        rows.append({
            "phase": key[0], "role": key[1], "session": key[2],
            "requested_model": labels.get(key[2], (phase, key[1], requested_model, requested_effort))[2],
            "requested_effort": labels.get(key[2], (phase, key[1], requested_model, requested_effort))[3],
            "actual_model": key[3], "actual_effort": key[4], **metrics,
        })
    if not rows:
        warnings.append("no usable token_count telemetry found in selected sessions")
    if any(row["response_count"] is None for row in rows):
        warnings.append("selected session has no usable token telemetry after the time boundary")
    for session_id, count in sorted(ignored_compaction_baselines.items()):
        warnings.append(f"ignored {count} post-compaction zero-component token baseline(s) for session {session_id}")
    for session_id, count in sorted(ignored_relay_snapshots.items()):
        warnings.append(f"ignored {count} inter-agent relay token snapshot(s) for session {session_id}")
    return rows, warnings, latest_observation


def aggregate(rows: list[dict[str, Any]]) -> dict[str, Any]:
    metric_names = tuple(empty_metrics())
    totals = {}
    for name in metric_names:
        values = [row[name] for row in rows]
        unavailable_count = sum(value is None for value in values)
        totals[name] = {
            "observed_subtotal": sum(value for value in values if value is not None),
            "complete": unavailable_count == 0,
            "unavailable_group_count": unavailable_count,
        }
    return {"selected_group_count": len(rows), "metrics": totals}


def collect(args: argparse.Namespace) -> dict[str, Any]:
    since = parse_time(args.since)
    selected, warnings = select_sessions(Path(args.sessions_dir), args.root_session_id, since)
    labels = parse_labels(getattr(args, "session_labels", []))
    rows, usage_warnings, latest_observation = summarize_selected(
        selected, phase=args.phase, requested_model=args.requested_model, requested_effort=args.requested_effort,
        since=since, labels=labels, root_session_id=args.root_session_id,
    )
    warnings.extend(usage_warnings)
    collected_at = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
    return {
        "snapshot_at": collected_at,
        "telemetry_through": (latest_observation.isoformat().replace("+00:00", "Z") if latest_observation else None),
        "root_session_id": args.root_session_id,
        "since": since.isoformat().replace("+00:00", "Z"),
        "coverage": {
            "selected_session_count": len(selected),
            "selected_sessions": [session_identity(metadata, path.stem) for path, metadata in selected],
            "exclusions": "Final report response and later turns are excluded because they are not observable before delivery.",
        },
        "groups": rows,
        "aggregate": aggregate(rows),
        "warnings": sorted(set(warnings)),
    }


def markdown(report: dict[str, Any]) -> str:
    lines = [
        "## Token Usage Snapshot",
        "",
        f"- Collected: `{report['snapshot_at']}`; telemetry through `{report['telemetry_through'] or 'unavailable'}`",
        f"- Root session: `{report['root_session_id']}`; since `{report['since']}`",
        f"- Coverage: {report['coverage']['selected_session_count']} linked session(s)",
        f"- Exclusions: {report['coverage']['exclusions']}",
        "",
        "| Phase | Role | Session | Requested model/effort | Actual model/effort | Responses | Input | Cached input | Cache-write input | Uncached input | Output | Reasoning output | Total |",
        "| --- | --- | --- | --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |",
    ]
    for row in report["groups"]:
        values = [row[key] if row[key] is not None else "unavailable" for key in (
            "response_count", "input", "cached_input", "cache_write_input", "uncached_input", "output", "reasoning_output", "total",
        )]
        lines.append(
            f"| {row['phase']} | {row['role']} | {row['session']} | {row['requested_model']}/{row['requested_effort']} | "
            f"{row['actual_model']}/{row['actual_effort']} | " + " | ".join(map(str, values)) + " |"
        )
    lines.extend(["", "### Aggregate coverage", "", "| Metric | Observed subtotal | Completeness |", "| --- | ---: | --- |"])
    for name, values in report["aggregate"]["metrics"].items():
        completeness = "complete" if values["complete"] else f"partial; {values['unavailable_group_count']} group(s) unavailable"
        lines.append(f"| {name} | {values['observed_subtotal']} | {completeness} |")
    if report["warnings"]:
        lines.extend(["", "Warnings:"])
        lines.extend(f"- {warning}" for warning in report["warnings"])
    return "\n".join(lines) + "\n"


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--root-session-id", required=True)
    parser.add_argument("--since", required=True, help="ISO-8601 UTC boundary, for example 2026-08-24T00:30:57Z")
    parser.add_argument("--sessions-dir", default=str(Path.home() / ".codex" / "sessions"))
    parser.add_argument("--phase", default="unavailable")
    parser.add_argument("--requested-model", default="unavailable")
    parser.add_argument("--requested-effort", default="unavailable")
    parser.add_argument(
        "--session-label", action="append", dest="session_labels", default=[],
        metavar="SESSION=PHASE|ROLE|REQUESTED_MODEL|REQUESTED_EFFORT",
        help="Repeat for truthful per-session workflow labels; overrides global phase and requested route.",
    )
    parser.add_argument("--format", choices=("markdown", "json"), default="markdown")
    args = parser.parse_args()
    try:
        report = collect(args)
    except ValueError as error:
        parser.error(str(error))
    if args.format == "json":
        json.dump(report, sys.stdout, indent=2, sort_keys=True)
        sys.stdout.write("\n")
    else:
        sys.stdout.write(markdown(report))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
