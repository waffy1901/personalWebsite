---
name: portfolio-github-automation-maintainer
description: GitHub automation maintenance for Waffy Ahmed's personalWebsite. Use when Codex changes or reviews GitHub Actions workflows, Dependabot configuration, CodeQL or security scanning setup, npm audit automation, Netlify token rotation reminders, deployed-header checks, release-on-deploy automation, auto-assignment, or GitHub-managed security-feature overlap.
---

# Portfolio GitHub Automation Maintainer

## Workflow

For failing or delayed runs, use `$portfolio-actions-run-diagnoser` first. This skill owns workflow changes and repository automation policy.

1. Check `git status --short` before editing and treat unrelated app changes as user-owned.
2. Identify the automation surface:
   - `.github/workflows/dev-ci.yml`: PR lint/test/build gate.
   - `.github/workflows/portfolio-integrity.yml`: PR validation of generated public artifacts and focused portfolio invariants.
   - `.github/workflows/release-on-deploy.yml`: production deploy wait and GitHub release creation.
   - `.github/workflows/semantic-release.yml`: manually dispatched, SHA-bound semantic production release publication.
   - `.github/workflows/npm-audit.yml`: dependency vulnerability audit.
   - `.github/workflows/deployed-security-headers.yml`: live `waffy.dev` header drift check.
   - `.github/workflows/netlify-token-rotation-reminder.yml`: token-expiry issue automation.
   - `.github/workflows/auto-assign-prs.yml`: `pull_request_target` assignment.
   - `.github/dependabot.yml`: npm and GitHub Actions update grouping.
   - `.github/workflows/codeql.yml`: checked-in CodeQL analysis, if enabled.
3. Read [references/github-automation-map.md](references/github-automation-map.md) before changing workflow behavior, permissions, schedules, secrets, repository variables, or security automation.
4. Prefer repo-owned automation only when it adds value beyond GitHub-managed features. Check existing secret scanning, push protection, Dependabot alerts, Dependabot security updates, and CodeQL/code scanning before adding duplicates.
5. Keep permissions minimal, avoid secret exposure, and keep `pull_request_target` jobs free of untrusted checkout or script execution.
6. Run narrow verification first:
   - `npm run lint:workflows` for edits to `.github/workflows/*.yml` or `*.yaml`, including permissions, schedules, and action pins. Follow `docs/workflow-lint.md` if tools need setup. Use focused documentation checks for prose-only changes.
   - `npm run lint`, `npm run test`, and `npm run build` when workflow changes mirror app CI.
   - `npm audit --audit-level=moderate` only when dependency/audit behavior is in scope.
7. For publish or release readiness, hand off to `$portfolio-release-qa` or `$git-pr-publisher` as appropriate.

## Reporting

Explain whether failures are real regressions, expected known advisory noise, base-branch workflow artifacts, manual-dispatch override behavior, or GitHub settings gaps. Include exact workflow names, run IDs, issue/PR numbers, and commands used when available.
