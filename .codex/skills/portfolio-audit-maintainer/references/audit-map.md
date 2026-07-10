# Audit Map

Use this reference when maintaining `docs/personal-website-repository-audit.md`.

## Audit Structure

- Header metadata:
  - Repository name.
  - Baseline commit or branch.
  - Reconciled PRs or comparison point.
  - Website creation date. Preserve exact supplied provenance such as `Sep 12, 2024 at 2:17 PM`.
  - Audit scope.
- Overall assessment:
  - Keep high-level health and highest-value follow-up themes current.
  - Avoid overstating resolved issues.
- Post-deploy validation addendum:
  - Use only real deploy-preview or production evidence.
  - Include validation date, target URL, relevant PRs, status-code behavior, route/browser behavior, public assets, and security headers.
- Resolved sections:
  - Move or mark findings resolved when follow-up PRs and validation prove the issue is fixed.
  - Preserve why the item mattered originally.
- Findings and follow-up work:
  - Keep unresolved findings actionable, scoped, and supported by current evidence.

## Evidence Standards

- Production or deploy-preview claims need authoritative live evidence from the final URL, not local assumptions.
- For 404 checks, avoid `curl -f` so the body remains inspectable for `noindex, nofollow`.
- For crawler-visible metadata, inspect initial HTML and generated prerender shells, not only browser-updated document state.
- Derive expected route metadata from `main/src/data/seo.js` where possible.
- Browser QA against `waffy.dev` can create GA4 page views/users. `curl`, Node HTTP checks, Dependabot, CodeQL, and `npm audit` do not run the site in a browser and should not affect GA4.
- If sandbox/network limits block live evidence, say exactly which claims remain unverified.

## Classification Guidance

- Treat build failures, broken canonical routes, missing public assets, incorrect 404 status, blocked required analytics/form connections, and crawler-visible metadata regressions as real issues.
- Treat trailing-slash canonical differences, legacy lowercase resume PDF canonicalization, minor mobile nav scrolling, and noisy but non-blocking console output as lower severity unless fresh evidence shows user impact.
- Do not treat pre-PR129 deep-route homepage metadata findings as current without fresh validation; keep them as historical context if the audit trail needs them.

## Edit Checklist

1. Search the audit for duplicate or stale versions of the finding.
2. Update the section that owns the current truth instead of appending a contradictory note.
3. Preserve exact dates, PR numbers, issue numbers, URLs, and commands.
4. Keep recommendations tied to concrete files or deployed routes.
5. Run:

```bash
git diff --check
```

Run route/content/security/performance skills when those surfaces changed, and record skipped checks in the final response.
