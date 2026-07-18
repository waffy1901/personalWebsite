#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

cd "$repo_root"

echo "pre-commit: mapping staged portfolio changes"
node .codex/skills/portfolio-change-impact/scripts/check_change_impact.mjs \
  --source staged \
  --check

echo "pre-commit: focused checks passed"
