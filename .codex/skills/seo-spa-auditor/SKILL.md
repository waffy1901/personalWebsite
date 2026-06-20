---
name: seo-spa-auditor
description: SEO and single-page-app route auditing for Waffy Ahmed's personalWebsite. Use when Codex changes route metadata, canonical URLs, sitemap entries, robots.txt, Open Graph or Twitter tags, route casing redirects, app routes, case-study slugs, prerender/static route strategy, or search/link-preview behavior for the React/Vite portfolio.
---

# SEO SPA Auditor

## Workflow

1. Confirm canonical route metadata in `main/src/data/seo.js`.
2. Confirm React routes and legacy uppercase redirects in `main/src/App.jsx`.
3. Confirm sitemap and robots discovery in `main/public/sitemap.xml` and `main/public/robots.txt`.
4. Confirm static fallback metadata and alternate discovery links in `main/index.html`.
5. Run the static SEO route check:

```bash
node .codex/skills/seo-spa-auditor/scripts/check_spa_seo.mjs /path/to/personalWebsite
```

Read [references/seo-map.md](references/seo-map.md) when routes, domains, or link-preview behavior change.

## Runtime Checks

For user-facing SEO work, build and preview the site, then inspect titles, descriptions, canonical URLs, and OG/Twitter tags after route navigation. SPA metadata updates after React loads, so distinguish browser-visible metadata from crawler-visible static HTML.
