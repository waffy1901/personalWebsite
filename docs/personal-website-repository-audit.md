# Personal Website Repository Audit

**Repository:** `waffy1901/personalWebsite`  
**Baseline reviewed:** `main` at `4f05b954309f7f6117549fee9d9537eab8014367`  
**Reconciled against:** PR #125 (`overhaul/v2`)  
**Audit scope:** React application, content and data modules, tests, dependencies, Netlify configuration, public metadata, security controls, and GitHub Actions.

> This is a source and configuration audit, not a fresh browser-based Lighthouse or visual-regression run. Findings below are reconciled against the current PR so resolved items are not presented as open work.

---

## Overall Assessment

The portfolio is in **good engineering shape**. It presents a distinctive, recruiter-oriented platform and reliability narrative while also demonstrating meaningful engineering discipline through automated testing, dependency scanning, CodeQL, deployment validation, analytics, structured data, and accessible interaction patterns.

No obvious build-breaking or critical security issue was found. The highest-value remaining work is architectural rather than cosmetic:

1. Pre-render canonical routes so crawlers and link-preview clients receive route-specific metadata.
2. Return genuine 404 responses for unknown URLs.
3. Generate public documentation and AI-readable artifacts from canonical data to prevent drift.
4. Add targeted accessibility, performance, and security hardening.

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

---

# Open Findings

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

## 2. High: Unknown Routes Produce Soft 404s

The catch-all SPA rewrite returns `index.html` with HTTP 200 for unknown URLs. React later renders the `NotFound` page, but the server response is still successful and the initial HTML remains indexable.

### Recommended Correction

Preferred approach:

- Pre-render known routes.
- Publish a real `404.html`.
- Allow Netlify to return HTTP 404 for unknown paths.

Interim improvement:

- Apply `noindex, nofollow` on the client-rendered not-found route.
- Canonicalize invalid paths back to the homepage rather than to the invalid URL.

**Relevant files:**

- `main/public/_redirects`
- `main/src/components/Seo.jsx`
- `main/src/pages/NotFound.jsx`

---

## 3. High-Medium: Documentation and AI Artifacts Can Drift

The root README correctly lists React 19, but two other public documentation surfaces are stale:

- `main/README.md` still lists React 18.
- `main/public/ai-summary.txt` still describes the implementation as React 18.
- The AI summary says the homepage includes Georgia Tech branding, while the redesigned hero now centers the profile image and platform/reliability positioning.

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

## 4. Medium: A Few Content Claims Need Tighter Wording

The following wording remains worth revising:

- The 2024 internship bullet uses `germane product data` and `pruning customer theft`, which read unnaturally and imply stronger direct causality than the surrounding context establishes.
- The release-governance section says staged rollouts ensure `zero regressions`; a rollout process can reduce risk but cannot guarantee that outcome.
- The Job Search Aid description uses a generic `etc.` rather than naming exact capabilities.

Suggested direction:

> Used Java, React, and TypeScript to surface relevant product information across self-checkout registers, supporting faster associate intervention and loss-prevention efforts associated with approximately $10M in annual shrink exposure.

> Coordinate staged rollouts for high-risk changes, reducing regression risk and improving operational consistency.

**Relevant files:**

- `main/src/data/experience.js`
- `main/src/data/projects.js`

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

## 8. Low: Clipboard Results Are Visual Only

`ExperienceCard` visually shows `Copied`, `Copy failed`, or `Copy`, but the status is not announced through an `aria-live` region. The reset timeout should also be cleared if the component unmounts.

**Relevant file:** `main/src/components/ExperienceCard.jsx`

### Existing Strengths

- The navbar exposes a named landmark and respects reduced-motion preferences.
- Project cards manage focus, Escape-key behavior, tab order, and reduced motion.
- Contact success and failure states now use live regions and focus management.
- External links consistently use `noopener noreferrer`.
- `PageShell` establishes the main landmark.

---

# Security and Privacy

## 9. Medium-Low: CSP Can Be Hardened Further

The existing Content Security Policy is substantially better than having no policy. Remaining defense-in-depth improvements include:

- Change `object-src 'self'` to `object-src 'none'` if no object/embed content is required.
- Change `frame-src 'self'` to `frame-src 'none'` if no embedded frame is required.
- Add `Strict-Transport-Security` for the HTTPS-only production domain.
- Treat removal of `style-src 'unsafe-inline'` as longer-term work because current styling may depend on it.

The deployed-header verification workflow should be updated alongside any policy change.

**Relevant files:**

- `netlify.toml`
- `.github/workflows/deployed-security-headers.yml`

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

## 12. Medium-Low: Manifest Metadata Uses the Previous Theme

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
2. A test proving not-found routes receive `noindex` until real 404s are implemented.
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

1. Pre-render canonical routes and implement genuine 404 responses.
2. Generate public documentation and AI artifacts from canonical data.
3. Correct the remaining wording and documentation drift.
4. Add route-level lazy loading and explicit image-loading behavior.
5. Add accessibility and performance regression checks.
6. Harden response headers and add a concise privacy disclosure.

---

# Final Assessment

After the remaining architectural and documentation work, the repository will not merely look polished as a portfolio; it will demonstrate the same operational rigor and reliability mindset that the site presents as a professional specialty.
