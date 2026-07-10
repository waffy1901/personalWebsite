---
name: portfolio-audit-maintainer
description: Repository audit maintenance for Waffy Ahmed's personalWebsite. Use when Codex updates, reconciles, or reviews docs/personal-website-repository-audit.md, documents deployed validation findings, reclassifies audit caveats versus real issues, preserves provenance such as creation dates and PR numbers, or aligns audit findings with current production, preview, route, SEO, security, analytics, performance, or content evidence.
---

# Portfolio Audit Maintainer

## Workflow

1. Check `git status --short` before editing the audit.
2. Identify the evidence type:
   - Source audit evidence from the repo.
   - Local build/test evidence.
   - Deploy-preview or production HTTP evidence.
   - Browser QA evidence, including possible GA4 side effects.
   - Follow-up PRs, issues, or releases that resolved older findings.
3. Read [references/audit-map.md](references/audit-map.md) before changing `docs/personal-website-repository-audit.md`.
4. Preserve exact provenance. Keep supplied dates, PR numbers, issue numbers, commit hashes, URLs, and validation dates exact.
5. Reconcile before appending:
   - Mark resolved items as resolved when current evidence supports it.
   - Keep historical findings if they explain the audit trail, but do not present fixed production issues as current.
   - Separate true breakage from low-severity caveats or nitpicks.
6. Use adjacent skills for specialized evidence:
   - `$seo-spa-auditor` for route metadata, redirects, sitemap, robots, and crawler-visible HTML.
   - `$ai-discovery-maintainer` and `$portfolio-content-sync` for public AI/content surfaces.
   - `$resume-site-sync` for resume PDF and preview evidence.
   - `$csp-security-header-maintainer` for CSP and security headers.
   - `$ga4-portfolio-analytics` when analytics behavior or browser-QA traffic is discussed.
   - `$portfolio-performance-auditor` for image loading, route lazy loading, or layout/performance follow-ups.
7. Validate Markdown edits with `git diff --check`. Run broader repo checks only when code, generated artifacts, public content, routes, CSP, analytics, or build behavior changed.

## Reporting

Summarize what audit sections changed, what evidence supports the change, and what was intentionally left historical. Mention browser QA GA4 side effects when relevant.
