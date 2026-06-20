#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

cd "$repo_root"

echo "pre-push: running lint"
npm run lint

echo "pre-push: running tests"
npm run test

echo "pre-push: running production build"
npm run build

echo "pre-push: checks passed"
