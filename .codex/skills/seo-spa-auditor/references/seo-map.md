# SEO SPA Map

## Route Sources

- `main/src/App.jsx`: React routes and legacy redirects.
- `main/src/data/seo.js`: route titles, descriptions, canonical URL builder, sitemap route list.
- `main/public/sitemap.xml`: public route discovery.
- `main/index.html`: metadata template, JSON-LD, and alternate links.
- `main/scripts/prerender-route-metadata.mjs`: production-build postprocessor that writes route-specific metadata shells and route-module preloads to `dist/`.

## High-Value Routes

- `/`
- `/case-studies/`
- `/case-studies/kubernetes-autoscaling/`
- `/case-studies/legacy-deployment-recovery/`
- `/case-studies/cdc-data-reconciliation/`
- `/experience/`
- `/projects/`
- `/resume/`
- `/contact/`

These are the canonical trailing-slash URLs generated from `routeMetadata`. The
React route declarations use slashless paths and legacy capitalized inputs
redirect to the canonical URLs.

## Static Metadata And SPA Caveat

`main/scripts/prerender-route-metadata.mjs` runs after `vite build` and writes
each route's title, description, canonical URL, Open Graph, Twitter, and
route-module preload metadata into a static `dist/` shell. `Seo.jsx` still
updates metadata after client-side navigation, and page body content remains
client-rendered. Validate both initial built HTML and browser-visible metadata
when route-preview behavior matters.
