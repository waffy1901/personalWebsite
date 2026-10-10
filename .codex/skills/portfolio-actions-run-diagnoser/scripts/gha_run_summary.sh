#!/usr/bin/env bash
set -euo pipefail

if [[ $# -lt 2 || $# -gt 3 || ! "$1" =~ ^[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+$ || ! "$2" =~ ^[0-9]+$ ]]; then
  echo "Usage: $0 OWNER/REPO RUN_ID [EXPECTED_UTC_TIMESTAMP]" >&2
  exit 2
fi

repo="$1"
run_id="$2"
skill_scripts="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
evidence_dir="$(rtk proxy mktemp -d "${TMPDIR:-/tmp}/portfolio-run-evidence.XXXXXXXX")"
trap 'rtk proxy rm -rf -- "$evidence_dir"' EXIT

rtk proxy gh api "repos/$repo/actions/runs/$run_id" > "$evidence_dir/run.json"
attempt="$(rtk proxy python3 -c 'import json,sys; n=json.load(open(sys.argv[1]))["run_attempt"]; assert type(n) is int and n > 0; print(n)' "$evidence_dir/run.json")"
rtk proxy gh api --paginate --slurp "repos/$repo/actions/runs/$run_id/attempts/$attempt/jobs?per_page=100" > "$evidence_dir/jobs.json"
args=(--run "$evidence_dir/run.json" --jobs "$evidence_dir/jobs.json")
if [[ $# -eq 3 ]]; then
  args+=(--expected-at "$3")
fi
rtk proxy python3 "$skill_scripts/summarize_run_timing.py" "${args[@]}"
