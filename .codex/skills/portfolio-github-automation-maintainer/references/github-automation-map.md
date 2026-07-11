# GitHub Automation Map

Use this reference for workflow, Dependabot, security automation, and GitHub run-diagnosis tasks in this repo.

## Current Automation

| Surface | File | Purpose | Key Notes |
| --- | --- | --- | --- |
| Main PR CI | `.github/workflows/dev-ci.yml` | Runs install, lint, tests, and build for PRs to `main`. | Uses Node `22.13.0`, `npm ci`, and `main/package-lock.json` cache path. |
| Portfolio integrity | `.github/workflows/portfolio-integrity.yml` | Checks generated public artifacts and focused content, resume, SEO, AI discovery, CSP, GA4, and performance policies on PRs. | Reuses repo-owned validators and intentionally leaves lint, tests, and build to the main PR CI workflow. |
| Deploy release | `.github/workflows/release-on-deploy.yml` | Verifies app, waits for Netlify production deploy for the pushed commit, validates deployed routes, then creates a GitHub release. | Requires `NETLIFY_AUTH_TOKEN` and `NETLIFY_SITE_ID`; derives canonical and legacy route coverage from `main/public/_redirects` and preserves the legacy Netlify-domain check. |
| npm audit | `.github/workflows/npm-audit.yml` | Runs `npm audit --audit-level=moderate` on dependency PRs, weekly, and manually. | A failure can be expected if known advisories are still unresolved; do not churn lockfiles unless dependency refresh is in scope. |
| Deployed headers | `.github/workflows/deployed-security-headers.yml` | Checks production security headers on `https://waffy.dev/`. | Preserve both the independent policy allowlist and the exact comparison with `netlify.toml`. |
| Netlify token reminder | `.github/workflows/netlify-token-rotation-reminder.yml` | Opens or updates one issue when the Netlify auth token approaches expiration. | `NETLIFY_AUTH_TOKEN_EXPIRES_AT` repository variable is the source of truth; `workflow_dispatch.expiration_date` intentionally overrides it for testing. |
| Auto assign PRs | `.github/workflows/auto-assign-prs.yml` | Assigns PRs to `waffy1901`. | Runs on `pull_request_target`; do not execute untrusted branch code here. |
| CodeQL | `.github/workflows/codeql.yml` | Runs JavaScript/TypeScript CodeQL analysis if checked in. | Check GitHub-managed code scanning/default setup before adding or changing duplicate CodeQL automation. |
| Dependabot | `.github/dependabot.yml` | Groups npm and GitHub Actions dependency updates. | Keep schedules timezone-aware and PR limits modest. |

## Safety Rules

- Use least-privilege `permissions` per workflow and job.
- Keep `actions/checkout` `persist-credentials: false` unless a job must push.
- Never print secrets, token values, or full authorization headers.
- Treat repository variables as non-secret metadata; treat repository secrets as opaque.
- For `pull_request_target`, avoid checking out or running code from the PR head unless there is a strong, reviewed reason.
- For Netlify automation, keep `NETLIFY_SITE_ID` and `NETLIFY_AUTH_TOKEN` distinct, and do not store token values in docs, issues, commits, or logs.

## Diagnosis Patterns

- Specific workflow run:

```bash
gh run view <run_id> --log
```

- Specific issue created by automation:

```bash
gh issue view <issue_number>
```

- Manual Netlify reminder tests:
  - `workflow_dispatch.expiration_date` overrides the repository variable.
  - `force_issue: true` is the clean way to test issue creation without pretending the real token expires early.
  - The workflow uses a marker comment so it updates one reminder issue instead of creating duplicates.

- `pull_request_target` failures:
  - The workflow definition comes from the base branch, usually `main`.
  - A PR can contain a fix while the check still uses stale base-branch YAML until merged.

## Verification Guidance

- For `.github/workflows/dev-ci.yml` or release verification changes, run the same root scripts locally when practical:

```bash
npm run lint
npm run test
npm run build
```

- For deployed header automation, keep `scripts/check-deployed-security-headers.py` aligned with intentional policy changes. Do not remove its independent minimum requirements merely because `netlify.toml` and production match.
- For dependency automation, separate updater config changes from dependency refresh PRs unless the user asks for both.
- For security feature requests, verify whether GitHub-managed secret scanning, push protection, Dependabot alerts, Dependabot security updates, and CodeQL/code scanning are already enabled before adding workflows.
