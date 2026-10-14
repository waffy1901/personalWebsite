---
name: portfolio-audit-maintainer
description: Prepare and complete issue closeout for Waffy Ahmed's personalWebsite, including requests such as "close out the issue" and the handoff after linked deployment validation. Also use for quality findings, Portfolio Quality & Improvements project maintenance, evidence reconciliation, and historical audit consultation.
---

# Portfolio Quality Tracking Maintainer

## Issue Closeout

Own the full issue/project closeout, including ordinary implementation issues.
Read [references/closeout-readback.md](references/closeout-readback.md) for the
evidence packet, authorized writes, and independent persistence checks.

- When validation finishes for a linked issue, prepare its closeout packet and
  report readiness or missing evidence as part of that handoff. Reuse verified
  evidence from the active workflow, refreshing drift-prone state as needed.
- A direct "close out the issue" instruction authorizes closeout when the active
  conversation identifies one unambiguous issue. Resolve the exact target from
  that context; do not require the literal `CLOSE_WORK_ITEM` token or another
  confirmation. Ask for the target only when context leaves it ambiguous.
- Within that grant, post and read back the evidence, update supported acceptance
  checkboxes, close with the appropriate reason, synchronize the existing Project
  2 item, and independently verify the final issue, comment, and project values.
  Preserve unrelated issue metadata and project fields.
- Preparing a packet is read-only. Implementation, merge, or "validate" alone
  does not authorize posting it, completing criteria, closing the issue, or
  changing project fields. Report the prepared packet and remaining grant once.
- Keep partial criterion completion scoped to the named criteria. Do not close
  the whole issue or set its item to Done while its closure contract is unmet.

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
7. Reconcile before changing status. Follow the closeout reference and the closure contract in the repository policy:
   - Close an issue only when its acceptance criteria and evidence contract are
     satisfied and a direct human grant names the exact target. Prepare the evidence packet before acting on that grant.
   - Keep historical context in the issue, PR, release, or archived audit; do
     not present fixed production issues as current.
   - Separate true breakage from low-severity caveats, investigations, and
     product hypotheses.
   - After authorized writes, independently read back the evidence comment, issue body/checklist and metadata, state/reason, assignment, Project 2 membership, and every relevant field. A mutation response is not persistence proof. The helper verifies state/assignment/project values; compare the comment and issue body/metadata separately as described in the reference.
8. Use adjacent skills for specialized evidence:
   - `$portfolio-deployment-verifier` for exact production SHA, published deploy, workflow, and deploy-release provenance.
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
production behavior changed. For closeout, link the issue and evidence comment,
report its final state/reason and Project 2 status, and state whether independent
readback passed. Report partial completion or mismatches explicitly.
