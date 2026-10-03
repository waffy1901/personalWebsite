#!/usr/bin/env bash
set -euo pipefail

readonly LYCHEE_VERSION="0.24.2"
readonly DOWNLOAD_ROOT="https://github.com/lycheeverse/lychee/releases/download/lychee-v${LYCHEE_VERSION}"

if (($# != 1)); then
  printf 'Usage: %s <output-directory>\n' "$0" >&2
  exit 2
fi

output_dir="$1"
case "$(uname -s):$(uname -m)" in
  Linux:x86_64|Linux:amd64)
    target="x86_64-unknown-linux-gnu"
    expected_sha256="1f4e0ef7f6554a6ed33dd7ac144fb2e1bbed98598e7af973042fc5cd43951c9a"
    ;;
  Linux:aarch64|Linux:arm64)
    target="aarch64-unknown-linux-gnu"
    expected_sha256="91a7bd65685da41b90ccb9bc867a3d649a7818042dae04ff405e55a25bddee4c"
    ;;
  Darwin:x86_64|Darwin:amd64)
    target="x86_64-apple-darwin"
    expected_sha256="887503a9cff667d322b8d0892b40bf49976eb9507af8483220a3706cdad55978"
    ;;
  Darwin:arm64|Darwin:aarch64)
    target="aarch64-apple-darwin"
    expected_sha256="c9d3740ea2d891854d37116c9fba840f37b6e7c89d330e7db84ac333631c4977"
    ;;
  *)
    printf 'Unsupported Lychee platform: %s/%s\n' "$(uname -s)" "$(uname -m)" >&2
    exit 1
    ;;
esac

for command_name in curl install tar; do
  if ! command -v "$command_name" >/dev/null 2>&1; then
    printf 'Required command is unavailable: %s\n' "$command_name" >&2
    exit 1
  fi
done

work_dir="$(mktemp -d "${TMPDIR:-/tmp}/personalWebsite-lychee.XXXXXX")"
trap 'rm -rf "$work_dir"' EXIT
archive="$work_dir/lychee.tar.gz"
asset="lychee-${target}.tar.gz"

curl --proto '=https' --tlsv1.2 --fail --silent --show-error --location \
  --retry 2 --retry-max-time 90 --connect-timeout 15 --max-time 90 \
  --output "$archive" "${DOWNLOAD_ROOT}/${asset}"

if command -v sha256sum >/dev/null 2>&1; then
  actual_sha256="$(sha256sum "$archive")"
elif command -v shasum >/dev/null 2>&1; then
  actual_sha256="$(shasum -a 256 "$archive")"
else
  printf 'A SHA-256 utility (sha256sum or shasum) is required.\n' >&2
  exit 1
fi
actual_sha256="${actual_sha256%% *}"
if [[ "$actual_sha256" != "$expected_sha256" ]]; then
  printf 'Lychee SHA-256 mismatch: expected %s, received %s\n' \
    "$expected_sha256" "$actual_sha256" >&2
  exit 1
fi

mkdir -p "$work_dir/extracted" "$output_dir"
tar -xzf "$archive" -C "$work_dir/extracted" "lychee-${target}/lychee"
install -m 0755 "$work_dir/extracted/lychee-${target}/lychee" "$output_dir/lychee"
"$output_dir/lychee" --version
