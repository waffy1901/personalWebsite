# Portfolio App

This directory contains the Vite React application for [waffy.netlify.app](https://waffy.netlify.app/).

The app powers Waffy Ahmed's professional portfolio, including experience, case studies, projects, resume, contact form, deploy metadata, and an AI-readable summary file.

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

`VITE_DEPLOY_DATE` and `VITE_SITE_URL` are injected by the build script without rewriting local `.env` files. Local development displays the current local preview timestamp so stale `.env` values are not shown on localhost. Provide analytics and Formspree values through a local `.env` file or Netlify environment variables.

## Notes

- Static public assets live in `public/`.
- The resume route shows a PNG resume preview while preserving direct PDF open/download links.
- `_redirects` keeps React Router routes working on Netlify.
