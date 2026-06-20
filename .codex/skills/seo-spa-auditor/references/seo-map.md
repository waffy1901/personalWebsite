# SEO SPA Map

## Route Sources

- `main/src/App.jsx`: React routes and legacy redirects.
- `main/src/data/seo.js`: route titles, descriptions, canonical URL builder, sitemap route list.
- `main/public/sitemap.xml`: public route discovery.
- `main/index.html`: static fallback metadata, OG/Twitter defaults, alternate links.

## High-Value Routes

- `/`
- `/case-studies`
- `/case-studies/kubernetes-autoscaling`
- `/case-studies/legacy-deployment-recovery`
- `/case-studies/cdc-data-reconciliation`
- `/experience`
- `/projects`
- `/resume`
- `/contact`

## SPA Caveat

`Seo.jsx` updates metadata after React loads. Browser-visible metadata can be correct while crawler-visible static HTML remains generic. For important route previews, consider prerendering or static route shells before adding complex edge logic.
