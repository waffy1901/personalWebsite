#!/usr/bin/env bash
set -euo pipefail

repo_root="${1:-$(pwd)}"

cd "$repo_root"

if [[ ! -f "package.json" || ! -f "main/package.json" ]]; then
  echo "portfolio_preflight: expected personalWebsite repo root, got: $repo_root" >&2
  exit 2
fi

echo "portfolio_preflight: running lint"
npm run lint

echo "portfolio_preflight: running tests"
npm run test

echo "portfolio_preflight: running production build"
npm run build

echo "portfolio_preflight: passed"
