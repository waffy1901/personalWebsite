# Personal Website Repository Audit

**Repository:** `waffy1901/personalWebsite`  
**Audited branch:** `main`  
**Audited commit:** `4f05b954309f7f6117549fee9d9537eab8014367`  
**Audit scope:** React application, content/data layer, tests, dependencies, Netlify configuration, public metadata, security controls, and GitHub Actions.

> This was a source and configuration audit rather than a fresh browser-based Lighthouse run.

---

## Overall Assessment

The portfolio is in **good engineering shape**. The redesign is much more distinctive, recruiter-oriented, and technically credible than a conventional portfolio. The repository now has meaningful automated testing, dependency scanning, CodeQL, deployment validation, analytics, structured data, and accessible interaction patterns.

No obvious current build-breaking or critical security issue was found. The dependency-resolution follow-up passed the application CI, CodeQL, and `npm audit` workflows.

The most important remaining problems are:

1. Deep-link SEO and link previews are still limited by the client-rendered SPA.
2. Unknown URLs produce indexable soft 404s.
3. README and AI-readable artifacts have already drifted from the actual application.
4. The ownership-card interaction is not fully accessible.
5. Several smaller content, performance, security-header, and maintenance issues remain.

---

# Highest-Priority Findings

## 1. High: Deep Routes Initially Publish Homepage SEO Metadata

Netlify sends every application route to the same `index.html` file through:

```text
/* /index.html 200
```

That HTML contains homepage-specific title, description, canonical URL, Open Graph URL, and Open Graph title.

The correct route-specific values are applied only after React runs a `useEffect`.

Consequently, a request for a route such as:

```text
/case-studies/kubernetes-autoscaling
```

initially returns HTML declaring:

```text
canonical: https://waffy.dev/
title: Waffy Ahmed | Software Engineer Portfolio
```

Any search crawler, social preview generator, messaging client, or AI fetcher that does not execute JavaScript will see homepage metadata instead of the case-study metadata.

### Recommended Correction

Pre-render static HTML for each canonical route during the build. The site has only a small, known set of routes, making it a strong candidate for a Vite-compatible prerender or static-site-generation approach.

At minimum, generate standalone HTML for:

- `/`
- `/experience`
- `/projects`
- `/resume`
- `/contact`
- `/case-studies`
- Each individual case study

This is more valuable than further client-side SEO work because the existing route metadata is already thoughtfully defined.

**Relevant files:**

- `main/public/_redirects`
- `main/index.html`
- `main/src/components/Seo.jsx`
- `main/src/data/seo.js`

---

## 2. High: Unknown Routes Are Soft 404s and May Be Indexed

The catch-all Netlify rewrite returns `index.html` with HTTP 200 for every unknown URL.

React then displays the `NotFound` component, but this is only a visual 404.

There are two problems:

- The server response is still HTTP 200.
- The initial HTML has `robots: index, follow`.

The client-side SEO component changes the title and canonical URL for an unknown route, but it does not add `noindex`.

That means a nonsense URL could theoretically be treated as a valid, indexable page with a self-referencing canonical.

### Recommended Correction

Best option:

- Pre-render known routes.
- Let Netlify return a genuine `404.html` with HTTP 404 for anything else.

Interim correction:

- Add `meta[name="robots"] = "noindex, nofollow"` on the not-found route.
- Canonicalize the not-found page back to the homepage rather than the invalid pathname.

**Relevant files:**

- `main/public/_redirects`
- `main/index.html`
- `main/src/components/Seo.jsx`
- `main/src/pages/NotFound.jsx`

---

## 3. High-Medium: Public Documentation and AI Artifacts Are Already Drifting

The actual application now uses React `19.2.7`.

However:

- The root README still says React 18.
- The application README still says React 18.
- `ai-summary.txt` still describes the implementation as React 18.

The AI summary also says the homepage contains Georgia Tech branding, but the redesigned homepage now centers the profile photo and platform/reliability positioning rather than displaying the GT logo in the hero.

This drift is especially important because the site intentionally exposes:

- `ai-summary.txt`
- `portfolio.json`
- `llms.txt`
- JSON-LD
- Sitemap entries
- Two READMEs
- React data files

The same career claims and metrics are repeated across several of these surfaces. For example, the CDC `5000+ hours` figure appears in homepage content, projects, experience, case studies, the AI summary, and structured JSON.

### Recommended Correction

Treat the JavaScript data modules as the canonical source and generate the static artifacts at build time:

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

Also add a synchronization test that verifies:

- Framework versions shown in documentation match `package.json`.
- Every case-study slug appears in the sitemap.
- Every structured artifact contains the same primary metrics.
- Resume and social URLs match `profile.js`.

This is probably the highest-leverage maintainability improvement in the repository.

**Relevant files:**

- `main/package.json`
- `README.md`
- `main/README.md`
- `main/public/ai-summary.txt`
- `main/public/portfolio.json`
- `main/public/sitemap.xml`
- `main/src/data/profile.js`
- `main/src/data/experience.js`
- `main/src/data/projects.js`
- `main/src/data/caseStudies.js`

---

## 4. Medium: Ownership Cards Are Visually Interactive but Not Semantic Disclosures

`OwnershipCard` makes the entire `<article>` focusable and expands its details through hover or focus.

The details panel is visually collapsed through height, translation, and opacity, but it:

- Has no disclosure button.
- Has no `aria-expanded`.
- Has no `aria-controls`.
- Has no `aria-hidden` or `inert` state.
- Does not communicate that focusing the card changed the content.

A keyboard user can discover it, but the behavior is less clear to a screen-reader user and does not offer an explicit mobile or touch action.

### Recommended Correction

Use the same interaction quality already implemented in `ProjectCard`:

- A real **View details** button.
- `aria-expanded`.
- `aria-controls`.
- Explicit show/hide state.
- Escape-key support if appropriate.
- Details hidden semantically when collapsed.

`ProjectCard` already demonstrates strong focus restoration and Escape handling.

**Relevant files:**

- `main/src/components/OwnershipCard.jsx`
- `main/src/components/ProjectCard.jsx`

---

## 5. Medium: Content Quality Has a Few Noticeable Blemishes

### Clear Typo

The Fintech @ Georgia Tech bullet says:

> “adjust squantities”

This should be:

> “adjust quantities”

### Awkward Wording

The 2024 internship bullet uses:

- “germane product data”
- “pruning customer theft”

These feel unnatural and potentially overstate direct causality.

A cleaner version would be:

> Used Java, React, and TypeScript to surface relevant product information across self-checkout registers, supporting faster associate intervention and loss-prevention efforts associated with approximately $10M in annual shrink exposure.

### Absolute Operational Claim

The release-governance section says staged rollouts ensure “zero regressions.”

No rollout process can literally guarantee zero regressions.

Safer wording:

> Coordinate staged rollouts for high-risk changes, reducing regression risk and improving operational consistency.

### Generic Project Copy

The Job Search Aid description contains:

> “resources such as FAQs, resume templates, etc.”

Replacing `etc.` with two or three exact capabilities would make it more concrete.

**Relevant files:**

- `main/src/data/experience.js`
- `main/src/data/projects.js`

---

# Architecture and Performance

## 6. Medium: All Route Pages Are Loaded Eagerly

`App.jsx` statically imports every page, including all case-study and secondary routes.

For a small portfolio this is not disastrous, but the redesign has increased page and component complexity. Route-level lazy loading would keep the homepage bundle focused:

```jsx
const Experience = lazy(() => import("./pages/Experience.jsx"));
const Projects = lazy(() => import("./pages/Projects.jsx"));
const CaseStudy = lazy(() => import("./pages/CaseStudy.jsx"));
```

The homepage should remain eager; secondary pages can load through `Suspense`.

**Relevant file:**

- `main/src/App.jsx`

---

## 7. Medium-Low: Images Lack Intrinsic Dimensions and Below-the-Fold Lazy Loading

Examples include:

- Hero profile image.
- Project logos.
- Experience logos.
- Resume preview.

Most do not provide `width` and `height`, so the browser has less information for reserving layout space before the file loads.

### Recommended Treatment

- Give all images intrinsic dimensions or a fixed `aspect-ratio`.
- Use `loading="lazy"` for resume previews and below-the-fold logos.
- Keep the homepage hero eager and consider `fetchPriority="high"`.
- Evaluate WebP or AVIF for the profile and resume-preview images.

**Relevant files:**

- `main/src/pages/Home.jsx`
- `main/src/components/ProjectCard.jsx`
- `main/src/components/ExperienceCard.jsx`
- `main/src/pages/Resume.jsx`

---

## 8. Low: No Bundle or Performance Regression Budget

The Vite configuration contains only the React plugin, an ES2019 target, and Vitest configuration.

There is currently no:

- Bundle-size report.
- Maximum chunk-size policy.
- Lighthouse CI.
- Core Web Vitals regression check.

This is not urgent, but a lightweight production bundle report would be useful now that React, React Router, Vite, Formspree, icons, diagrams, analytics, and several image assets are involved.

**Relevant file:**

- `main/vite.config.mjs`

---

# Accessibility and Interaction Details

## 9. Medium-Low: Contact Success Is Not Announced or Focus-Managed

After Formspree reports success, the entire form is replaced by a thank-you message.

The success container has neither:

- `role="status"`
- `aria-live="polite"`
- Programmatic focus

A screen-reader user may not know the submission succeeded.

### Recommended Correction

Add a status region and move focus to it after successful submission. It would also be helpful to render a general submission error message rather than only field-level email and message errors.

**Relevant file:**

- `main/src/components/ContactForm.jsx`

---

## 10. Low: Clipboard Outcomes Are Visual Only

`ExperienceCard` shows `Copied`, `Copy failed`, or `Copy` visually after using the Clipboard API.

The changing text is not in an `aria-live` region, so assistive technology may not announce the outcome.

The timeout should also ideally be cleared if the component unmounts, although this is a minor robustness concern.

**Relevant file:**

- `main/src/components/ExperienceCard.jsx`

---

## 11. Strong Accessibility Work Already Present

Several parts are notably well implemented:

- The navbar has a named navigation landmark and brings the active mobile item into view while honoring reduced-motion preferences.
- Project flip cards restore focus, support Escape, properly manage tab order, and account for reduced motion.
- External links consistently use `noopener noreferrer`.
- Global decorative animations are disabled under `prefers-reduced-motion`.
- `PageShell` establishes a proper `<main>` landmark.

This is substantially better accessibility work than most personal portfolio repositories.

**Relevant files:**

- `main/src/components/Navbar.jsx`
- `main/src/components/ProjectCard.jsx`
- `main/src/index.css`
- `main/src/components/MissionControl.jsx`

---

# Security and Privacy

## 12. Medium-Low: CSP Can Be Hardened Further

The current policy is already much better than having no CSP. It restricts scripts, connections, frames, forms, images, and other resources.

Several refinements are worth considering.

### Use `object-src 'none'`

The current policy uses:

```text
object-src 'self'
```

The site does not appear to require browser plug-ins or `<object>` content, so `none` is more appropriate.

### Remove Unnecessary `frame-src 'self'`

The resume is now rendered as an image with external PDF links, not an embedded frame.

Unless another feature requires frames, `frame-src 'none'` would reduce the attack surface.

### Add HSTS

`Strict-Transport-Security` is not configured in `netlify.toml`. This is a defense-in-depth improvement for a production HTTPS-only custom domain.

### Eventually Reduce `style-src 'unsafe-inline'`

This is likely the most difficult CSP improvement because Tailwind and inline style usage may require it. It should be treated as a longer-term hardening task, not an immediate blocker.

The weekly production-header workflow is a strong safeguard, although its expected CSP values will need to change alongside any policy hardening.

**Relevant files:**

- `netlify.toml`
- `.github/workflows/deployed-security-headers.yml`
- `main/src/pages/Resume.jsx`

---

## 13. Low: Analytics and Formspree Deserve a Small Privacy Disclosure

Google Analytics is dynamically loaded as soon as its measurement ID is configured.

The contact form sends visitor-provided details to Formspree.

For a personal portfolio, a short footer-level privacy notice is sufficient:

> This site uses Google Analytics for aggregate engagement measurement. Contact-form submissions are processed by Formspree.

That improves transparency without needing a large legal page.

**Relevant files:**

- `main/src/utils/analytics.js`
- `main/src/components/ContactForm.jsx`

---

## 14. Medium-Low: Add CDN or WAF Rate Limiting for Contact Form Abuse

The contact form now has reasonable client-side hardening, including required
fields, practical length limits, disabled duplicate submits while Formspree is
submitting, and a honeypot field.

Those controls improve casual spam resistance and message quality, but they are
not true denial-of-service protection because a bot can bypass the React app and
submit directly to the form endpoint.

For stronger protection without adding application dependencies, add CDN or WAF
rate limiting in front of the production site. Good first rules would be:

- Limit repeated requests to the contact page or contact submission path per IP.
- Apply stricter throttles to obvious burst behavior.
- Keep the action as throttle/challenge first, then block only after repeated abuse.
- Monitor false positives so recruiters or hiring teams are not blocked by normal use.

If Formspree exposes built-in rate limiting, spam filtering, blocklists, or abuse
controls on the active plan, enable those as the lowest-friction complement.

This should be treated as future operational hardening rather than a current
release blocker.

**Relevant files/services:**

- Netlify rate limiting or WAF configuration
- Formspree project spam and abuse settings
- `main/src/components/ContactForm.jsx`

---

# Metadata and Platform Polish

## 15. Medium-Low: Web Manifest Still Reflects the Previous Generic Theme

The redesigned site uses cream, navy, orange, and blue as its defining palette, but the manifest still declares:

```json
"theme_color": "#000000",
"background_color": "#ffffff"
```

`index.html` also uses a black theme color.

A closer match would be:

```json
"theme_color": "#0B1220",
"background_color": "#F4F1EA"
```

The manifest name could also be upgraded from:

```text
Waffy's Website
```

to:

```text
Waffy Ahmed | Software Engineer Portfolio
```

**Relevant files:**

- `main/public/manifest.json`
- `main/index.html`

---

## 16. Low: Validate the AI-Provider Launcher URLs Periodically

The footer hardcodes provider launch behavior, including a ChatGPT prefilled query URL and a clipboard-then-open flow for Claude.

These external URL formats can change independently of the deployment. A simple manual release check or unit test over the generated prompt is reasonable, while avoiding reliance on the provider successfully preserving the prefilled text forever.

**Relevant file:**

- `main/src/components/DeployDates.jsx`

---

# Testing and Delivery Pipeline

## What Is Strong

The test suite has meaningful behavioral coverage rather than superficial snapshots. It covers:

- All major routes.
- Route-level SEO mutations.
- Analytics events.
- Project-card focus management.
- Contact submissions.
- Structured data.
- Public portfolio JSON.
- Legacy redirects.
- Resume actions.
- Not-found behavior.
- Experience-card accessibility.

The CI workflow runs clean installs, linting, tests, and a production build on pull requests to `main`.

The repository also has:

- Scheduled and PR-based `npm audit`.
- Push, PR, and scheduled CodeQL analysis.
- Weekly deployed-header verification.
- Deployment-to-commit verification before creating a release.

That is unusually mature for a portfolio repository.

**Relevant files:**

- `main/src/App.test.jsx`
- `.github/workflows/dev-ci.yml`
- `.github/workflows/npm-audit.yml`
- `.github/workflows/codeql.yml`
- `.github/workflows/deployed-security-headers.yml`
- `.github/workflows/release-on-deploy.yml`

---

## Remaining Test Gaps

Add the following in descending order of value:

1. `axe` accessibility checks for every top-level route.
2. A test proving not-found routes receive `noindex`.
3. Tests over generated sitemap, JSON-LD, and AI artifacts.
4. A rendered-HTML test confirming deep routes contain their own static metadata after prerendering.
5. One mobile and one desktop visual-regression pass.
6. A modest bundle-size or Lighthouse budget.

---

# Product and Portfolio Assessment

The redesign itself is a clear success.

The homepage immediately presents:

- Your platform and reliability specialization.
- Four high-signal metrics.
- A prominent resume action.
- A concise technical focus.
- A featured production case study.
- Clear paths into outcomes, experience, and projects.

The case-study data model is also strong. It consistently gives each story:

- Context.
- Measurable outcomes.
- A sequence of engineering steps.
- Problem, approach, and outcome.
- Stack and related links.

The next content improvement should not be adding more metrics. It should be adding slightly more **engineering judgment** to the case studies:

- What alternatives were considered?
- What risks constrained the rollout?
- Why was this design selected?
- What validation would have caused a rollback?
- What remained imperfect afterward?

That would make the case studies read more like senior engineering narratives and less like expanded resume bullets.

---

# Recommended Execution Order

1. **Fix route rendering and soft 404 behavior** through prerendering and a real `404.html`.
2. **Generate AI, SEO, and public artifacts from canonical data** to eliminate drift.
3. **Replace `OwnershipCard`’s focus-triggered expansion with an explicit accessible disclosure.**
4. **Correct the typo, awkward phrasing, absolute claims, React-version docs, and manifest colors.**
5. **Add route-level lazy loading, image dimensions, lazy loading for below-fold assets, and accessibility CI.**
6. **Harden CSP, add the short analytics/Formspree privacy disclosure, and evaluate CDN/WAF rate limiting for contact-form abuse.**

---

# Final Assessment

After these changes, the repository would be not merely polished for a personal portfolio—it would demonstrate the same operational rigor and reliability mindset that the portfolio claims as a professional specialty.
