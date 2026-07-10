# Verification Lanes

Use these lanes as reusable building blocks. Select by changed files, user wording, and deployment target.

## Inputs To Collect

- `git status --short`
- `git diff --stat` and `git diff --name-only`
- Staged diff if relevant: `git diff --cached --stat` and `git diff --cached --name-only`
- Target URLs: local dev, local preview, deploy preview, production, or comparison pair
- Changed public surfaces: routes, data files, static assets, redirects, headers, workflows, analytics, forms, and tests

## Lane 1: Diff-Risk Mapper

Goal: identify what could regress before running checks.

Inspect changed files and map them to surfaces:

- `main/src/data/*`: visible content, public metadata, route slugs, SEO alignment, AI discovery alignment
- `main/src/pages/*` or `main/src/components/*`: route behavior, layout, accessibility, navigation, analytics call sites
- `main/src/App.jsx` or router changes: canonical routes, legacy uppercase redirects, 404 behavior, route smoke tests
- `main/public/*`: static assets, resume paths, discovery docs, sitemap, robots, redirects, manifest
- `main/index.html` or JSON-LD: CSP hash, structured data, crawler-visible profile data
- `netlify.toml`: headers, redirects, CSP, Formspree/GA allowlists, frame/object/base policy
- `main/src/utils/analytics.js`, `main/src/hooks/usePageTracking.jsx`, or analytics tests: GA4 event shape and page tracking
- `.github/*`, scripts, or package files: automation, release gates, dependency or command behavior

Output: affected surfaces, likely regressions, required adjacent skills, and minimal command plan.

## Lane 2: Local Release Gate

Goal: prove the repo still builds and core tests pass.

Run only what the risk justifies:

- `git diff --check`
- `npm run lint`
- `npm run test`
- `npm run build`
- `node .codex/skills/portfolio-performance-auditor/scripts/check_frontend_performance.mjs /Users/waffyahmed/Downloads/personalWebsite`
- `bash .codex/skills/portfolio-release-qa/scripts/portfolio_preflight.sh /Users/waffyahmed/Downloads/personalWebsite`

Use the performance checker when route loading, image priority, asset delivery, or bundle behavior changed. Use the preflight script for release or push readiness. Use the individual commands when a narrower check gives faster feedback.

## Lane 3: Route And Functionality Smoke

Goal: check user-visible routes and primary actions.

Core routes:

- `/`
- `/resume`
- `/projects`
- `/case-studies`
- `/experience`
- `/contact`
- case-study detail routes from the route/data source
- `/waffyAhmedResume.pdf`
- `/llms.txt`
- `/ai-summary.txt`
- `/portfolio.json`
- `/sitemap.xml`
- `/robots.txt`
- `/manifest.json`

Regression probes:

- Legacy uppercase routes redirect or render as intended.
- Canonical lowercase app routes remain the source of truth.
- Missing routes return a real 404 and crawler `noindex, nofollow` where expected.
- Resume download/open behavior still reaches `main/public/waffyAhmedResume.pdf`.
- Contact form UI still renders, validates, and submits only when intentionally tested.

## Lane 4: SEO And Crawler Surface

Goal: verify what crawlers and link previews see before React hydration.

Check:

- Initial HTML title, description, canonical URL, Open Graph, and Twitter metadata for affected routes.
- Prerender shell output in `dist` after build when route metadata changed.
- `_redirects`, Netlify redirects, and route casing behavior.
- `sitemap.xml` and `robots.txt` for canonical route alignment.
- `.html` aliases and trailing-slash behavior if route metadata or redirects changed.
- 404 page status and body. Use non-failing curl forms so the body can be inspected.

Prefer expected route metadata from `main/src/data/seo.js` instead of hard-coded assumptions.

## Lane 5: Content, AI Discovery, And Resume Consistency

Goal: keep public machine-readable files aligned with the canonical app data.

Check:

- Visible app content against `main/src/data/*`.
- `main/public/portfolio.json`.
- `main/public/ai-summary.txt`.
- `main/public/llms.txt`.
- Structured project/case-study metadata.
- Resume PDF path and preview image.
- Public content remains focused on Waffy's engineering work rather than website implementation details.

Use the content, AI discovery, and resume skill checkers when these surfaces changed.

## Lane 6: Analytics, CSP, And Security Headers

Goal: catch telemetry, form, and header regressions.

Check:

- GA4 event names are lowercase underscore names.
- Event params are useful and never empty.
- Page tracking still follows route transitions.
- Recommended key-event candidates remain intact: `resume_download`, `contact_form_success`, `project_source_click`, `case_study_link_click`.
- `netlify.toml` still allows only required scripts, connections, forms, images, frames, and inline JSON-LD hash.
- If `main/index.html` JSON-LD changed, recompute and verify the CSP `script-src` SHA-256 hash.

Use live browser QA for analytics only when needed; disclose that it may create GA4 page views/users.

## Lane 7: Visual And Browser QA

Goal: catch layout, runtime, and interaction regressions that static checks miss.

Check at desktop and mobile widths:

- Navigation, active route state, and route transitions.
- Hero and section text for overflow or overlap.
- Project cards, case-study links, resume actions, social/contact links.
- Contact form states.
- Console errors and failed network requests.
- Any changed visual component on at least one narrow mobile width around 390px.

Clean up transient browser artifacts when they are not part of the requested output.

## Lane 8: Deployed Or Preview Verification

Goal: prove the actual hosted target behaves as claimed.

Use production `https://waffy.dev/`, the Netlify deploy preview URL, or both depending on the request.

Check:

- Final status codes and redirect chains for affected routes.
- Initial HTML metadata on final `200` route responses.
- Public static assets return expected statuses and content types.
- Missing page returns expected 404 behavior and body metadata.
- Production-specific caveats are classified by practical severity.

Use real HTTP evidence for deployed claims. If sandbox/network limits prevent live checks, say exactly what could not be verified.

## Subagent Prompt Template

Use a narrow, read-only prompt like this:

```text
Use $adversarial-change-verifier in /Users/waffyahmed/Downloads/personalWebsite for one independent QA lane: <lane name>. Treat this as read-only. Inspect the relevant files or target URLs, run only the checks needed for this lane, and report findings first with exact evidence, commands, confidence, and residual risk. Do not modify files.
```

For live QA lanes, add:

```text
If you use a real browser against https://waffy.dev/ or a deploy preview, explicitly note that the visit may contribute to GA4. Prefer curl or Node HTTP checks when browser interactivity is not required.
```
