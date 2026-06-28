# Security Automation

Lightweight GitHub checks run alongside Codex and code review. They cover dependency freshness, npm vulnerability auditing, existing CodeQL analysis, secret scanning settings, and deployed security-header drift.

## Repo-Owned Checks

| Check | File | Cadence | Notes |
| --- | --- | --- | --- |
| Dependabot | `.github/dependabot.yml` | Weekly Monday | Opens grouped npm PRs for `/main` and grouped GitHub Actions update PRs. |
| npm audit | `.github/workflows/npm-audit.yml` | Dependency PRs, weekly, manual | Runs `npm ci` and `npm audit --audit-level=moderate` in `main/`. |
| Deployed headers | `.github/workflows/deployed-security-headers.yml` | Weekly, manual | Checks `https://waffy.dev/` for the expected CSP, X-Content-Type-Options, Referrer-Policy, and Permissions-Policy headers. |

## GitHub Settings Checklist

Secret scanning is enabled from GitHub repository settings, not from a workflow file. Keep these repository security features enabled:

- Secret scanning
- Push protection for secret scanning
- Dependabot alerts
- Dependabot security updates
- Code scanning alerts with the existing CodeQL default setup enabled for JavaScript and TypeScript

To verify the secret scanning settings, open the repository on GitHub, then go to **Settings > Advanced Security**. Enable **Secret Protection**, then enable **Push protection** inside the Secret Protection section.

CodeQL is already running through GitHub code scanning/default setup. Keep that existing setup enabled instead of adding a checked-in `.github/workflows/codeql.yml`, unless the default setup is disabled first. Running both would duplicate CodeQL analysis on pull requests.

For private or internal repositories, availability can depend on repository plan and GitHub security-product settings. These settings do not require any new repository secrets.

Reference:

- [Enable secret scanning](https://docs.github.com/en/code-security/how-tos/secure-your-secrets/detect-secret-leaks/enable-secret-scanning)
- [Enable push protection](https://docs.github.com/en/code-security/how-tos/secure-your-secrets/prevent-future-leaks/enable-push-protection)
- [Dependabot options reference](https://docs.github.com/en/code-security/reference/supply-chain-security/dependabot-options-reference)
- [CodeQL query suites](https://docs.github.com/en/code-security/concepts/code-scanning/codeql/codeql-query-suites)

## Header Verification Notes

`netlify.toml` remains the source of truth for production security headers. If the CSP in `netlify.toml` changes, update `.github/workflows/deployed-security-headers.yml` in the same change so the scheduled probe checks the deployed policy that should be live.

The deployed-header workflow intentionally runs against production, so it is scheduled and manual only. Use the manual run after security-header changes have deployed.
