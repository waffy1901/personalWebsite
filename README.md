# Waffy Ahmed Portfolio

Professional portfolio for Waffy Ahmed, a software engineer focused on reliability engineering, Kubernetes, deployment automation, observability, and high-throughput production systems.

Live site: [waffy.netlify.app](https://waffy.netlify.app/)

## Overview

This site presents my software engineering experience, selected projects, resume, and contact information in a fast, responsive React application. The content emphasizes production ownership, platform reliability, cloud-native infrastructure, CI/CD automation, incident response, and measurable engineering impact.

## Highlights

- Career overview with current software engineering work at The Home Depot
- Experience cards covering production operations, infrastructure, observability, and backend systems work
- Case study pages for selected reliability, deployment recovery, and data reconciliation work
- Project summaries for CDC data reconciliation, job search tooling, and campus discovery software
- Mobile-friendly resume preview with direct PDF open/download actions
- Contact form powered by Formspree
- SEO metadata with sitemap, canonical route metadata, and JSON-LD profile data
- AI-readable portfolio summary at `/ai-summary.txt` and LLM entry point at `/llms.txt`
- Netlify deployment with SPA redirects and automated deploy metadata

## Tech Stack

- React 18
- Vite
- Tailwind CSS
- React Router
- Formspree
- Vitest and Testing Library
- ESLint
- Netlify

## Repository Structure

```text
.
├── main/                 # Vite React application
│   ├── public/           # Static assets, resume, metadata, redirects
│   └── src/              # Pages, components, hooks, tests, styles
├── netlify.toml          # Netlify build configuration
├── package.json          # Root scripts forwarding into main/
└── README.md
```

## Local Development

Install dependencies from the app directory:

```bash
cd main
npm install
```

Common commands are also available from the repository root:

```bash
npm run dev      # Start the local Vite server
npm run lint     # Run ESLint
npm test         # Run Vitest
npm run build    # Build for production
npm run preview  # Preview the production build
```

## Environment Variables

Vite only exposes client-side variables prefixed with `VITE_`.

```text
VITE_GA_MEASUREMENT_ID
VITE_FORMSPREE_KEY
VITE_DEPLOY_DATE
VITE_SITE_URL
```

`VITE_DEPLOY_DATE` and `VITE_SITE_URL` are injected by the build script during production builds without rewriting local `.env` files. Local development displays the current local preview timestamp so stale `.env` values are not shown on localhost. Formspree and Google Analytics values should be provided through the local `.env` file or Netlify environment settings.

## Deployment

The site is deployed on Netlify using [netlify.toml](./netlify.toml):

- Base directory: `main`
- Build command: `npm run build`
- Publish directory: `main/dist`
- Node version: `22`

The app uses `main/public/_redirects` so client-side routes such as `/Resume`, `/Projects`, `/Experience`, and `/Contact` work after deployment.

## Releases

GitHub Actions creates a release for each push to `main` after lint, tests, and production build pass. Release tags use the format:

```text
deploy-YYYYMMDDTHHMMSSZ-<short-sha>
```

This gives each production deployment a durable GitHub release record tied to the commit that produced it.
