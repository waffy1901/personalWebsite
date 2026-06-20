# AGENTS.md

## Scope

These instructions apply to the whole repository. This is Waffy Ahmed's React/Vite portfolio for `https://waffy.netlify.app/`.

## Working Agreements

- Check `git status --short` before making edits. Treat unrelated changes as user-owned and do not revert them.
- Keep changes focused on the user request. Avoid opportunistic refactors, broad rewrites, or dependency churn.
- Use the root `package.json` scripts unless there is a specific reason to work from `main/`.
- Do not commit, push, deploy, or modify Git hooks unless the user explicitly asks.
- Prefer ASCII for new prose and code unless an edited file already uses non-ASCII for the relevant text.
- When a task matches a repo skill under `.codex/skills`, use that skill and follow its `SKILL.md` before editing.

## Project Map

- `main/` is the Vite React app.
- `main/src/pages/` contains route-level pages.
- `main/src/components/` contains reusable UI components.
- `main/src/data/` is the canonical source for profile, experience, project, case-study, and route metadata content.
- `main/src/utils/analytics.js` and `main/src/hooks/usePageTracking.jsx` own GA4 behavior.
- `main/public/` contains static assets, resume files, sitemap, robots, redirects, AI-readable files, and structured public data.
- `main/index.html` contains the static shell and JSON-LD profile data.
- `netlify.toml` owns Netlify build settings, headers, and CSP.
- `scripts/pre-push-checks.sh` runs the local pre-push lint, test, and build sequence.

## Commands

Run from the repository root:

```bash
npm run dev
npm run lint
npm run test
npm run build
npm run preview
```

Use focused checks when a repo skill provides one:

```bash
bash .codex/skills/portfolio-release-qa/scripts/portfolio_preflight.sh /Users/waffyahmed/Downloads/personalWebsite
node .codex/skills/portfolio-content-sync/scripts/check_content_sync.mjs /Users/waffyahmed/Downloads/personalWebsite
node .codex/skills/resume-site-sync/scripts/check_resume_assets.mjs /Users/waffyahmed/Downloads/personalWebsite
node .codex/skills/seo-spa-auditor/scripts/check_spa_seo.mjs /Users/waffyahmed/Downloads/personalWebsite
node .codex/skills/ai-discovery-maintainer/scripts/check_ai_discovery.mjs /Users/waffyahmed/Downloads/personalWebsite
node .codex/skills/csp-security-header-maintainer/scripts/check_csp_jsonld_hash.mjs /Users/waffyahmed/Downloads/personalWebsite
node .codex/skills/ga4-portfolio-analytics/scripts/check_ga4_events.mjs /Users/waffyahmed/Downloads/personalWebsite
```

## Verification Expectations

- For code changes, run the narrowest meaningful check first, then `npm run lint`, `npm run test`, or `npm run build` as risk requires.
- For release, push, or deploy readiness, use `$portfolio-release-qa` and run lint, tests, and production build.
- For visual or layout work, start the dev or preview server and inspect the affected route on desktop and mobile widths when possible.
- For route changes, smoke-check canonical lowercase routes and legacy uppercase redirects.
- If a command cannot be run, report the reason and the remaining risk.

## Skill Routing

- Use `$portfolio-release-qa` for pre-push checks, release readiness, route smoke checks, build/test/lint verification, resume/static asset validation, or Netlify deploy readiness.
- Use `$portfolio-content-sync` when changing profile, experience, projects, case studies, metrics, links, route slugs, public portfolio metadata, recruiter-facing copy, or AI/SEO-visible content.
- Use `$resume-site-sync` when replacing, validating, linking, previewing, or summarizing the resume PDF or resume preview image.
- Use `$seo-spa-auditor` when changing routes, canonical URLs, sitemap entries, robots, Open Graph/Twitter metadata, SPA redirects, case-study slugs, or link-preview behavior.
- Use `$ai-discovery-maintainer` when changing `llms.txt`, `ai-summary.txt`, `portfolio.json`, JSON-LD, structured project/case-study metadata, or AI-agent discovery guidance.
- Use `$csp-security-header-maintainer` when changing JSON-LD, Google Analytics, Formspree, external assets, security headers, CSP hashes, redirects, or frame/object/base policies.
- Use `$ga4-portfolio-analytics` when adding, removing, auditing, testing, or documenting GA4 events.
- Use `$git-pr-publisher` when asked to stage files, commit changes, push the current or dev branch, create or update a PR against `main`, or safely ship local changes after implementation.

## Content And Metadata Rules

- Preserve the portfolio voice: backend/platform engineering, production ownership, reliability, Kubernetes, observability, deployment automation, incident response, and measurable impact.
- Keep `main/src/data/*` as the canonical app content source. When content changes, align the visible app, `main/public/portfolio.json`, `main/public/ai-summary.txt`, `main/public/llms.txt`, `main/public/sitemap.xml`, and `main/src/data/seo.js` as needed.
- Keep public AI/discovery content focused on Waffy's engineering work, not the implementation details of the website itself.
- Avoid trust-risk copy. In particular, do not imply Firestore stores user passwords; FirebaseAuth handles authentication, and Firestore stores profile metadata, saved jobs, and preferences.
- Preserve canonical resume paths: `main/public/waffyAhmedResume.pdf` and `main/public/resume-preview.png`.
- Keep canonical app routes lowercase. Maintain legacy uppercase redirects in React routes and Netlify redirects when route behavior changes.

## Analytics Rules

- Keep event emission in `main/src/utils/analytics.js`, `main/src/hooks/usePageTracking.jsx`, and the component that owns the user action.
- Keep event tests in `main/src/App.test.jsx` near the behavior being tracked.
- Use lowercase underscore event names and include useful `placement` values.
- Do not send empty event params.
- Recommended GA4 key-event candidates are `resume_download`, `contact_form_success`, `project_source_click`, and `case_study_link_click`.

## Security And Netlify Rules

- Inspect `netlify.toml` before changing external scripts, forms, images, frames, connections, redirects, or headers.
- If JSON-LD in `main/index.html` changes, recompute and verify the CSP `script-src` SHA-256 hash.
- Keep CSP narrow: allow only the site, the inline JSON-LD hash, Google Tag Manager/Analytics, Formspree, and currently required data font/image sources.
- Do not add new third-party services or production dependencies without a clear reason and user approval.

## Frontend Rules

- Follow the existing React 18, React Router, Vite, Tailwind, and Testing Library patterns.
- Keep route pages focused and compose reusable UI through `main/src/components/`.
- Preserve accessibility basics: semantic headings, reachable links/buttons, focus behavior, and useful labels.
- Make responsive changes deliberately. Check mobile and desktop layouts for text overflow, overlapping elements, and broken navigation.
- Prefer existing visual language, spacing, and component patterns over adding a new design system.

## Done Criteria

Before finishing, summarize changed files, commands run, and any checks not run. If public content, SEO, AI discovery, resume, analytics, CSP, or routes changed, explicitly mention the corresponding alignment or verification step.
