# Quality Tracking Map

Use this reference when maintaining portfolio quality issues, the GitHub
project, or their evidence.

## Tracking Structure

- GitHub issue:
  - Stable `F-XXX` ID and concise title.
  - Problem, impact, severity, priority, area, and affected surfaces.
  - Dated evidence and evidence class.
  - Testable acceptance criteria and closure verification.
  - Links to related PRs, releases, workflows, and external evidence.
- GitHub project:
  - Status communicates workflow state.
  - Priority communicates scheduling rather than impact.
  - Severity communicates impact rather than scheduling.
  - Area and evidence-needed fields support filtered views.
- Repository policy:
  - Contains stable classification, evidence, telemetry, and closure rules.
  - Contains no changing finding totals, priorities, or release status.
- Archived audit:
  - Preserves the final file-based baseline and prior release chronology.
  - Is never updated after migration.

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

## Maintenance Checklist

1. Search open and closed issues for duplicates or earlier evidence.
2. Update the issue that owns the finding instead of creating a contradictory
   draft or documentation note.
3. Keep the issue and project status aligned.
4. Preserve exact dates, PR numbers, issue numbers, commit hashes, deploy tags,
   workflow IDs, URLs, commands, and telemetry boundaries.
5. Keep acceptance criteria tied to concrete files, settings, or deployed routes.
6. Close only after the required evidence is linked or recorded.
7. For repository documentation or template edits, run:

```bash
git diff --check
```

Run route/content/security/performance skills when those surfaces changed, and
record skipped checks in the final response.
