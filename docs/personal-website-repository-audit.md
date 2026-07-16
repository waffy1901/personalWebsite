# Personal Website Repository Audit

**Repository:** `waffy1901/personalWebsite`  
**Baseline reviewed:** `main` at `4f05b954309f7f6117549fee9d9537eab8014367`  
**Reconciled through:** PR #139 (`feat/ga4-privacy-audit-reconciliation`) at merge commit `4089f8d7e9d812b0bda194e034a28bcbe26d418f`, including PR #137 (`dependabot/npm_and_yarn/main/development-dependencies-7a15a521a3`), PR #136 (`feat/portfolio-metadata-automation-hardening`), PR #135 (`feat/route-metadata-integrity`), PR #134 (`feat/portfolio-performance-security-automation`), PR #131 (`feat/generate-public-artifacts`), and PR #129 (`prerenderRouteMetadata`)<br>
**Latest audit pass:** Jul 15, 2026 post-deploy validation of PR #139 on `main` at `4089f8d7e9d812b0bda194e034a28bcbe26d418f`, production release `deploy-20260715T222758Z-4089f8d`, GitHub Actions run `29455441731`, independent production HTTP and bundle inspection, and user-supplied GA4 Admin redaction-preview evidence; no production browser was used<br>
**Website creation date:** Sep 12, 2024 at 2:17 PM<br>
**Audit scope:** React application, content and data modules, tests, dependencies, Netlify configuration, public metadata, accessibility and interaction failure paths, resume PDF structure, security controls, and GitHub settings and Actions.

> This began as a source and configuration audit, not a browser-based Lighthouse
> or visual-regression run. The post-deploy addendum records later live
> production validation, and resolved items are marked as such where follow-up
> PRs addressed them. The Jul 12 re-audit adds focused local browser,
> failure-path, keyboard, and PDF evidence, but still does not include Lighthouse
> or automated visual regression.

---

## Overall Assessment

The portfolio is in **good engineering shape and remains production-ready**. It
presents a distinctive, recruiter-oriented platform and reliability narrative
while also demonstrating meaningful engineering discipline through automated
testing, dependency scanning, CodeQL, deployment validation, analytics, and
structured data.

No obvious build-breaking or critical security issue was found. The original
crawler-visible route-metadata gap and the later trailing-slash hydration
regression are resolved. PR #135 is merged, deployed, and production-browser
verified. PR #136 is also merged and deployed, and its exact metadata gate is
active. Pull-request automation exercises the checker with offline fixtures and
route-inventory validation; release automation applies the exact checks to the
deployed site.
PR #137 changed only development-tool lockfile entries; the exact merge commit
is deployed, and the Node 22 release workflow, production route contract, and
production security headers pass.
PR #139 is also merged and deployed. Its manual GA4 page views now exclude
query strings and fragments, and the exact deployed bundle plus release-time and
independent HTTP checks confirm the production change without generating a
browser-based GA4 session.

No Critical or High issue was found. The highest-value remaining work is a
focused accessibility and resilience backlog:

1. Correct repeated normal-text contrast failures and add route-level
   accessibility checks.
2. Add lazy-route chunk failure recovery so a rejected secondary-route import
   cannot blank the application.
3. Replace the canonical resume with a tagged, metadata-complete PDF and, if
   feasible, provide an equivalent HTML resume.
4. Add deliberate route scroll/focus management and keep keyboard-focused
   mobile navigation destinations visible.
5. Strengthen delivery governance and monitoring by protecting `main`, enabling
   Dependabot vulnerability alerts/security updates, and running live header
   validation before release creation.

---

## Post-Deploy Validation Addendum

- **Validation date:** Jun 30, 2026
- **Production URL:** `https://waffy.dev/`
- **Relevant follow-up PRs:** PR #127 (`feat/trust-metadata-a11y-polish`) and PR #128 (`feat/real-404-routing`)

The deployed site remains user-functionally healthy after the trust, metadata,
accessibility, security-header, and real-404 work:

- Canonical app routes returned HTTP 200 and rendered in the browser: `/`,
  `/projects`, `/experience`, `/case-studies`, all three case-study detail
  routes, `/resume`, and `/contact`.
- Unknown routes now return a genuine HTTP 404 and serve the static 404 page.
  The deployed 404 HTML includes `noindex, nofollow` and canonicalizes to
  `https://waffy.dev/`.
- Legacy uppercase app routes such as `/Projects`, `/Resume`, `/Contact`,
  `/Experience`, and `/CaseStudies` returned HTTP 301 to lowercase routes.
- Resume, discovery, and metadata assets remained available: the canonical
  resume PDF, resume preview image, Open Graph image, `llms.txt`,
  `ai-summary.txt`, `portfolio.json`, `sitemap.xml`, `robots.txt`, and
  `manifest.json`.
- Browser checks confirmed key interaction flows still work: project detail
  expansion, experience detail expansion, experience copy-status behavior,
  resume preview/actions, contact form field rendering, case-study navigation,
  and static 404 rendering.
- Security headers were present on live HTML, 404, PDF, and static asset
  responses, including CSP, HSTS, `X-Content-Type-Options`,
  `Referrer-Policy`, and `Permissions-Policy`.

Production validation also surfaced four follow-up findings:

1. **Analytics CSP allowlist observation.** During the Jun 30 production-browser
   pass, Google Analytics sent at least some events to `analytics.google.com`,
   while console output showed attempts to reach `stats.g.doubleclick.net` and
   `www.google.com/g/collect`, which `connect-src` blocked. Current browser impact
   has not been reverified.
2. **The lowercase legacy resume URL is functional but not canonical-clean.**
   `/waffyahmedresume.pdf` serves the PDF with HTTP 200 instead of redirecting
   to `/waffyAhmedResume.pdf`. Use a forced redirect if canonicalization matters:
   `/waffyahmedresume.pdf /waffyAhmedResume.pdf 301!`.
3. **Deep routes still publish homepage metadata in initial HTML.** Browser
   titles and metadata update after React loads, but raw HTML for routes such as
   `/projects`, `/experience`, and `/case-studies/kubernetes-autoscaling` still
   contains homepage title, canonical, and Open Graph metadata. This confirms
   prerendered route metadata remains the highest-value next architectural fix.
4. **Mobile primary navigation is horizontally scrollable at narrow widths.**
   At a 390px viewport, the nav strip remains functional, but the Contact link
   starts off-screen until the nav is scrolled. This is not broken behavior, but
   it is a small usability caveat for mobile visitors.

Current classification: item 3 was resolved by PR #129 and the later PR #135
hydration fix. Item 4 remains current as F-005 after Jul 12 keyboard testing
confirmed that focus can stay clipped. Items 1 and 2 remain historical live
observations whose current impact was not reverified in a production browser or
final lowercase-alias request during the Jul 12 re-audit.

The multi-agent validation attempt was partially limited by sandbox DNS access:
several sub-agents could not resolve `waffy.dev`. The successful production
evidence above came from the main validation pass with approved live network
access and Playwright browser checks.

### Jul 5, 2026 Repo-Wide Reconciliation

This pass audited the current repository state, including the existing
uncommitted route lazy-loading and image-loading changes. It used source
inspection, local checks, a production build, local preview HTTP checks, and
read-only production HTTP checks. No browser automation was used in this pass,
so the Jul 5 checks should not add GA4 page views/users.

Validated local evidence:

- `git diff --check`, `npm run lint`, `npm run test`, `npm run build`, and the
  release preflight script all passed.
- `npm audit --audit-level=moderate` reported `0` vulnerabilities.
- Focused repository checks passed for frontend performance policy, content
  synchronization, resume assets, SPA SEO, AI discovery, CSP JSON-LD hash, and
  GA4 event coverage.
- The production build generated route chunks and prerendered metadata shells
  for 9 routes. Generated `dist` route shells such as
  `projects/index.html`, `resume/index.html`, and
  `case-studies/kubernetes-autoscaling/index.html` contain route-specific
  title, canonical, robots, and Open Graph metadata.
- Local Vite preview serves trailing-slash route URLs and direct
  `index.html` shell URLs with the expected metadata. Vite preview does not
  apply Netlify `_redirects`, so slashless local preview URLs are not
  authoritative for Netlify rewrite behavior.

Validated production HTTP evidence from `https://waffy.dev` on Jul 5, 2026:

- `/projects`, `/resume`, and
  `/case-studies/kubernetes-autoscaling` returned HTTP 301 to trailing-slash
  URLs.
- The corresponding trailing-slash pages returned HTTP 200 with route-specific
  initial HTML metadata and slashless canonical URLs.
- `/projects.html` and `/missing-page` returned HTTP 404 with
  `noindex, nofollow`.
- `/waffyAhmedResume.pdf`, `/llms.txt`, `/ai-summary.txt`,
  `/portfolio.json`, `/sitemap.xml`, `/robots.txt`, and `/manifest.json`
  returned HTTP 200.
- `/waffyahmedresume.pdf` still returned HTTP 200 rather than redirecting to
  `/waffyAhmedResume.pdf`; this remains a low-severity canonical hygiene item.

### Jul 10, 2026 Automation Follow-Up

Current `main` includes PR #134 at `17c9fb3`, with deployment tag
`deploy-20260710T213708Z-17c9fb3`. That closes the prior working-tree status for
route-level lazy loading, image loading policy, deployed security-header
verification, and related release checks.

The automation follow-up that later shipped in PR #135 added:

- `.github/workflows/portfolio-integrity.yml`, a pull-request and manual check
  for generated public artifacts, content synchronization, resume assets, SPA
  SEO, AI discovery, CSP JSON-LD hash alignment, GA4 events, and frontend
  performance policy.
- `scripts/check-deployed-routes.py`, which derives canonical and legacy app
  routes from `main/public/_redirects` and validates production redirects,
  route-specific prerendered initial-HTML canonical and Open Graph metadata,
  and the real noindex 404 response.
- A post-deploy call to that route checker in
  `.github/workflows/release-on-deploy.yml`, after Netlify reports the exact
  release commit ready and before GitHub release creation.

Local validation passed for YAML parsing, `git diff --check`, all eight focused
integrity checks, lint, 23 tests, and the production build with 9 prerendered
route shells. Read-only production HTTP validation against `https://waffy.dev`
passed for the homepage, 8 canonical routes, 6 legacy app redirects, and the
unknown-route 404. No browser automation was used, so this validation should
not add GA4 page views or users.

The deployed-route checker intentionally validates HTTP behavior and initial
HTML; it does not execute React. App-level trailing-slash tests cover the client
path locally, and the Jul 11 production browser pass independently verified the
hydrated document metadata.

PR #135 merged at `aea2eff1a51767a39f1ef1fe0afc4c756d8d3d5e` and activated
the workflow changes. Portfolio Integrity run `29154543878` passed for the PR,
and release-on-deploy workflow run `29154593131` validated the exact deployed
merge commit before creating release `deploy-20260711T133623Z-aea2eff`.

### Jul 10, 2026 Trailing-Slash Runtime Metadata Follow-Up

A production browser report identified a separate regression after the PR #129
prerender work: reloading any non-home page changed the tab title from the
route-specific title to `Page Not Found | Waffy Ahmed`. Fresh read-only HTTP
evidence confirmed that `/projects` still redirects to `/projects/` and that
the final response shell still starts with the correct `Projects | Waffy Ahmed`
title, `index, follow`, and slashless canonical URL.

Source tracing isolated the problem to client hydration rather than the
prerendered shell. React Router accepts `/projects/`, but the SEO metadata
lookup only matched the slashless `/projects` value. After hydration, the app
therefore applied the default 404 title, description, robots, canonical, Open
Graph, and Twitter metadata even though it rendered the correct page content.
This is a real runtime metadata regression, not merely trailing-slash
canonicalization polish. It is not a full-page availability failure, but it
affects every reloaded non-home route and can expose `noindex, nofollow` to
JavaScript-capable crawlers.

The fix that later shipped in PR #135 normalizes one trailing slash before route
metadata lookup and derives canonical URLs from the matched route. Regression
tests cover all known non-home trailing-slash paths and preserve the
unknown-route fallback.
Lint, 25 tests, the SPA SEO check, the frontend performance policy check, and
the production build with 9 prerendered route shells passed. A localhost
production-preview browser reload kept `/projects/` on the Projects title with
`index, follow`, while `/missing-page/` retained the 404 title and
`noindex, nofollow`.

The focused performance audit found no actionable regression from this fix.
Route splitting, image policy, CSS, assets, dependencies, and Vite configuration
were unchanged. The authoritative Node 22.13 release build reported a 264.92 kB
main bundle (85.15 kB gzip), with separate secondary-route chunks and 9
prerendered metadata shells. This supersedes the earlier local bundle value that
did not match the release build log.

No production browser automation was run during the Jul 10 follow-up, avoiding
new GA4 browser traffic at that stage. The item therefore remained open pending
deployment. The Jul 11 production validation below supplies that evidence and
closes the regression.

### Jul 11, 2026 PR #135 Deployment Closure

PR #135 merged at `aea2eff1a51767a39f1ef1fe0afc4c756d8d3d5e`, and Netlify
deployed that exact commit. Release workflow run `29154593131` passed its app
verification, deploy wait, deployed-route validation, legacy-domain redirect,
and release-creation steps, producing `deploy-20260711T133623Z-aea2eff`.

The live HTTP checker passed for the homepage, 8 canonical routes, 6 legacy app
redirects, and the unknown-route 404. Production-browser hard reloads on all
eight non-home canonical routes retained the correct route-specific title and
description, slashless canonical URL, `index, follow`, `og:url`, `og:title`,
`twitter:title`, and page heading after hydration. The static unknown-route
page retained its `Page Not Found | Waffy Ahmed` title, homepage canonical,
`noindex, nofollow`, and `Page not found` heading. No browser console errors
were observed.

The browser pass may have contributed up to eight GA4 page views. The HTTP and
GitHub Actions checks did not execute analytics. This closes the trailing-slash
hydration regression as a production issue.

### Jul 11-12, 2026 Exact Metadata Gate Hardening and Deployment

The follow-up that later shipped in PR #136 strengthens regression protection
rather than changing the deployed app. `scripts/check-deployed-routes.py`
imports route expectations directly from `main/src/data/seo.js` and requires
exact singleton matches for title, description, canonical, robots, Open Graph
URL, title, description and image fields, and Twitter title, description, and
image fields.
It also requires the metadata route inventory to match the canonical rewrites
derived from `main/public/_redirects`.

Offline fixture tests reject wrong-but-nonempty, missing, and duplicate values
for every enforced field. The tests are wired into Portfolio Integrity and the
release job before the live route check.

PR #136 merged at `4e222099f5ea329067fa4c44d62949408046fb3e` and activated the
hardening. Release workflow run `29195319984` passed app verification, the
offline deployed-route checker tests, the Netlify deploy wait, live route
validation, the legacy-domain redirect check, and release creation. It produced
release `deploy-20260712T135704Z-4e22209` for that exact merge commit.
Independent post-deploy HTTP validation passed against both the deploy preview
and `https://waffy.dev` for the homepage, 8 canonical routes, 6 legacy app
redirects, and the unknown-route 404. No browser automation was used for this
PR #136 pass, so it did not add browser-based GA4 traffic.

The focused performance pass found no frontend regression. The performance
policy check, its 6 regression tests, all 25 app tests, and the production build
passed. The authoritative Node 22 build log for run `29195319984` reported a
264.93 kB main bundle (85.15 kB gzip), separate secondary-route chunks, and 9
prerendered metadata shells. This supersedes the previously recorded 211.35 kB
(69.27 kB gzip) value, which did not match the run's build output. The new 1200
by 630 Open Graph PNG is 1,074,219 bytes versus 213,359 bytes for the prior card,
but it is referenced only by metadata and JSON-LD; it is not imported into the
app bundles or rendered as an application image. Ordinary page bundle weight
and LCP are therefore unchanged. Compressing the card remains an optional
social-crawler bandwidth optimization rather than a site-performance defect.

The Jun 30 browser-observed GA4 CSP caveat was not re-browser-tested during
this pass. The current local CSP still does not explicitly allow
`stats.g.doubleclick.net` or `www.google.com/g/collect`, so the audit keeps that
item as an analytics follow-up rather than marking it resolved.

### Jul 12, 2026 Evidence-Driven Re-Audit and PR #137 Deployment

The point-in-time re-audit reviewed `main` at
`3ce42ab14e6d062f404a4ae256e9806b9f945ed2`, the merge commit for PR #137. The
only repository change from the prior audited commit
`4e222099f5ea329067fa4c44d62949408046fb3e` is `main/package-lock.json`, with
patch-level development-tool updates: `@eslint/js` 9.39.4 to 9.39.5, ESLint
9.39.4 to 9.39.5, PostCSS 8.5.16 to 8.5.17, Vite 8.1.0 to 8.1.4, and Vitest
4.1.9 to 4.1.10.

Current repository, CI, GitHub, and production evidence:

- Release workflow run `29195893696` passed at the exact PR #137 merge commit,
  including Node 22 installation, lint, all 25 app tests, production build,
  Netlify deploy wait, deployed-route validation, legacy-domain redirect, and
  release creation. It produced
  `deploy-20260712T141551Z-3ce42ab`.
- The PR #137 Node 22 build reported a 264.88 kB main bundle (85.12 kB gzip),
  effectively unchanged from PR #136's 264.93 kB (85.15 kB gzip). A local Node
  26.5.0 and npm 11.17.0 build produced 265.47 kB (85.34 kB gzip); this small
  runtime variance is not a frontend regression.
- The release preflight, generated-public-artifact check, content sync, resume,
  SPA SEO, AI discovery, CSP hash, GA4, frontend performance policy, deployed
  route-checker tests, and deployed security-header tests passed. A live npm
  registry audit reported 0 vulnerabilities; npm audit run `29195366463` used
  package and lockfile blobs identical to current `HEAD`. CodeQL run
  `29195893707` passed on current `HEAD`, and current CodeQL/open-alert queries
  were clean.
- Read-only production HTTP validation passed for the homepage, 8 canonical
  routes, 6 legacy app redirects, the real unknown-route 404, and the deployed
  security headers. `portfolio.json`, `ai-summary.txt`, `llms.txt`, the resume
  PDF, and the Open Graph image matched the repository copies byte for byte.
- GitHub's API reported no `main` branch protection or repository ruleset.
  Dependabot vulnerability alerts and security updates were disabled; secret
  scanning and push protection were enabled.
- Source inspection found no tracked secret or private key,
  `dangerouslySetInnerHTML`, `eval`, dynamic executable code, unsafe redirect,
  or external-link pattern missing `noopener noreferrer`.
- Local desktop and 390 px browser checks found no ordinary route rendering,
  overflow, heading, or console failure. Focused failure-path and keyboard
  checks did reproduce the lazy-route blank-screen, stale route scroll/focus,
  and clipped mobile-nav focus findings recorded below.
- PDF inspection confirmed that the canonical resume is visually intact but is
  untagged, has no document language, has blank title/author/subject/keyword
  metadata, and produces unreliable extracted word spacing.

No production browser session or contact-form submission was used for this
pass. The production checks were HTTP-only, and the focused browser checks used
localhost, so this re-audit should not add GA4 page views or users.

The pass did not inspect the authenticated Netlify dashboard or Formspree
account controls, regenerate the resume from its absent source document, or run
axe, Lighthouse, field Core Web Vitals, load, penetration, license-compliance,
SBOM, or a separate formal security scan. A final live check of the lowercase
legacy resume alias was not completed; its canonicalization status remains
unverified in this pass. `scripts/check-deployed-routes.py` currently filters
that PDF alias out of its legacy app redirect inventory, so the status also
remains an automation gap if canonicalization matters.

The re-audit found no Critical or High issue and no release blocker. Its 13
current findings are retained in the maintained sections below:

| ID | Severity | Current finding |
| --- | --- | --- |
| F-001 | Medium | A rejected lazy-route import can blank the application without recovery UI. |
| F-002 | Medium | Repeated normal-size text treatments fail WCAG AA contrast. |
| F-003 | Medium | The canonical resume PDF lacks structural accessibility. |
| F-004 | Low | Route transitions preserve stale scroll and focus context. |
| F-005 | Low | Keyboard focus can leave a mobile navigation destination clipped offscreen. |
| F-006 | Low | `main` quality gates are not enforced by branch protection or a ruleset. |
| F-007 | Low | Dependabot vulnerability alerts and security updates are disabled. |
| F-008 | Low | Release creation does not run live deployed-header verification. |
| F-009 | Low | Prerendered route shells contain metadata but no rendered route body. |
| F-010 | Low | AI-readable outputs include avoidable website implementation detail. |
| F-011 | Informational | Hashed assets use browser revalidation rather than immutable caching. |
| F-012 | Informational | GitHub Actions use mutable major-version tags. |
| F-013 | Informational | Analytics and form processing need an explicit privacy decision. |

Across the previous audit's 17 numbered and deployed follow-up items, current
evidence classifies 9 as fixed, 5 as remaining or partially addressed, and 3 as
unable to verify. For only the original 13 numbered findings, the count is 8
fixed, 4 remaining or partial, and 1 unable to verify. No current application
issue was introduced by PR #137; F-001 predates that dependency-only change and
is a previously missed lazy-loading failure mode.

The header and this change set's canonical app data align on the supplied
creation date, `Sep 12, 2024 at 2:17 PM`
(`2024-09-12T14:17:00-04:00`). The date-alignment edit postdates deployed PR
#139 and is not yet production-verified.

### Jul 15, 2026 PR #139 GA4 Privacy Deployment Closure

PR #139 merged at `4089f8d7e9d812b0bda194e034a28bcbe26d418f` and deployed
that exact commit. Its pull-request checks passed in Portfolio Integrity run
`29455377115`, Main PR CI run `29455377121`, and CodeQL Advanced run
`29455377090`.

Release workflow run `29455441731` passed Node 22 lint, all 26 app tests, the
production build, the exact Netlify deploy wait, deployed-route validation, the
legacy Netlify-domain redirect, and release creation. It produced
`deploy-20260715T222758Z-4089f8d`; merge-commit CodeQL run `29455441662` also
passed.

Independent read-only production validation against `https://waffy.dev`
confirmed:

- the homepage, 8 canonical routes, 6 legacy app redirects, and the real
  unknown-route 404 remain healthy;
- production CSP, `X-Content-Type-Options`, `Referrer-Policy`, HSTS, and
  `Permissions-Policy` match `netlify.toml`;
- core route responses and the canonical resume PDF, `llms.txt`,
  `ai-summary.txt`, and `portfolio.json` returned final HTTP 200 responses; and
- deployed bundle `/assets/index-DCEyBbGj.js` constructs manual `page_view`
  events with `page_location` equal to the origin plus pathname and `page_path`
  equal to the pathname, excluding query strings and fragments at the source.

No production browser or Formspree submission was used. These API, workflow,
bundle, and HTTP checks should not add GA4 page views or users. They verify the
deployed application's event construction, not downstream GA4 receipt or the
separate Enhanced Measurement browser-history setting. The query-string
disclosure sub-finding is resolved in production; F-013 remains Informational
because the broader transparency and consent decision is still open.

---

## Resolved in PR #125

PR #125 addressed several findings from the baseline review:

- Added practical contact-form field limits and autocomplete attributes.
- Added a honeypot and duplicate-submission protection.
- Added a profile-driven fallback email action.
- Added general submission-error handling.
- Added live-region announcements and focus management for successful and failed form submissions.
- Standardized project and experience card actions around clearer **View details** controls.
- Corrected the Fintech @ Georgia Tech `squantities` typo.
- Expanded `HPA` to `Horizontal Pod Autoscaling (HPA)` where additional context improves readability.
- Updated the favicon, structured portfolio metadata, and the CSP hash required by the inline JSON-LD change.
- Expanded automated coverage for contact behavior, accessibility outcomes, input constraints, structured data, and experience-card interactions.

These items remain historical and should not be tracked as unresolved findings.

## Resolved in PR #127 and PR #128

Recent follow-up work addressed several additional findings from this audit:

- Tightened risky or awkward project and experience wording.
- Updated stale React/version and route-behavior documentation in README and
  AI-readable summary surfaces.
- Improved `ExperienceCard` accessibility with copy-status live announcements,
  timeout cleanup, Escape-to-close behavior, focus restoration, and
  reduced-motion handling.
- Refreshed app manifest and theme metadata.
- Hardened deployed security headers by using `object-src 'none'`,
  `frame-src 'none'`, and adding HSTS.
- Replaced the soft-404 SPA catch-all with explicit Netlify route rewrites and
  a real static `404.html` response for unknown paths.

## Resolved in PR #129

PR #129 addressed the original deep-route metadata finding by generating
route-specific HTML shells during the production build and pointing Netlify
canonical route rewrites at those shells.

Jul 5, 2026 production validation confirmed that route-specific initial HTML
metadata is present after the current trailing-slash redirect behavior. That
PR #129 resolution remains valid. The separate client-hydration regression
found on Jul 10 was resolved by PR #135 and production-browser verified on Jul
11.

---

# Findings and Follow-Up Work

## 1. Resolved in PR #135: Initial HTML and Trailing-Slash Runtime Metadata

The baseline and Jun 30 deployed audit found that Netlify sent application
routes to the same homepage-flavored `index.html` shell:

```text
/* /index.html 200
```

That meant crawlers, AI fetchers, messaging clients, and social-preview
generators that do not execute JavaScript could see homepage metadata for deep
routes such as:

```text
/case-studies/kubernetes-autoscaling
```

### Resolution

The current build now prerenders static metadata shells for every canonical
route:

- `/`
- `/experience`
- `/projects`
- `/resume`
- `/contact`
- `/case-studies`
- Each individual case study

`npm run build` on Jul 5, 2026 reported `Pre-rendered metadata shells for 9
routes`, and `check_spa_seo.mjs` passed. Production HTTP checks also confirmed
that trailing-slash route URLs serve route-specific initial titles and
canonicals.

### Jul 10 Runtime Follow-Up

The redirect itself remains low-severity URL canonicalization polish:
production redirects `/projects` to `/projects/`, while the served shell
canonical remains `https://waffy.dev/projects`. The post-hydration behavior was
more serious. Because the client metadata lookup required an exact slashless
path, it replaced valid route metadata with the 404 defaults after a reload.

PR #135 fixed the client mismatch in `seo.js` and `Seo.jsx` and added
route-level regression coverage in `App.test.jsx`. Local production preview and
automated checks passed, and the Jul 11 production hard-reload pass confirmed
correct hydrated metadata across every non-home canonical route.

### Remaining SPA Body-Rendering Limitation (F-009)

The resolved metadata work prerenders route-specific `<head>` content, not the
route body. Generated deep-route HTML still contains the `<noscript>` message
and an empty React root; `prerender-route-metadata.mjs` replaces metadata and
copies the template without rendering React content.

This is a Low-severity SPA and no-JavaScript resilience limitation, not a
regression in the metadata fix. Non-JavaScript crawlers, AI fetchers, and users
whose application JavaScript fails cannot read route headings or portfolio body
content from the HTML shell. JSON-LD, `sitemap.xml`, `llms.txt`,
`ai-summary.txt`, and `portfolio.json` provide substantial mitigation. Full
static body rendering is an architectural decision rather than a release
requirement.

**Relevant files:**

- `main/public/_redirects`
- `main/index.html`
- `main/scripts/prerender-route-metadata.mjs`
- `main/src/App.test.jsx`
- `main/src/components/Seo.jsx`
- `main/src/data/seo.js`

---

## 2. Resolved: Unknown Routes Previously Produced Soft 404s

The earlier catch-all SPA rewrite returned `index.html` with HTTP 200 for
unknown URLs. React later rendered the `NotFound` page, but the server response
was still successful and the initial HTML remained indexable.

### Resolution

PR #128 published a static `404.html`, removed the global `/* /index.html 200`
soft-404 catch-all, added explicit rewrites for canonical React routes, and
allows unknown paths to return HTTP 404. Deployed validation confirmed
`https://waffy.dev/definitely-missing-page` returns HTTP 404 with
`noindex, nofollow` and homepage canonical metadata.

**Relevant files:**

- `main/public/_redirects`
- `main/src/components/Seo.jsx`
- `main/src/pages/NotFound.jsx`
- `main/public/404.html`

---

## 3. Addressed: Documentation and AI Artifacts Are Generated

PR #127 corrected the known React-version and hero-description drift in
`main/README.md` and `main/public/ai-summary.txt`. The current repository goes
further by generating the public documentation and AI-readable artifacts from
canonical source modules.

`main/scripts/generate-public-artifacts.mjs` now updates `portfolio.json`,
`ai-summary.txt`, `llms.txt`, `sitemap.xml`, JSON-LD in `main/index.html`, the
CSP JSON-LD hash in `netlify.toml`, and generated README blocks. The Jul 5,
2026 build reported `Generated public artifacts are already current`, and the
content sync plus AI discovery checks passed.

### Automation Follow-Up

PR #135 wires the generator's check mode and the focused content, resume, SPA
SEO, AI discovery, CSP, GA4, and frontend performance checks into a dedicated
pull-request workflow. The workflow is active and passed for PR #135, so silent
public-artifact drift is now enforced at the pull-request gate. The useful model
remains:

```text
src/data/
   profile.js
   experience.js
   projects.js
   caseStudies.js
          ↓
build script
          ↓
portfolio.json
ai-summary.txt
JSON-LD
sitemap.xml
```

### Remaining AI Content-Selection Issue (F-010)

Generation freshness and source alignment are resolved, but the generated AI
surfaces still include avoidable website implementation detail. The generator
publishes the frontend framework and test stack, analytics event taxonomy,
Formspree behavior, and deployment context even though the same AI summary asks
systems to prioritize Waffy's platform, reliability, Kubernetes,
observability, and production-ownership evidence.

This is a Low-severity recruiter-signal issue rather than data drift. Keep
professional routes and discovery links, but move framework, telemetry, form,
and deployment internals to developer-facing documentation unless they directly
support Waffy's professional engineering narrative.

**Relevant files:**

- `main/package.json`
- `README.md`
- `main/README.md`
- `main/public/ai-summary.txt`
- `main/public/portfolio.json`
- `main/public/sitemap.xml`
- `main/scripts/generate-public-artifacts.mjs`
- `main/src/data/`
- `.github/workflows/portfolio-integrity.yml`

---

## 4. Resolved: A Few Content Claims Needed Tighter Wording

The baseline review flagged wording that was worth revising:

- The 2024 internship bullet uses `germane product data` and `pruning customer theft`, which read unnaturally and imply stronger direct causality than the surrounding context establishes.
- The release-governance section says staged rollouts ensure `zero regressions`; a rollout process can reduce risk but cannot guarantee that outcome.
- The Job Search Aid description uses a generic `etc.` rather than naming exact capabilities.

Suggested direction:

> Used Java, React, and TypeScript to surface relevant product information across self-checkout registers, supporting faster associate intervention and loss-prevention efforts associated with approximately $10M in annual shrink exposure.

> Coordinate staged rollouts for high-risk changes, reducing regression risk and improving operational consistency.

**Relevant files:**

- `main/src/data/experience.js`
- `main/src/data/projects.js`

### Resolution

PR #127 replaced these phrases with tighter wording around validated product
information, loss-prevention support, regression-risk reduction, and exact Job
Search Aid capabilities. The FirebaseAuth versus Firestore distinction was
preserved.

---

# Architecture and Performance

## 5. Resolved in PR #134: Secondary Routes Are Lazy-Loaded

The baseline audit flagged that `App.jsx` statically imported every route page.
PR #134 added `React.lazy`, `Suspense`, and an accessible route-loading fallback
to split secondary route code while keeping the homepage eager.

The PR is merged at `17c9fb3` and tagged as deployed. Jul 10 validation
confirmed the related app tests remain async-aware, the focused frontend
performance policy check passes, and the production build emits separate route
chunks.

### Remaining Resilience Gap: Lazy-Route Recovery (F-001)

Code splitting works in the healthy path, but `Suspense` handles only loading,
not a rejected dynamic import. Neither the route subtree nor the React root has
an error boundary, retry, or reload recovery view. In a focused local
production-preview test, Home loaded, the server was stopped, and the previously
unloaded Resume route was activated. The URL changed to `/resume`, the React
root disappeared, and no `main` or heading remained.

This Medium-severity failure mode can affect a stale deployment tab, transient
CDN failure, blocked asset, or interrupted connection. Add an error boundary
around the route content that preserves the navigation shell and offers retry
or reload actions. Cover a rejected lazy import with a regression test. Current
production chunks are healthy, so this is not a deployment blocker.

**Relevant files:**

- `main/src/App.jsx`
- `main/src/main.jsx`
- `main/src/App.test.jsx`

---

## 6. Partially Addressed in PR #134: Images Need Explicit Loading Treatment

At the baseline, the hero image, project logos, experience logos, and resume preview generally lacked intrinsic dimensions, and several below-the-fold images loaded eagerly.

PR #134 addresses the loading policy portion:

- Homepage profile and resume preview images use `loading="eager"`,
  `fetchPriority="high"`, and `decoding="async"`.
- Repeated logos and provider icons use `loading="lazy"` and
  `decoding="async"`.
- `main/src/App.test.jsx` includes assertions for the image-loading behavior
  that is most important to route rendering.

Recommended remaining treatment:

- Provide `width` and `height`, or a stable aspect ratio, for layout reservation.
- Evaluate WebP or AVIF for large photographic assets.

The Jul 12 local desktop and narrow-mobile browser pass found no clipping,
overlap, or document-level horizontal overflow. The remaining work is optional
layout-reservation and format optimization rather than a current rendering
defect; the resume preview remains the best intrinsic-size target.

**Relevant files:**

- `main/src/pages/Home.jsx`
- `main/src/components/ProjectCard.jsx`
- `main/src/components/ExperienceCard.jsx`
- `main/src/pages/Resume.jsx`

---

## 7. Low: No Performance Regression Budget

The repository does not currently enforce a bundle-size, Lighthouse, or Core
Web Vitals regression budget.

A modest Node 22 CI bundle threshold would prevent meaningful weight growth and
avoid comparing bundle values from different local runtimes. Lighthouse CI
becomes more valuable if the site later adopts static body rendering or larger
media.

**Relevant file:** `main/vite.config.mjs`

---

## Informational: Hashed Assets Revalidate in Browsers (F-011)

Current production JavaScript, CSS, and content-hashed profile-image responses
use `Cache-Control: public,max-age=0,must-revalidate`. Netlify edge cache hits
still reduce origin work, but repeat browser visits can incur validation round
trips. `netlify.toml` has only the general `/*` security-header rule and no
long-lived `/assets/*` cache policy.

This is not broken delivery and should remain Informational. If repeat-visit
caching is worth optimizing, add a narrow immutable policy for content-hashed
`/assets/*` files while keeping HTML and mutable root assets revalidated.

**Relevant file:** `netlify.toml`

---

# Accessibility and Interaction

## Medium: Repeated Text Treatments Fail WCAG AA Contrast (F-002)

Browser-computed colors and WCAG relative-luminance calculations confirmed five
normal-text contrast failures in shared treatments:

- White 14 px primary-button text on `#F96302`: 3.08:1.
- White primary-button text on hover color `#D95402`: 4.02:1.
- Green StatusBadge text `#147A56` on its composited dark Contact surface:
  approximately 2.51:1.
- Blue eyebrow text `#2563EB` on `#0B1220`: 3.62:1.
- Navbar subtitle `#64748B` on `#F4F1EA`: 4.22:1 at 12 px.

WCAG AA requires at least 4.5:1 for normal-size text. These shared tokens affect
primary resume, case-study, details, and form actions as well as repeated labels.
Use a darker orange for white-text controls, define explicit light/dark variants
for shared labels and badges, darken the small slate subtitle, and verify normal,
hover, focus, disabled, and dark-panel states. Add automated contrast or axe
coverage after correcting the tokens.

**Relevant files:**

- `main/src/index.css`
- `main/src/components/MissionControl.jsx`
- `main/src/components/Navbar.jsx`
- `main/src/pages/Contact.jsx`
- `main/src/pages/Home.jsx`

---

## Medium: Resume PDF Lacks Structural Accessibility (F-003)

The canonical one-page Letter PDF renders cleanly and its links work, but
`pdfinfo` reports `Tagged: no`. PDF inspection found no structure tree,
`MarkInfo`, or document language; title, author, subject, and keyword metadata
are blank. Extracted text includes unreliable splits such as `T echnology` and
`F rameworks`. The Resume route provides an image preview and PDF actions, not
an equivalent HTML resume.

Regenerate the PDF from its source with document language, title/author
metadata, semantic headings and lists, verified reading order, descriptive
links, and tagging. An HTML resume would provide a stronger fallback if it can
be maintained from the same canonical content. The current visual artifact is
available and readable, so this is not a deployment blocker.

Extend resume validation beyond file presence and link checks to assert tagging,
document language, metadata, structure, reading order, and extracted-text
quality so a regenerated artifact cannot silently lose accessibility semantics.

**Relevant files:**

- `main/public/waffyAhmedResume.pdf`
- `main/src/pages/Resume.jsx`

---

## Low: Route Transitions Preserve Stale Scroll and Focus (F-004)

The application has no route-level scroll restoration or route-heading focus
manager. In a focused 390 px local check, Experience was scrolled to its end and
Home was activated; Home opened thousands of pixels down the document with its
`h1` above the viewport, while focus remained on the Home navigation link.

On forward pathname changes, deliberately return to the top and move focus to a
temporarily focusable `main` or `h1` so keyboard and screen-reader users receive
route context. Preserve browser back/forward restoration deliberately, add a
skip link, and cover the behavior with a browser-level route test.

**Relevant files:**

- `main/src/App.jsx`
- `main/src/components/Navbar.jsx`
- `main/src/components/MissionControl.jsx`

---

## Low: Mobile Navigation Focus Can Remain Offscreen (F-005)

At a 390 px viewport, a current local keyboard pass measured a 358 px visible
navigation area and 423 px of content. The Contact link extended to about 431 px
while the visible navigation ended at 370 px. Keyboard focus reached Contact
without changing `scrollLeft`, leaving much of the destination and focus ring
clipped. The scrollbar is hidden, and the current helper scrolls the active link
after a pathname change rather than scrolling a link when it receives focus.

Scroll focused navigation links fully into view, retain a visible overflow
affordance, or use a layout that keeps all destinations visible. This upgrades
the Jun 30 mobile-scroll caveat from touch polish to a concrete Low-severity
keyboard issue; ordinary route navigation still works.

**Relevant file:** `main/src/components/Navbar.jsx`

---

## 8. Resolved: Clipboard Results Were Visual Only

`ExperienceCard` previously showed `Copied`, `Copy failed`, or `Copy`
visually, but the status was not announced through an `aria-live` region. The
reset timeout also needed cleanup if the component unmounted.

**Relevant file:** `main/src/components/ExperienceCard.jsx`

### Resolution

PR #127 added a copy-status live region, timeout cleanup, Escape-to-close
behavior, focus restoration, and reduced-motion handling. Post-deploy browser
validation confirmed experience detail expansion and copy-status behavior still
work.

### Existing Strengths

- The navbar exposes a named landmark and respects reduced-motion preferences.
- Project cards manage focus, Escape-key behavior, tab order, and reduced motion.
- Contact success and failure states now use live regions and focus management.
- External links consistently use `noopener noreferrer`.
- `PageShell` establishes the main landmark.

---

# Security and Privacy

## 9. Resolved: CSP Could Be Hardened Further

The baseline Content Security Policy was substantially better than having no
policy. Remaining defense-in-depth improvements included:

- Change `object-src 'self'` to `object-src 'none'` if no object/embed content is required.
- Change `frame-src 'self'` to `frame-src 'none'` if no embedded frame is required.
- Add `Strict-Transport-Security` for the HTTPS-only production domain.
- Treat removal of `style-src 'unsafe-inline'` as longer-term work because current styling may depend on it.

The deployed-header verification workflow should be updated alongside any policy change.

**Relevant files:**

- `netlify.toml`
- `.github/workflows/deployed-security-headers.yml`

### Resolution

PR #127 changed `object-src` to `none`, changed `frame-src` to `none`, added
HSTS, and updated deployed-header verification. Post-deploy validation confirmed
the hardened headers are present on live HTML, 404, PDF, and static asset
responses.

The separate production finding from Jun 30, 2026 is not general CSP hardening:
that production-browser pass observed attempts to reach additional Google
collection endpoints. The current CSP still omits those hosts, but the Jul 12
re-audit did not execute analytics in a production browser and could not confirm
current event loss. Treat this as an analytics follow-up rather than a regression
in the original hardening work. Measure the impact in GA before widening
`connect-src`; adding third-party hosts without current evidence is not
automatically a security improvement.

---

## Low: Dependabot Security Features Are Disabled (F-007)

GitHub's current repository settings report Dependabot vulnerability alerts and
security updates disabled, with automated security fixes also disabled. Weekly
version-update pull requests and the weekly/pull-request npm audit remain active,
and the current npm audit is clean, but a newly disclosed vulnerability may wait
for the scheduled audit and GitHub will not open a security-update pull request.

Enable vulnerability alerts and Dependabot security updates while retaining the
existing version-update and npm-audit workflows. This is supply-chain monitoring
hardening, not evidence of a current vulnerable dependency.

**Relevant files and settings:**

- `.github/dependabot.yml`
- `.github/workflows/npm-audit.yml`
- GitHub repository security settings

---

## 10. Informational: Make an Explicit Privacy Decision (F-013)

At the Jul 12 audited and deployed baseline, production configuration loaded
Google Analytics immediately. The manual `page_view` in
`main/src/hooks/usePageTracking.jsx` included the full browser URL in
`page_location` and the pathname plus query string in `page_path`, while
Formspree processed submitted names, email addresses, and messages. No
user-facing disclosure or consent control was found.

### Jul 13-15, 2026 Query-String Privacy Follow-Up

On Jul 13, focused source tracing and a BrowserRouter regression reproduced a
low-severity privacy finding: a URL containing email-, token-, and reset-like
query values copied those values into both manual GA4 page-view fields, and a
fragment token also reached `page_location`. The fix that shipped in PR #139
resolves that source-to-sink path by deriving `page_location` from the origin
plus router pathname, setting `page_path` to the pathname alone, and triggering
manual page views only when the pathname changes.

The new regression in `main/src/App.test.jsx` proves that email, token, and
fragment values are absent while the route pathname and GA measurement target
remain present. The regression failed before the fix and passed after it. The
original disclosure reproducer no longer matches the emitted event. Focused
analytics tests, all 26 app tests, lint, the production build, the GA4 event
consistency checker, and `git diff --check` passed.

The Jul 15 PR #139 deployment closure above adds exact-commit workflow,
independent live HTTP, and deployed-bundle evidence. No production browser was
used, so the validation should not create production GA4 traffic. Downstream
GA4 receipt and Enhanced Measurement history-event behavior were intentionally
not inferred from the bundle inspection.

On Jul 15, user-supplied GA4 Admin evidence showed URL-query redaction enabled
for `email`, `email_address`, `token`, `access_token`, `id_token`,
`refresh_token`, `reset_token`, `reset_code`, and `code`. The Admin test preview
replaced every supplied value with `(redacted)`. This is useful property-side
defense in depth for `page_location`, `page_referrer`, `page_path`, `link_url`,
`video_url`, and `form_destination`; it does not replace the source fix. The
supplied evidence did not independently show the separate email-pattern toggle
or the Enhanced Measurement browser-history page-view setting.

The query-string disclosure sub-finding is therefore resolved in production and
covered by property-side redaction preview evidence. F-013 remains
informational because the broader transparency and consent decision is still
open.

A short footer-level disclosure would improve transparency for this portfolio:

> This site uses Google Analytics for aggregate engagement measurement. Contact-form submissions are processed by Formspree.

The code now treats query strings and fragments as unnecessary for manual page
views. Preserve the property redaction list as defense in depth, verify the
separate email-pattern toggle and Enhanced Measurement history-event setting,
and retain dated property-side evidence alongside the deployment record.
Whether opt-in consent is required depends on the audience, configuration,
policy, and jurisdiction; this audit does not make a legal-compliance
determination. If an applicable requirement calls for it, default analytics
consent to denied until the visitor chooses.

**Relevant files:**

- `main/src/utils/analytics.js`
- `main/src/hooks/usePageTracking.jsx`
- `main/src/App.test.jsx`
- `main/src/components/ContactForm.jsx`
- `docs/analytics.md`

---

## 11. Unable to Verify: Formspree Account-Level Abuse Controls

The client-side constraints, honeypot, and duplicate-submission guard are useful
interaction and abuse-resistance measures, but any bot can bypass React and
submit directly to the Formspree endpoint. That is expected for browser-only
controls and is not evidence that the deployed form lacks server-side abuse
protection.

The repository cannot establish which Formspree plan-level spam filters, rate
limits, retention controls, or monitoring are active. Review those account
settings before deciding whether more protection is needed:

- Review Formspree spam controls and rate limits for the active plan.
- Add CDN or WAF throttling only where it can be applied without blocking normal recruiter or hiring-team traffic.
- Start with monitoring or challenge behavior before hard blocking.

This remains an operational verification item, not a confirmed Medium-Low
defect or a release blocker.

---

# Metadata and Platform Polish

## 12. Resolved: Manifest Metadata Used the Previous Theme

The redesigned site uses cream, navy, orange, and blue, while the manifest and HTML theme metadata still use generic black and white values.

Suggested values:

```json
{
  "theme_color": "#0B1220",
  "background_color": "#F4F1EA"
}
```

The manifest name can also be changed from `Waffy's Website` to `Waffy Ahmed | Software Engineer Portfolio`.

**Relevant files:**

- `main/public/manifest.json`
- `main/index.html`

### Resolution

PR #127 updated the manifest name, theme color, background color, and static
HTML theme color.

---

## 13. Low: AI-Provider Launcher URLs Need Periodic Validation

The footer depends on external ChatGPT and Claude URL behavior. These formats
can change independently of this repository. No current failure was observed;
this is an external manual dependency and test gap rather than a defect.

Keep a small manual release check or unit test around prompt generation, without assuming providers will always preserve prefilled text.

**Relevant file:** `main/src/components/DeployDates.jsx`

---

# Testing and Delivery

The repository has unusually mature automation for a personal portfolio, but
the checks exist without repository rules that require them:

- Pull-request CI for clean installation, linting, tests, and production builds.
- Scheduled and pull-request-based `npm audit`.
- Push, pull-request, and scheduled CodeQL analysis.
- Weekly deployed-header verification.
- Deployment-to-commit validation before release creation.

PR #135 added the dedicated Portfolio Integrity pull-request check and
source-derived deployed-route initial-HTML smoke coverage. Both are active:
Portfolio Integrity run `29154543878` passed for PR #135, and
release-on-deploy workflow run `29154593131` validated the exact production
commit before release creation. PR #136 then tightened the route checker to
require exact source-derived metadata, added offline regression fixtures, and
proved the combined gate in release run `29195319984`. The route checker does
not execute React, so browser-hydrated metadata remains covered by App tests and
the Jul 11 production browser validation.

Recommended additions, in descending order of value:

1. Rejected-lazy-import and route scroll/focus browser coverage.
2. Contrast or axe checks for every top-level route.
3. One mobile and one desktop visual-regression pass.
4. A modest Node 22 bundle-size or Lighthouse budget.

## Low: Main Quality Gates Are Not Enforced (F-006)

The authenticated GitHub branch-protection endpoint reports `main` is not
protected, and the repository rulesets endpoint returns an empty list. Lint,
tests, and build run for pull requests and again in the push-triggered release
workflow. Portfolio Integrity is pull-request-only, however, so a direct push
bypasses review and those focused content/metadata checks. Netlify can also
deploy the push before GitHub's post-push verification completes.

Add a `main` ruleset that requires pull requests and the Verify app, Validate
portfolio surfaces, and CodeQL checks; block force pushes and deletion; and
decide explicitly whether the solo owner should be exempt. Push-time app and
production-route verification provide meaningful compensation, so this remains
Low severity.

## Low: Release Creation Omits Live Header Verification (F-008)

The release workflow waits for the exact Netlify commit and validates routes,
the real 404, and the legacy domain before creating a GitHub release. It does
not run the deployed security-header checker. That checker currently runs only
weekly or manually in `deployed-security-headers.yml`.

Current production headers pass. To close the timing gap, run the header-checker
tests, CSP JSON-LD hash check, and live deployed-header check after the exact
deploy wait and before release creation.

**Relevant files:**

- `.github/workflows/release-on-deploy.yml`
- `.github/workflows/deployed-security-headers.yml`
- `scripts/check-deployed-security-headers.py`

## Informational: Actions Use Mutable Major-Version Tags (F-012)

Workflow `uses:` entries reference mutable major tags such as
`actions/checkout@v7`, `actions/setup-node@v6`,
`actions/github-script@v9`, and `github/codeql-action/*@v4` rather than immutable
commit SHAs. Current publishers are GitHub-owned, workflow permissions are
generally narrow, and Dependabot updates Actions. The release job's
`actions/github-script@v9` step necessarily runs with `contents: write` to create
the release, making that mutable reference the most sensitive one. Practical
risk remains Low and the finding remains Informational.

For stronger supply-chain immutability, pin Actions to full commit SHAs with
human-readable version comments and retain the existing Actions Dependabot
updater.

---

# Product and Portfolio Assessment

The redesign is a clear success. The homepage quickly communicates:

- Platform and reliability specialization.
- High-signal outcome metrics.
- A prominent resume action.
- A focused technical narrative.
- A featured production case study.
- Clear paths into outcomes, experience, and projects.

The next case-study improvement should emphasize engineering judgment rather than adding more metrics:

- Alternatives considered.
- Rollout constraints and risks.
- Why the selected design was chosen.
- Rollback criteria.
- Remaining tradeoffs or imperfections.

That would make the case studies read more like senior engineering narratives and less like expanded resume bullets.

## Reconciled Feedback-Roadmap Follow-Ups (Jul 15, 2026)

The former portfolio feedback roadmap mixed resolved work with a small set of
still-useful product and operational ideas. The resolved items remain documented
in the historical sections above. The unique follow-ups retained here are not
additional F-001 through F-013 defects unless fresh evidence establishes a
concrete failure.

### Improve Card Information Hierarchy

The full-time Home Depot experience contains strong evidence but remains dense
on the details face. A future content pass should group that evidence into
scannable themes such as reliability and autoscaling, deployment automation,
security hygiene, observability and incident response, and backend/data
integrity. If a front-side proof point is added, use a compact, consistent
pattern with one or two outcomes rather than restoring the previous misaligned
project-card `Impact` callout.

For project cards, use the monthly analytics review already defined in
`docs/analytics.md`: compare diagnostic `project_details_open` activity with
`project_source_click` and case-study engagement before deciding whether hidden
details should move onto the front. This remains a product-conversion
hypothesis, not a confirmed usability defect.

### Use Explicit Ownership-Card Disclosure Semantics

`OwnershipCard` currently reveals details when its focusable article receives
hover or focus. Ordinary keyboard focus exposes the content, but the state is
not represented by an explicit disclosure control. Prefer a visible **Show
details** button with `aria-expanded` and `aria-controls`, preserving keyboard,
touch, focus, and reduced-motion behavior. If the current interaction remains,
add concise instructions that explain the hover/focus behavior.

### Record External Discovery and Analytics Verification

Repository checks establish source, build, and deployed-route behavior, but
they cannot prove account-level state in Google Search Console or GA4. Keep a
dated external-verification record for:

- the canonical `waffy.dev` Search Console property and submitted sitemap;
- link previews for the homepage and high-value case-study routes after metadata
  or image changes;
- GA4 key-event classification for `resume_download`,
  `contact_form_success`, `project_source_click`, and
  `case_study_link_click`; and
- diagnostic events such as `project_details_open`, `case_study_card_click`,
  and `resume_open` remaining outside the key-event set unless later evidence
  supports promotion.

Use the custom `resume_download` event as the canonical hiring-intent signal;
do not also promote Enhanced Measurement's generic `file_download` event
without a coordinated event-model migration. Record the verification date and
supporting screenshot or export so external state is not inferred from
repository configuration.

---

# Recommended Execution Order

1. Correct the shared contrast tokens and add rejected-lazy-import recovery with
   regression coverage.
2. Regenerate the resume as a tagged, metadata-complete PDF and decide whether
   to provide an equivalent HTML resume.
3. Add deliberate route scroll/focus behavior and keep keyboard-focused mobile
   navigation links visible.
4. Protect `main`, enable Dependabot vulnerability alerts/security updates, and
   add live deployed-header validation to the release path.
5. Refocus AI-readable artifacts on professional engineering evidence, add a
   concise GA4/Formspree disclosure, and review Formspree account controls.
6. Add a modest Node 22 bundle budget, then consider immutable hashed-asset
   caching, Action SHA pinning, or full static body rendering as optional
   hardening. Re-test GA in a production browser before widening CSP.
7. After the verified backlog, revisit card information hierarchy and ownership
   disclosure behavior, then record dated Search Console, link-preview, and GA4
   property verification.

---

# Final Assessment

The repository remains healthy and production-ready through deployed PR #139 at
`4089f8d7e9d812b0bda194e034a28bcbe26d418f`. PR #135 and the Jul 11 production
validation closed the trailing-slash hydration regression. PR #136's offline
exact-metadata fixtures and inventory checks remain active in pull-request
automation, while release automation applies the checker to the deployed site.
PR #137's patch-level development-tool update introduced no meaningful bundle
regression. PR #139 then removed query strings and fragments from manual GA4
page-view fields, passed the exact-commit release workflow, and was confirmed in
the deployed bundle without opening a production browser session.

Within its F-001 through F-013 set, the Jul 12 re-audit found 3 Medium, 7 Low,
and 3 Informational current findings, with no Critical or High issue and no
rollback or deployment hold. Historical partial and unable-to-verify items
remain separately classified above. The Medium work is concentrated in concrete
accessibility and failure-recovery gaps: contrast, lazy-route rejection
handling, and resume PDF semantics. Lower severity work covers navigation
context, repository governance, monitoring timing, crawler/AI boundaries,
caching, workflow immutability, and privacy decisions.

Addressing that backlog will make the implementation demonstrate the same
operational rigor, accessibility awareness, and reliability mindset that the
portfolio presents as Waffy's professional specialty.
