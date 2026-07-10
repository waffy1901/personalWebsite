---
name: portfolio-performance-auditor
description: Frontend performance auditing for Waffy Ahmed's personalWebsite React/Vite portfolio. Use when Codex changes route-level code splitting, image loading priority, asset delivery, page weight, layout responsiveness, Vite build output, lazy/eager loading behavior, or wants to check performance regressions without turning the task into a full release QA pass.
---

# Portfolio Performance Auditor

## Workflow

1. Check `git status --short` and identify unrelated user changes before editing.
2. Map the changed files to performance surfaces:
   - `main/src/App.jsx`: route-level lazy loading, `Suspense`, fallback accessibility, route chunk boundaries.
   - `main/src/pages/*` and `main/src/components/*`: image priority, rendered DOM size, expensive repeated work, mobile layout stability.
   - `main/src/images/*` and `main/public/*`: image dimensions, formats, static asset delivery, resume preview and Open Graph assets.
   - `main/src/index.css` and Tailwind classes: overflow, hidden content, layout shift, responsive constraints.
   - `main/package.json`, Vite config, or scripts: build output, dependencies, and production bundling behavior.
3. Run the focused static check when route lazy loading or image markup is in scope:

```bash
node .codex/skills/portfolio-performance-auditor/scripts/check_frontend_performance.mjs /path/to/personalWebsite
```

When changing the checker itself, run its regression test:

```bash
node --test .codex/skills/portfolio-performance-auditor/scripts/test_frontend_performance.mjs
```

4. Run tests that cover the changed behavior. For route lazy loading or image policy, `main/src/App.test.jsx` should assert the behavior directly.
5. For user-visible performance work, build and inspect production output:

```bash
npm run build
```

6. When layout or runtime performance is in scope, run a preview/dev server and inspect affected routes at desktop and a narrow mobile width. Browser QA against `waffy.dev` can count as GA4 traffic; local browser checks, `curl`, Node scripts, and builds do not affect GA4.

Read [references/performance-map.md](references/performance-map.md) for route, image, layout, and verification guidance.

## Reporting

Lead with regressions or missing evidence. Separate true performance breakage from lower-risk tuning opportunities, and list commands run plus checks skipped.
