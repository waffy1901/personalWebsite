# Personal Website Repository Audit

**Repository:** `waffy1901/personalWebsite`  
**Baseline reviewed:** `main` at `4f05b954309f7f6117549fee9d9537eab8014367`  
**Reconciled against:** PR #125 (`overhaul/v2`)  
**Website creation date:** Sep 12, 2024 at 2:17 PM<br>
**Audit scope:** React application, content and data modules, tests, dependencies, Netlify configuration, public metadata, security controls, and GitHub Actions.

> This began as a source and configuration audit, not a browser-based Lighthouse
> or visual-regression run. The post-deploy addendum records later live
> production validation, and resolved items are marked as such where follow-up
> PRs addressed them.

---

## Overall Assessment

The portfolio is in **good engineering shape**. It presents a distinctive, recruiter-oriented platform and reliability narrative while also demonstrating meaningful engineering discipline through automated testing, dependency scanning, CodeQL, deployment validation, analytics, structured data, and accessible interaction patterns.

No obvious build-breaking or critical security issue was found. The highest-value remaining work is architectural rather than cosmetic:

1. Pre-render canonical routes so crawlers and link-preview clients receive route-specific metadata.
2. Generate public documentation and AI-readable artifacts from canonical data to prevent drift.
3. Add targeted accessibility, performance, and security hardening.

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

---

# Findings and Follow-Up Work

## 1. High: Deep Routes Initially Publish Homepage Metadata

Netlify currently sends application routes to the same `index.html` file through the SPA rewrite:

```text
/* /index.html 200
```

The initial HTML contains homepage-specific title, canonical, and Open Graph values. React replaces them after the application runs, but crawlers, AI fetchers, messaging clients, and social-preview generators that do not execute JavaScript may continue to see homepage metadata for routes such as:

```text
/case-studies/kubernetes-autoscaling
```

### Recommended Correction

Pre-render static HTML for every canonical route during the build:

- `/`
- `/experience`
- `/projects`
- `/resume`
- `/contact`
- `/case-studies`
- Each individual case study

The route-level metadata definitions already exist; the missing step is publishing them in the initial HTML response.

**Relevant files:**

- `main/public/_redirects`
- `main/index.html`
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

## 3. High-Medium: Documentation and AI Artifacts Can Drift

PR #127 corrected the known React-version and hero-description drift in
`main/README.md` and `main/public/ai-summary.txt`. The broader risk remains:
public documentation and AI-readable artifacts can still drift because several
surfaces are maintained manually.

The same career claims and metrics also appear across JavaScript data modules, JSON-LD, `portfolio.json`, `ai-summary.txt`, `llms.txt`, the sitemap, and both READMEs. Manual synchronization across these surfaces is likely to drift again.

### Recommended Correction

Treat the data modules as the canonical source and generate public artifacts during the build:

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

Add synchronization tests covering framework versions, case-study slugs, primary metrics, resume links, and social URLs.

**Relevant files:**

- `main/package.json`
- `README.md`
- `main/README.md`
- `main/public/ai-summary.txt`
- `main/public/portfolio.json`
- `main/public/sitemap.xml`
- `main/src/data/`

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

## 5. Medium: Secondary Routes Are Loaded Eagerly

`App.jsx` statically imports all route pages. The site is still small, but route-level lazy loading would keep the initial homepage bundle focused as the portfolio grows.

Keep the homepage eager and lazy-load secondary routes through `React.lazy` and `Suspense`.

**Relevant file:** `main/src/App.jsx`

---

## 6. Medium-Low: Images Need Explicit Loading Treatment

The hero image, project logos, experience logos, and resume preview generally lack intrinsic dimensions. Several below-the-fold images are also loaded eagerly.

Recommended treatment:

- Provide `width` and `height`, or a stable aspect ratio, for layout reservation.
- Lazy-load below-the-fold assets.
- Keep the homepage hero eager and consider `fetchPriority="high"`.
- Evaluate WebP or AVIF for large photographic assets.

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

Recommended additions, in descending order of value:

1. `axe` checks for every top-level route.
2. A deployed-route smoke check proving unknown URLs return HTTP 404.
3. Synchronization tests for sitemap, JSON-LD, AI artifacts, and framework versions.
4. A rendered-HTML test confirming route-specific metadata after prerendering.
5. One mobile and one desktop visual-regression pass.
6. A modest bundle-size or Lighthouse budget.

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

1. Pre-render canonical routes so initial HTML contains route-specific metadata.
2. Generate public documentation and AI artifacts from canonical data.
3. Add route-level lazy loading and explicit image-loading behavior.
4. Add accessibility and performance regression checks.
5. Add a concise privacy disclosure and review Formspree spam controls.
6. Address the Analytics CSP allowlist and lowercase resume canonicalization findings from the post-deploy validation.

---

# Final Assessment

After the remaining architectural and documentation work, the repository will not merely look polished as a portfolio; it will demonstrate the same operational rigor and reliability mindset that the site presents as a professional specialty.
