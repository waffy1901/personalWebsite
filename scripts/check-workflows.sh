#!/usr/bin/env bash
set -euo pipefail

readonly ACTIONLINT_VERSION="1.7.12"
readonly SHELLCHECK_VERSION="0.11.0"
readonly DOWNLOAD_ROOT="https://github.com"

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$repo_root"

case "$(uname -s):$(uname -m)" in
  Linux:x86_64|Linux:amd64)
    actionlint_platform="linux_amd64"
    actionlint_sha256="8aca8db96f1b94770f1b0d72b6dddcb1ebb8123cb3712530b08cc387b349a3d8"
    shellcheck_platform="linux.x86_64"
    shellcheck_sha256="b7af85e41cc99489dcc21d66c6d5f3685138f06d34651e6d34b42ec6d54fe6f6"
    ;;
  Linux:aarch64|Linux:arm64)
    actionlint_platform="linux_arm64"
    actionlint_sha256="325e971b6ba9bfa504672e29be93c24981eeb1c07576d730e9f7c8805afff0c6"
    shellcheck_platform="linux.aarch64"
    shellcheck_sha256="68a8133197a50beb8803f8d42f9908d1af1c5540d4bb05fdfca8c1fa47decefc"
    ;;
  Darwin:x86_64|Darwin:amd64)
    actionlint_platform="darwin_amd64"
    actionlint_sha256="5b44c3bc2255115c9b69e30efc0fecdf498fdb63c5d58e17084fd5f16324c644"
    shellcheck_platform="darwin.x86_64"
    shellcheck_sha256="c2c15e08df0e8fbc374c335b230a7ee958c313fa5714817a59aa59f1aa594f51"
    ;;
  Darwin:arm64|Darwin:aarch64)
    actionlint_platform="darwin_arm64"
    actionlint_sha256="aba9ced2dee8d27fecca3dc7feb1a7f9a52caefa1eb46f3271ea66b6e0e6953f"
    shellcheck_platform="darwin.aarch64"
    shellcheck_sha256="339b930feb1ea764467013cc1f72d09cd6b869ebf1013296ba9055ab2ffbd26f"
    ;;
  *)
    printf 'Unsupported workflow-lint platform: %s/%s\n' "$(uname -s)" "$(uname -m)" >&2
    exit 1
    ;;
esac

for command_name in curl tar; do
  if ! command -v "$command_name" >/dev/null 2>&1; then
    printf 'Required command is unavailable: %s\n' "$command_name" >&2
    exit 1
  fi
done

verify_sha256() {
  local expected="$1"
  local archive="$2"
  local actual

  if command -v sha256sum >/dev/null 2>&1; then
    actual="$(sha256sum "$archive")"
  elif command -v shasum >/dev/null 2>&1; then
    actual="$(shasum -a 256 "$archive")"
  else
    printf 'A SHA-256 utility (sha256sum or shasum) is required.\n' >&2
    exit 1
  fi
  actual="${actual%% *}"

  if [[ "$actual" != "$expected" ]]; then
    printf 'SHA-256 mismatch for %s: expected %s, received %s\n' \
      "$(basename "$archive")" "$expected" "$actual" >&2
    exit 1
  fi
}

download() {
  local url="$1"
  local destination="$2"

  curl --proto '=https' --tlsv1.2 --fail --silent --show-error --location \
    --retry 2 --retry-max-time 90 --connect-timeout 15 --max-time 45 \
    --output "$destination" "$url"
}

work_dir="$(mktemp -d "${TMPDIR:-/tmp}/personalWebsite-workflow-lint.XXXXXX")"
trap 'rm -rf "$work_dir"' EXIT

actionlint_archive="$work_dir/actionlint.tar.gz"
shellcheck_archive="$work_dir/shellcheck.tar.gz"
download "$DOWNLOAD_ROOT/rhysd/actionlint/releases/download/v${ACTIONLINT_VERSION}/actionlint_${ACTIONLINT_VERSION}_${actionlint_platform}.tar.gz" "$actionlint_archive"
download "$DOWNLOAD_ROOT/koalaman/shellcheck/releases/download/v${SHELLCHECK_VERSION}/shellcheck-v${SHELLCHECK_VERSION}.${shellcheck_platform}.tar.gz" "$shellcheck_archive"
verify_sha256 "$actionlint_sha256" "$actionlint_archive"
verify_sha256 "$shellcheck_sha256" "$shellcheck_archive"

mkdir "$work_dir/actionlint" "$work_dir/shellcheck"
tar -xzf "$actionlint_archive" -C "$work_dir/actionlint" actionlint
tar -xzf "$shellcheck_archive" -C "$work_dir/shellcheck" \
  "shellcheck-v${SHELLCHECK_VERSION}/shellcheck"
actionlint="$work_dir/actionlint/actionlint"
shellcheck="$work_dir/shellcheck/shellcheck-v${SHELLCHECK_VERSION}/shellcheck"
chmod +x "$actionlint" "$shellcheck"

"$shellcheck" scripts/check-workflows.sh

shopt -s nullglob
workflow_files=(.github/workflows/*.yml .github/workflows/*.yaml)
if ((${#workflow_files[@]} == 0)); then
  printf 'No workflow files found in .github/workflows.\n' >&2
  exit 1
fi

"$actionlint" -shellcheck="$shellcheck" -pyflakes= -oneline "${workflow_files[@]}"
printf 'Checked %d workflow file(s) with actionlint %s and ShellCheck %s.\n' \
  "${#workflow_files[@]}" "$ACTIONLINT_VERSION" "$SHELLCHECK_VERSION"
