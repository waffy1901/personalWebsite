---
name: portfolio-release-qa
description: Portfolio release and pre-push QA for Waffy Ahmed's personalWebsite React/Vite portfolio. Use when Codex is asked to verify the site before push or deploy, install or update the pre-push checks, run lint/test/build, smoke-check core portfolio routes, validate resume/static assets, or review Netlify release readiness.
---

# Portfolio Release QA

## Quick Start

Resolve the repository root. The expected checkout contains `package.json`, `main/package.json`, `netlify.toml`, and `main/src`.

Run the hook-safe checks:

```bash
bash .codex/skills/portfolio-release-qa/scripts/portfolio_preflight.sh /path/to/personalWebsite
```

Use this script for pre-push hooks because it only runs lint, tests, and production build. Keep preview servers and network smoke checks out of the hook unless the user explicitly asks for a slower hook.

## Full Release Workflow

1. Check `git status --short` and identify unrelated user changes before editing.
2. Run `npm run lint`, `npm run test`, and `npm run build` from the repository root.
3. For deploy readiness, run `npm run preview` and smoke-check `/`, `/resume`, `/projects`, `/case-studies`, `/experience`, `/contact`, `/waffyAhmedResume.pdf`, `/llms.txt`, `/ai-summary.txt`, and `/portfolio.json`.
4. Inspect `netlify.toml` when headers, redirects, CSP, Formspree, GA4, or asset paths changed.
5. Use [references/release-checklist.md](references/release-checklist.md) for expected routes, artifacts, and command notes.

## Hook Policy

Prefer a local `.git/hooks/pre-push` hook that calls a tracked repo script. Do not put long logic directly in the hook. The hook should fail fast on lint, tests, or build failures and print the command to bypass only when the user explicitly asks.
