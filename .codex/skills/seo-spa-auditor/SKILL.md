---
name: seo-spa-auditor
description: SEO and single-page-app route auditing for Waffy Ahmed's personalWebsite. Use when Codex changes route metadata, canonical URLs, sitemap entries, robots.txt, Open Graph or Twitter tags, route casing redirects, app routes, case-study slugs, prerender/static route strategy, or search/link-preview behavior for the React/Vite portfolio.
---

# SEO SPA Auditor

## Workflow

1. Confirm canonical route metadata in `main/src/data/seo.js`.
2. Confirm React routes and legacy uppercase redirects in `main/src/App.jsx`.
3. Confirm sitemap and robots discovery in `main/public/sitemap.xml` and `main/public/robots.txt`.
4. Confirm static fallback metadata and alternate discovery links in `main/index.html`, then confirm the production build runs `scripts/prerender-route-metadata.mjs` to emit route-specific metadata shells in `dist/`.
5. Run the static SEO route check:

```bash
node .codex/skills/seo-spa-auditor/scripts/check_spa_seo.mjs /path/to/personalWebsite
```

Read [references/seo-map.md](references/seo-map.md) when routes, domains, or link-preview behavior change.

## Runtime Checks

For user-facing SEO work, build and preview the site, then inspect titles, descriptions, canonical URLs, and OG/Twitter tags after route navigation. The production build emits static route-specific metadata shells, while the route body remains a client-rendered SPA and `Seo.jsx` still updates metadata after client-side navigation. Distinguish initial built HTML from browser-updated state.
