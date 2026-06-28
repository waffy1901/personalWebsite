# Waffy Ahmed Portfolio

Professional portfolio for Waffy Ahmed, a software engineer focused on reliability engineering, Kubernetes, deployment automation, observability, and high-throughput production systems.

Live site: [waffy.dev](https://waffy.dev/)

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
- AI-readable portfolio summary at `/ai-summary.txt`, LLM entry point at `/llms.txt`, and structured data at `/portfolio.json`
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

`VITE_DEPLOY_DATE` is injected by the build script during production builds without rewriting local `.env` files. The production build pins `VITE_SITE_URL` to `https://waffy.dev`, so Netlify should not override it with an environment variable. Local development displays the current local preview timestamp so stale `.env` values are not shown on localhost. Formspree and Google Analytics values should be provided through the local `.env` file or Netlify environment settings.

## Analytics

When `VITE_GA_MEASUREMENT_ID` is set, the app loads Google Analytics with manual SPA page views and portfolio-specific engagement events. The tracked events are:

- `page_view`
- `resume_open`
- `resume_download`
- `social_link_click`
- `project_source_click`
- `project_details_open`
- `case_study_card_click`
- `case_study_link_click`
- `contact_form_submit`
- `contact_form_success`
- `contact_email_click`

Recommended GA4 key events are documented in [docs/analytics.md](./docs/analytics.md). The highest-signal candidates are `resume_download`, `contact_form_success`, `project_source_click`, and `case_study_link_click`.

## Security Automation

Lightweight GitHub-side checks cover Dependabot updates, npm audit, the existing CodeQL/default setup, secret scanning settings, and deployed security-header verification. Setup and ownership notes are documented in [docs/security-automation.md](./docs/security-automation.md).

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

The release workflow uses the `NETLIFY_AUTH_TOKEN` repository secret to verify the matching Netlify production deploy before publishing a release. Token rotation and reminder setup are documented in [docs/netlify-token-rotation.md](./docs/netlify-token-rotation.md).
