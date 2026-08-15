# Personal Website Repository Audit

**Repository:** `waffy1901/personalWebsite`  
**Baseline reviewed:** `main` at `4f05b954309f7f6117549fee9d9537eab8014367`  
**Reconciled through:** PRs #158, #157, and #156 at current `main` commit `8ab5889bbaad94a1462c6e4b08d3140f57f4ae21`, plus the F-014, F-002, and F-001 remediations on `feat/audit-remediation`<br>
**Current production release:** `deploy-20260811T011448Z-8ab5889`, release workflow `31448668753`; exact-commit Netlify readiness, app verification, deployed-route checks, and the legacy-domain redirect check passed<br>
**Latest independently maintained full deployed audit:** Aug 1, 2026, at `d3886ac6a8e07b1013867bed25971ca9986c1033`, release `deploy-20260801T170233Z-d3886ac`  
**Latest supplied external audit:** Aug 8, 2026, against the PR #154 release  
**Website creation date:** Sep 12, 2024 at 2:17 PM (`2024-09-12T14:17:00-04:00`)  
**Scope:** Application code and content, accessibility, dependencies, tests, GitHub automation, Netlify delivery, public metadata, analytics, privacy, and resume assets.

This is the canonical current-state audit. Git history, pull requests, workflow
runs, and release tags preserve the detailed chronology; this file retains only
the evidence needed to understand current risk, close open findings, and avoid
reopening verified work.

## Current Assessment

The portfolio is production-ready and in good engineering shape. No Critical or
High production issue is known. Canonical routes, real 404 behavior,
route-specific initial metadata, generated public artifacts, resume delivery,
security headers, and core desktop/mobile rendering were healthy at the current
release snapshot.

The maintained set contains **14 open findings: 1 Medium, 10 Low, and 3
Informational**. The highest-value work is concentrated in accessibility,
delivery governance, asset optimization, and GA4 measurement quality.

The Aug 11 PR #156 release kept the production and full repository dependency
audits clean. The current feature-branch cleanup resolves F-014 by deleting the
obsolete dev-only advisory exception, so every future moderate-or-higher
full-tree finding blocks directly. This policy simplification is pending merge and
deployment; the production checker still contains the dormant exception branch,
which has no effect while the dependency graph is clean.

The current feature-branch frontend work resolves F-002 with WCAG AA contrast
tokens and dark-surface variants, then resolves F-001 with focused lazy-route
recovery that preserves navigation and offers retry and home actions. These changes are not
yet merged or deployed.

Current strengths include pull-request lint/test/build checks, focused portfolio
integrity validation, scheduled npm audit and CodeQL, deployment-to-commit
verification, route and real-404 checks, weekly header checks, source-generated
AI/SEO artifacts, React route splitting, and analytics contract tests.

## Evidence Boundary

- The Aug 1 independently maintained pass included exact-tree clean-room checks,
  production HTTP/header inspection, and production Chromium QA at desktop and
  mobile widths. Its browser work generated GA4 traffic.
- The Aug 8 PR #154 reconciliation independently confirmed release provenance,
  source/static contracts, the dependency-policy result, and read-only live HTTP
  behavior. The newer browser observations are supplied external evidence and
  may have generated production GA4 traffic.
- The Aug 9 PR #155 release workflow verified the exact production commit,
  lint/tests/build, deployed routes, the real 404, and the legacy-domain
  redirect. The PR checks and current local audit confirmed the cleaned
  dependency graph. No fresh browser or full live-header pass was performed.
- The Aug 11 PR #158 release aligned trailing-slash canonical routes and passed
  exact-commit production route, redirect, real-404, and legacy-domain checks at
  `681f10e9d9dd6779f8f92a37a8df14294230121e` in workflow `31447166391`.
- The Aug 11 PR #156 release at
  `8ab5889bbaad94a1462c6e4b08d3140f57f4ae21` includes the PR #157 GitHub
  Actions update and the PR #156 development-dependency refresh. Workflow
  `31448668753` passed exact-commit app and route verification; the superseded
  PR #157 release run `31447799817` was cancelled.
- The current feature-branch F-014 cleanup is supported by production and
  full-tree `npm audit` results plus static script validation. It does not
  execute the production site or create GA4 traffic and remains pending merge and release.
- The current feature-branch F-002 and F-001 remediations passed lint, 30
  tests, the production build, focused performance checks, and local Chromium
  inspection at 1440px and 390px. GA4 was disabled for browser QA, no contact form was
  submitted, and no production or deployed-route claim is made.
- HTTP, source, build, npm, and workflow checks do not execute the production
  site JavaScript and should not create GA4 page views.
- This audit does not establish current Safari/Firefox parity, Lighthouse, field
  Core Web Vitals, pixel-level visual regression, authenticated Formspree or
  Netlify account state, or a real contact-form submission.
- Repository configuration cannot prove GA4 Admin, Search Console, link-preview
  cache, or Formspree account settings. Those claims require dated external
  evidence.

## Current Findings

### F-003 — Resume PDF lacks structural accessibility (Medium)

The canonical PDF renders and links correctly but is untagged, has no document
language or structure tree, has blank descriptive metadata, and extracts some
words unreliably. Regenerate it with semantic structure, verified reading order,
language and document metadata, and descriptive links. Prefer an equivalent HTML
resume if both outputs can share a canonical content source, and extend the
resume validator beyond file presence.

**Surfaces:** `main/public/waffyAhmedResume.pdf`, `main/src/pages/Resume.jsx`

### F-004 — Route transitions preserve stale scroll and focus (Low)

Forward navigation can open the destination far down the page while focus
remains on the prior navigation control. Add deliberate forward-navigation
scroll reset and focus movement to a focusable `main` or route heading while
preserving browser back/forward restoration. Cover the behavior in a browser-
level route test.

**Surfaces:** `main/src/App.jsx`, `main/src/components/Navbar.jsx`, `main/src/components/MissionControl.jsx`

### F-005 — Mobile navigation focus can remain clipped (Low)

At 390 px, keyboard focus can reach the offscreen Contact link without changing
the horizontally scrollable navigation's `scrollLeft`, leaving the target and
focus ring partly clipped. Scroll focused links fully into view, expose a clear
overflow affordance, or revise the layout so all destinations remain visible.

**Surface:** `main/src/components/Navbar.jsx`

### F-006 — `main` quality gates are not enforced (Low)

As of Aug 8, `main` had no branch protection or repository ruleset. Direct
pushes can bypass pull-request-only portfolio integrity and npm-audit checks,
and Netlify may deploy before post-push verification finishes. Require pull
requests and the app, portfolio-integrity, npm-audit, and CodeQL checks; block
force pushes and deletion; and decide explicitly whether the solo owner is
exempt.

**Surfaces:** GitHub repository rules, `.github/workflows/`

### F-007 — Dependabot security features are disabled (Low)

Vulnerability alerts, security updates, and automated security fixes were
disabled while version updates and scheduled/pull-request npm audits remained
active. Enable alerts and security-update pull requests without removing the
existing version-update and audit coverage. This is monitoring hardening, not
evidence of a production vulnerability.

**Surfaces:** GitHub security settings, `.github/dependabot.yml`, `.github/workflows/npm-audit.yml`

### F-008 — Release creation omits live header verification (Low)

The release workflow waits for the exact Netlify deploy and validates routes,
the real 404, and the legacy domain, but the deployed security-header check runs
only weekly or manually. Run the header-checker tests, CSP/JSON-LD hash check,
and live deployed-header check after the exact deploy wait and before creating
the release.

**Surfaces:** `.github/workflows/release-on-deploy.yml`, `.github/workflows/deployed-security-headers.yml`, `scripts/check-deployed-security-headers.py`

### F-009 — Prerendered route shells omit route body content (Low)

Generated deep-route HTML contains route-specific metadata but an empty React
root. Non-JavaScript crawlers, AI fetchers, and users cannot read the visible
route body from the shell. JSON-LD, the sitemap, and public AI-discovery files
substantially mitigate discovery risk. Full static body rendering remains an
architectural improvement, not a release requirement.

**Surfaces:** `main/scripts/prerender-route-metadata.mjs`, `main/index.html`, `main/src/data/seo.js`

### F-010 — AI-readable outputs include website implementation detail (Low)

Generated AI surfaces are synchronized, but they still emphasize frontend,
testing, analytics, Formspree, and deployment implementation details that dilute
the intended platform, reliability, Kubernetes, observability, and production-
ownership narrative. Keep professional routes and discovery links while moving
site internals to developer documentation unless they directly support the
portfolio story.

**Surfaces:** `main/scripts/generate-public-artifacts.mjs`, `main/public/ai-summary.txt`, `main/public/portfolio.json`, `main/public/llms.txt`

### F-015 — GA4 SPA transitions emit paired page views (Low)

The Aug 1 production browser pass on
`deploy-20260801T170233Z-d3886ac` observed 25 GA collection requests, 22 named
`page_view`; several SPA transitions produced one manual pathname-only request
and a second automatic/history request. Keep the privacy-preserving manual
tracker and choose one page-view owner, normally by disabling GA4 Enhanced
Measurement history page views. Then verify exactly one request for initial load
and each SPA transition, including a URL with a query string and fragment.

**Surfaces:** `main/src/utils/analytics.js`, `main/src/hooks/usePageTracking.jsx`, `main/src/App.test.jsx`, GA4 Enhanced Measurement settings

### F-016 — Repeated navigation lacks a keyboard bypass and footer landmark (Low)

There is no skip link, and supplied Aug 8 keyboard evidence counted seven Tab
stops before the first main-content control. The Home-only footer is nested
inside `PageShell`'s `<main>`, so it is not exposed as document-level
`contentinfo`. Add a visible-on-focus skip link to a stable focusable target and
move or split site-wide footer content outside the main landmark, then test the
keyboard and landmark structure.

**Surfaces:** `main/src/App.jsx`, `main/src/components/Navbar.jsx`, `main/src/components/MissionControl.jsx`, `main/src/components/DeployDates.jsx`, `main/src/pages/Home.jsx`

### F-017 — Large root images add transfer and preview risk (Low)

At PR #154, `og-image-v2.png` is 1,147,212 bytes,
`resume-preview.png` is 568,825 bytes, and the source profile image is 210,685
bytes. Re-encode the canonical 1200 by 630 Open Graph image, generate suitable
WebP/AVIF rendered-image variants with fallbacks, test real high-value link
previews, and add an image-byte budget. The supplied WhatsApp cutoff claim was
not independently reproduced or supported by an authoritative limit, so it is
not recorded as a confirmed failure.

**Surfaces:** `main/public/og-image-v2.png`, `main/public/resume-preview.png`, `main/src/images/profilePic.jpg`, `main/src/data/seo.js`, `main/index.html`

### F-011 — Hashed assets revalidate in browsers (Informational)

Current production JavaScript, CSS, and content-hashed profile-image responses
use `Cache-Control: public,max-age=0,must-revalidate`. Delivery is correct, but
repeat visits may incur validation round trips. If worthwhile, add an immutable
policy only for content-hashed `/assets/*` files while keeping HTML and mutable
root assets revalidated.

**Surface:** `netlify.toml`

### F-012 — Actions immutability and least privilege can improve (Informational)

Workflows use mutable tags including `actions/checkout@v7`,
`actions/setup-node@v7`, `actions/github-script@v9`, and
`github/codeql-action/*@v4.37.4`. CodeQL also retains avoidable read permissions
and checkout credentials. Consider full-SHA pinning with version comments,
remove unused CodeQL grants, and set `persist-credentials: false` where write
access is unnecessary. Existing publishers, narrow permissions, Dependabot
coverage, and clean CodeQL results keep this as hardening rather than a defect.

**Surfaces:** `.github/workflows/`, `.github/dependabot.yml`

### F-013 — Analytics and form processing need an explicit privacy decision (Informational)

PR #139 removed query strings and fragments from manual GA4 page-view fields;
the fix deployed at `4089f8d7e9d812b0bda194e034a28bcbe26d418f` in
`deploy-20260715T222758Z-4089f8d`, workflow `29455441731`. The broader
disclosure/consent decision remains open. Supplied Aug 8 browser evidence also
showed `stats.g.doubleclick.net/g/collect` blocked by CSP while core GA4 requests
were delivered. Disable Google Signals if that enrichment is not wanted; allow
the host only as an explicit, documented privacy expansion. Add a concise
GA4/Formspree disclosure and verify account-side redaction and consent settings
with dated evidence.

**Surfaces:** `main/src/utils/analytics.js`, `main/src/hooks/usePageTracking.jsx`, `main/src/components/ContactForm.jsx`, `docs/analytics.md`, GA4 Admin

## Non-Finding Maintenance and External Checks

These items remain useful but should not be promoted into new findings without
fresh evidence of user impact:

- `/waffyahmedresume.pdf` still serves the correct PDF with HTTP 200 instead of
  redirecting to canonical `/waffyAhmedResume.pdf`.
- Rendered images still benefit from intrinsic dimensions or stable aspect
  ratios, and the repository has no bundle/Lighthouse budget. Current browser
  evidence did not show a layout or bundle regression.
- `DeployDates.jsx` still opens `https://chat.openai.com/?q=...` and relies on a
  redirect to `chatgpt.com`; update the host when touching that launcher.
- Review Formspree spam, rate-limit, retention, and monitoring settings at the
  account level before adding CDN/WAF controls.
- Record dated external evidence for Search Console ownership/sitemap state,
  high-value link previews, GA4 key-event classifications, and the GA4 Admin
  settings relevant to F-013 and F-015.
- Card hierarchy, case-study tradeoff narratives, and explicit
  `OwnershipCard` disclosure controls remain product hypotheses, not confirmed
  defects.

## Resolution and Release Milestones

This compact record prevents closed work from being reopened while leaving the
full chronology to GitHub and Git history.

| Date | Change | Durable result |
| --- | --- | --- |
| Jun 2026 | PR #125 | Contact form resilience/accessibility, card controls, copy corrections, metadata, and tests. |
| Jun 2026 | PRs #127 and #128 | Wording and documentation fixes, clipboard accessibility, manifest refresh, CSP/HSTS hardening, and real 404 responses. |
| Jul 2026 | PR #129 | Route-specific initial metadata shells. |
| Jul 2026 | PRs #134, #135, and #136 | Route splitting and image loading policy; trailing-slash hydration fix; exact source-derived metadata gates and deployed-route automation. |
| Jul 15, 2026 | PR #139, `4089f8d7e9d812b0bda194e034a28bcbe26d418f`, `deploy-20260715T222758Z-4089f8d` | Manual GA4 page views exclude query strings and fragments. |
| Jul 16-18, 2026 | PRs #140 and #142 | Exact supplied creation date and Tailwind CSS 4 migration. |
| Jul 30, 2026 | PR #149, `012eb6977b36ca4868be3d1db6561eadafd71468`, `deploy-20260730T031752Z-012eb69` | Production dependency remediation, Node 22.22.0 alignment, React Router 8.3.0, and the repository-owned npm-audit policy. |
| Aug 1, 2026 | PRs #145, #146, and #148, `d3886ac6a8e07b1013867bed25971ca9986c1033`, `deploy-20260801T170233Z-d3886ac` | Dependency updates with clean exact-tree, HTTP/header, bundle, and desktop/mobile Chromium verification; F-015 identified separately. |
| Aug 5, 2026 | PRs #152 and #150, `281df64bdc16c6163dd7d089936e2fe36d982e5a`, `deploy-20260805T232342Z-281df64`, workflow `31056160538` | CodeQL 4.37.4 and Vite tooling updates; the release workflow validated production routes and redirects, but no independent full header/browser pass was performed. |
| Aug 8, 2026 | PR #154, `06b962eca05c4f80519a35be30cb1f24ef1f70a9`, `deploy-20260808T173357Z-06b962e`, workflow `31269705120` | Portfolio/resume/public-artifact refresh; current source, HTTP, and release provenance verified. F-016 and F-017 were added from reconciled external evidence. |
| Aug 9, 2026 | PR #155, `a314d2bfa9ce101e836353c9c668696d4d672d50`, `deploy-20260809T153725Z-a314d2b`, workflow `31321568112` | Upgraded jsdom and aligned the Node runtime; the full dependency audit is clean, exact-commit production route/redirect validation passed, and F-014 now remains only as obsolete exception cleanup. |
| Aug 11, 2026 | PR #158, `681f10e9d9dd6779f8f92a37a8df14294230121e`, `deploy-20260811T004705Z-681f10e`, workflow `31447166391` | Aligned canonical URLs, redirects, the sitemap, generated artifacts, and internal links on trailing-slash route URLs; exact-commit route, redirect, real-404, and legacy-domain validation passed. |
| Aug 11, 2026 | PRs #157 and #156, `8ab5889bbaad94a1462c6e4b08d3140f57f4ae21`, `deploy-20260811T011448Z-8ab5889`, workflow `31448668753` | Updated CodeQL Actions and lockfile-only development dependencies; the final release superseded PR #157's cancelled release run and kept the full dependency audit clean. |
| Aug 11, 2026 | `feat/audit-remediation`, pending merge and release | Removed the obsolete dev-only npm-audit exception so all future moderate-or-higher full-tree findings block directly; production and full-tree audits pass. F-014 is resolved on the feature branch. |
| Aug 13, 2026 | `feat/audit-remediation`, pending merge and release | Remediated F-002 shared contrast states and added F-001 lazy-route recovery; lint, 30 tests, production build, focused performance checks, and analytics-disabled Chromium QA at 1440px and 390px passed. |

## Recommended Execution Order

1. Add a skip link and correct the footer landmark, then address route
   scroll/focus and clipped mobile-nav focus (F-016, F-004, F-005).
2. Regenerate the tagged resume and optimize root image assets with byte and
   accessibility checks (F-003, F-017).
3. Protect `main`, enable Dependabot security features, and add live header
   checks to release creation (F-006, F-007, F-008).
4. Resolve duplicate GA4 history page views and make the Google Signals,
   disclosure, and consent choices explicit (F-015, F-013).
5. Refocus AI outputs on professional evidence (F-010); treat static route-body
   rendering, immutable caching, and workflow hardening as lower-priority
   architectural improvements (F-009, F-011, F-012).

## Audit Maintenance Rule

Update the section that owns current truth instead of appending a dated
narrative. When a finding closes, remove it from **Current Findings** and add one
concise milestone row with its PR/release provenance. Keep source, local build,
production HTTP, browser, and external-account evidence distinct. Browser QA
against `waffy.dev` may create GA4 traffic; read-only HTTP checks do not.
