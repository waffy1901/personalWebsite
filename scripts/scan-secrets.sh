#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "${BASH_SOURCE[0]}")/.." || exit 2

if [[ $# -gt 1 ]]; then
  printf 'Usage: npm run scan:secrets [-- <base-ref>]\n' >&2
  exit 2
fi
if ! command -v gitleaks >/dev/null || [[ "$(gitleaks version)" != "8.30.1" ]]; then
  printf 'Install Gitleaks 8.30.1 on PATH. See Local security scans in README.md.\n' >&2
  exit 2
fi

if [[ $# -eq 0 ]]; then
  # Gitleaks' --no-color flag does not apply to its staged Git subprocess.
  git_config_count="${GIT_CONFIG_COUNT:-0}"
  if [[ ! "$git_config_count" =~ ^[0-9]{1,9}$ ]]; then
    printf 'Invalid GIT_CONFIG_COUNT for staged scan.\n' >&2
    exit 2
  fi
  git_config_count=$((10#$git_config_count))
  export "GIT_CONFIG_KEY_$git_config_count=color.diff" "GIT_CONFIG_VALUE_$git_config_count=false"
  export "GIT_CONFIG_COUNT=$((git_config_count + 1))"
  if ! git_diff_color="$(env -u GIT_CONFIG git config --get color.diff)" ||
    [[ "$git_diff_color" != "false" ]]; then
    printf 'Could not disable Git diff color for staged scan.\n' >&2
    exit 2
  fi
  printf 'Scanning staged Git changes.\n'
  scan_args=(--pre-commit --staged)
else
  if [[ "$(git rev-parse --is-shallow-repository)" != "false" ]]; then
    printf 'Use a full Git checkout to scan outgoing commits.\n' >&2
    exit 2
  fi
  if ! base="$(git rev-parse --verify --quiet --end-of-options "${1}^{commit}")"; then
    printf 'Pass an existing base commit or ref. Fetch origin/main first if needed.\n' >&2
    exit 2
  fi
  if ! head="$(git rev-parse --verify --quiet HEAD)" ||
    ! count="$(git rev-list --count "$base..$head")"; then
    printf 'Could not read the outgoing commit range.\n' >&2
    exit 2
  fi
  range="$base..$head"
  if [[ "$count" -eq 0 ]]; then
    printf 'No outgoing commits in %s.\n' "$range"
    exit 0
  fi
  printf 'Scanning changes in %s outgoing commit(s) in %s.\n' "$count" "$range"
  scan_args=("--log-opts=--format=medium --no-color --no-ext-diff --no-textconv --no-show-signature --no-notes --diff-merges=first-parent $range --")
fi

diagnostics="$(mktemp "${TMPDIR:-/tmp}/portfolio-gitleaks.XXXXXX")" || exit 2
trap 'rm -f -- "$diagnostics"' EXIT

status=0
gitleaks git --redact=100 --verbose --no-banner --no-color --log-level=debug \
  --max-target-megabytes=2 --timeout=30 --exit-code=3 "${scan_args[@]}" . \
  2>"$diagnostics" || status=$?

# Gitleaks 8.30.1 can exit zero after Git fails. Check its diagnostics first.
error_pattern='^[^[:space:]]+ (ERR |FTL |DBG command aborted( |$))'
log_status=0
grep -E "$error_pattern" "$diagnostics" >&2 || log_status=$?
if [[ "$log_status" -ne 1 ]]; then
  printf 'Gitleaks did not complete the scan.\n' >&2
  exit 2
fi
grep -Ev '^[^[:space:]]+ DBG ' "$diagnostics" >&2 || true

case "$status" in
  0) exit 0 ;;
  3) exit 1 ;;
  *) exit 2 ;;
esac
