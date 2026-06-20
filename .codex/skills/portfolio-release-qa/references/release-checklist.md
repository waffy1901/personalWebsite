# Portfolio Release Checklist

## Fast Checks

- Run from repository root: `npm run lint`, `npm run test`, `npm run build`.
- Use `scripts/pre-push-checks.sh` as the repo hook target.
- Keep hook-safe checks deterministic and offline.

## Full Preview Checks

- Start preview with `npm run preview`.
- Smoke-check `/`, `/resume`, `/projects`, `/case-studies`, `/experience`, `/contact`, `/llms.txt`, `/ai-summary.txt`, `/portfolio.json`, and `/waffyAhmedResume.pdf`.
- Confirm legacy uppercase routes redirect to lowercase canonical routes.
- Confirm resume PDF is served and not replaced by the SPA shell.

## Netlify Readiness

- `netlify.toml` base: `main`.
- Build command: `npm run build`.
- Publish directory: `dist`.
- Node version: `22`.
- Check CSP when JSON-LD, GA4, Formspree, or asset hosts change.
