# Portfolio App

This directory contains the Vite React application for [waffy.dev](https://waffy.dev/).

The app powers Waffy Ahmed's professional portfolio, including experience, case studies, projects, resume, contact form, deploy metadata, route-level SEO metadata, and AI-readable discovery files.

## Stack

- React 18
- Vite
- Tailwind CSS
- React Router
- Formspree
- Vitest and Testing Library
- ESLint

## Scripts

```bash
npm run dev      # Start the local Vite server
npm run lint     # Run ESLint
npm test         # Run Vitest
npm run build    # Build the production app into dist/
npm run preview  # Serve the production build locally
```

## Environment Variables

```text
VITE_GA_MEASUREMENT_ID
VITE_FORMSPREE_KEY
VITE_DEPLOY_DATE
VITE_SITE_URL
```

`VITE_DEPLOY_DATE` is injected by the build script without rewriting local `.env` files. The production build pins `VITE_SITE_URL` to `https://waffy.dev`, so Netlify should not override it with an environment variable. Local development displays the current local preview timestamp so stale `.env` values are not shown on localhost. Provide analytics and Formspree values through a local `.env` file or Netlify environment variables.

## Analytics

Set `VITE_GA_MEASUREMENT_ID` to enable Google Analytics. The app sends manual SPA `page_view` events and tracks resume, social, project, case-study, and contact-form engagement events through `src/utils/analytics.js`. Recommended key-event setup is documented in `../docs/analytics.md`.

## Notes

- Static public assets live in `public/`.
- `public/sitemap.xml`, `public/robots.txt`, `public/llms.txt`, `public/ai-summary.txt`, and `public/portfolio.json` support search and AI-agent discovery.
- The resume route shows a PNG resume preview while preserving direct PDF open/download links.
- `_redirects` keeps React Router routes working on Netlify.
