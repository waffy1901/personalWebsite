# Personal Website Repository Audit

**Repository:** `waffy1901/personalWebsite`  
**Baseline reviewed:** `main` at `4f05b954309f7f6117549fee9d9537eab8014367`  
**Reconciled through:** PR #134 (`feat/portfolio-performance-security-automation`) at `17c9fb3`, including PR #131 (`feat/generate-public-artifacts`) and PR #129 (`prerenderRouteMetadata`)<br>
**Latest audit pass:** Jul 10, 2026 automation and route-metadata follow-up on `main` with current uncommitted portfolio-integrity, deployed-route validation, and trailing-slash metadata fixes present<br>
**Website creation date:** Sep 12, 2024 at 2:17 PM<br>
**Audit scope:** React application, content and data modules, tests, dependencies, Netlify configuration, public metadata, security controls, and GitHub Actions.

> This began as a source and configuration audit, not a browser-based Lighthouse
> or visual-regression run. The post-deploy addendum records later live
> production validation, and resolved items are marked as such where follow-up
> PRs addressed them.

---

## Overall Assessment

The portfolio is in **good engineering shape**. It presents a distinctive, recruiter-oriented platform and reliability narrative while also demonstrating meaningful engineering discipline through automated testing, dependency scanning, CodeQL, deployment validation, analytics, structured data, and accessible interaction patterns.

No obvious build-breaking or critical security issue was found. The original
highest-risk architectural gap, crawler-visible route metadata, has since been
resolved by the prerendered route-shell work. The highest-value remaining work
is now operational polish and regression protection:

1. Deploy and production-browser-verify the current trailing-slash runtime
   metadata fix.
2. Commit and activate the current portfolio-integrity and deployed-route
   automation.
3. Add targeted accessibility, visual, and performance regression checks.
4. Add a concise privacy disclosure and review Formspree abuse controls.
5. Clean up low-severity URL canonicalization and analytics allowlist caveats.

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

1. **Analytics CSP allowlist is incomplete.** Google Analytics still sends at
   least some events successfully to `analytics.google.com`, but browser console
   output shows GA also attempting `stats.g.doubleclick.net` and
   `www.google.com/g/collect`, which the current `connect-src` blocks. This can
   make analytics collection noisy or incomplete.
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

The current uncommitted automation follow-up adds:

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

The deployed-route checker intentionally validates HTTP and initial HTML; it
does not execute React and therefore cannot detect post-hydration document
metadata changes. The App-level trailing-slash tests added in the follow-up
cover that client path locally, while production browser verification remains a
separate release check.

These workflow changes are validated but are not yet active in GitHub Actions;
they still need to be committed, pushed, and observed in a real workflow run.

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

The current uncommitted fix normalizes one trailing slash before route metadata
lookup and derives canonical URLs from the matched route. Regression tests cover
all known non-home trailing-slash paths and preserve the unknown-route fallback.
Lint, 25 tests, the SPA SEO check, the frontend performance policy check, and
the production build with 9 prerendered route shells passed. A localhost
production-preview browser reload kept `/projects/` on the Projects title with
`index, follow`, while `/missing-page/` retained the 404 title and
`noindex, nofollow`.

The focused performance audit found no actionable regression from this fix.
Route splitting, image policy, CSS, assets, dependencies, and Vite configuration
are unchanged; the production build kept the main bundle at 211.34 kB
(69.26 kB gzip) with separate secondary-route chunks.

No production browser automation was run during this follow-up, avoiding new
GA4 browser traffic. The production post-hydration symptom is based on the user
report plus the confirmed source path; production HTTP checks prove the redirect
and initial shell. Keep this item open until a deployed browser reload confirms
the fixed title, canonical, robots, and social metadata.

The Jun 30 browser-observed GA4 CSP caveat was not re-browser-tested during
this pass. The current local CSP still does not explicitly allow
`stats.g.doubleclick.net` or `www.google.com/g/collect`, so the audit keeps that
item as an analytics follow-up rather than marking it resolved.

---

## Resolved in PR #125

The current PR addresses several findings from the baseline review:

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

These items should not be tracked as unresolved findings after this PR merges.

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
PR #129 resolution remains valid. The Jul 10 follow-up found a separate client
hydration regression for those trailing-slash browser URLs; it is tracked below
without reopening the initial-HTML finding.

---

# Findings and Follow-Up Work

## 1. Initial Metadata Resolved; Trailing-Slash Runtime Fix Pending Deploy

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

The current working tree fixes that client mismatch in `seo.js` and `Seo.jsx`
and adds route-level regression coverage in `App.test.jsx`. Local production
preview and automated checks pass, but this runtime portion remains open until
the fix is deployed and verified in a production browser.

**Relevant files:**

- `main/public/_redirects`
- `main/index.html`
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

The Jul 10 working tree wires the generator's check mode and the focused
content, resume, SPA SEO, AI discovery, CSP, GA4, and frontend performance
checks into a dedicated pull-request workflow. This addresses silent public
artifact drift at the PR gate once the workflow is committed and pushed. The
useful model remains:

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

**Relevant file:** `main/src/App.jsx`

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
- Run a desktop and narrow-mobile browser pass before treating this as fully
  visually verified.

**Relevant files:**

- `main/src/pages/Home.jsx`
- `main/src/components/ProjectCard.jsx`
- `main/src/components/ExperienceCard.jsx`
- `main/src/pages/Resume.jsx`

---

## 7. Low: No Performance Regression Budget

The repository does not currently enforce a bundle-size, Lighthouse, or Core Web Vitals regression budget.

A lightweight production bundle report is sufficient for now; Lighthouse CI becomes more valuable once route rendering and image loading are improved.

**Relevant file:** `main/vite.config.mjs`

---

# Accessibility and Interaction

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
Google Analytics now attempts additional collection endpoints that are blocked
by `connect-src`. Treat that as an analytics allowlist follow-up rather than a
regression in the original hardening work.

---

## 10. Low: Add a Small Privacy Disclosure

The site loads Google Analytics when configured and sends contact submissions through Formspree. A short footer-level disclosure would provide adequate transparency for this portfolio:

> This site uses Google Analytics for aggregate engagement measurement. Contact-form submissions are processed by Formspree.

**Relevant files:**

- `main/src/utils/analytics.js`
- `main/src/components/ContactForm.jsx`

---

## 11. Medium-Low: Client-Side Form Controls Are Not Rate Limiting

The PR adds useful client-side abuse resistance, but a bot can bypass the React form and submit directly to the Formspree endpoint.

For stronger protection:

- Review Formspree spam controls and rate limits for the active plan.
- Add CDN or WAF throttling only where it can be applied without blocking normal recruiter or hiring-team traffic.
- Start with monitoring or challenge behavior before hard blocking.

This is future operational hardening, not a release blocker.

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

The footer depends on external ChatGPT and Claude URL behavior. These formats can change independently of this repository.

Keep a small manual release check or unit test around prompt generation, without assuming providers will always preserve prefilled text.

**Relevant file:** `main/src/components/DeployDates.jsx`

---

# Testing and Delivery

The repository already has unusually mature automation for a personal portfolio:

- Pull-request CI for clean installation, linting, tests, and production builds.
- Scheduled and pull-request-based `npm audit`.
- Push, pull-request, and scheduled CodeQL analysis.
- Weekly deployed-header verification.
- Deployment-to-commit validation before release creation.

The current Jul 10 working tree adds a dedicated portfolio-integrity PR check
and source-derived deployed-route initial-HTML smoke coverage. Both have passed
local/static validation, and the route checker passed against production, but
neither change is active in GitHub Actions until it is committed and pushed.
The route checker does not execute React, so browser-hydrated metadata remains
covered by App tests plus a post-deploy browser reload check.

Recommended additions, in descending order of value:

1. `axe` checks for every top-level route.
2. One mobile and one desktop visual-regression pass.
3. A modest bundle-size or Lighthouse budget.

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

---

# Recommended Execution Order

1. Deploy the trailing-slash runtime metadata fix, then confirm in a production
   browser that reloaded non-home routes retain their route-specific title,
   canonical, robots, and social metadata.
2. Commit and push the portfolio-integrity and deployed-route automation, then
   confirm both workflows pass in GitHub Actions.
3. Add accessibility, visual, and performance regression checks.
4. Add a concise privacy disclosure and review Formspree spam controls.
5. Address the analytics CSP allowlist, remaining trailing-slash URL
   canonicalization, and lowercase resume canonicalization findings from
   deployed validation.

---

# Final Assessment

The repository remains healthy, but the trailing-slash hydration regression
should be deployed and browser-verified before route metadata is treated as
fully closed.

As the remaining operational polish lands, the repository will not merely look polished as a portfolio; it will demonstrate the same operational rigor and reliability mindset that the site presents as a professional specialty.
