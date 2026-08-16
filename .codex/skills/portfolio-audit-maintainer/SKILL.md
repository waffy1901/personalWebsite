---
name: portfolio-audit-maintainer
description: Portfolio quality tracking and historical audit maintenance for Waffy Ahmed's personalWebsite. Use when Codex creates, updates, validates, or closes quality findings; maintains the GitHub Portfolio Quality & Improvements project; records deployed evidence; classifies caveats versus actionable issues; or consults the archived repository audit.
---

# Portfolio Quality Tracking Maintainer

## Workflow

1. Check `git status --short` and preserve unrelated changes.
2. Read `docs/quality-and-verification-policy.md` and
   [references/tracking-map.md](references/tracking-map.md).
3. Search open and closed repository issues before creating or reopening a
   finding. Use one durable issue per finding and retain stable `F-XXX` IDs.
4. Keep active work in the
   [Portfolio Quality & Improvements project](https://github.com/users/waffy1901/projects/2).
   Do not use project-only draft items for actionable findings.
5. Identify the evidence type:
   - Source audit evidence from the repo.
   - Local build/test evidence.
   - Deploy-preview or production HTTP evidence.
   - Browser QA evidence, including possible GA4 side effects.
   - Follow-up PRs, issues, or releases that resolved older findings.
6. Preserve exact provenance in the issue. Keep dates, PR and issue numbers,
   commit hashes, deploy tags, workflow IDs, URLs, evidence classes, and
   telemetry boundaries exact.
7. Reconcile before changing status:
   - Close an issue only when its acceptance criteria and evidence contract are
     satisfied.
   - Keep historical context in the issue, PR, release, or archived audit; do
     not present fixed production issues as current.
   - Separate true breakage from low-severity caveats, investigations, and
     product hypotheses.
8. Use adjacent skills for specialized evidence:
   - `$seo-spa-auditor` for route metadata, redirects, sitemap, robots, and crawler-visible HTML.
   - `$ai-discovery-maintainer` and `$portfolio-content-sync` for public AI/content surfaces.
   - `$resume-site-sync` for resume PDF and preview evidence.
   - `$csp-security-header-maintainer` for CSP and security headers.
   - `$ga4-portfolio-analytics` when analytics behavior or browser-QA traffic is discussed.
   - `$portfolio-performance-auditor` for image loading, route lazy loading, or layout/performance follow-ups.
9. Never update
   `docs/audit-archive/personal-website-repository-audit-2026-08-15.md`; it is
   an immutable historical snapshot.
10. Validate Markdown or issue-template edits with `git diff --check`. Run
    broader repo checks only when code, generated artifacts, public content,
    routes, CSP, analytics, or build behavior changed.

## Reporting

Summarize which issues or project fields changed, what evidence supports the
change, and what remains unverified. Mention browser QA GA4 side effects when
relevant. If only documentation or tracking changed, say that no application or
production behavior changed.
