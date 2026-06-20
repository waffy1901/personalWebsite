# Security Header Map

## Header Source

- `netlify.toml` owns production headers.
- The main CSP is attached to `/*`.
- `main/index.html` contains inline JSON-LD with `id="portfolio-jsonld"`.

## Current Allowances

- Google Tag Manager and Google Analytics are allowed for GA4.
- Formspree is allowed for contact form submission.
- `data:` is allowed for images and fonts.
- `object-src 'self'`, `base-uri 'self'`, and `frame-ancestors 'none'` should remain restrictive.

## JSON-LD Hash

The inline JSON-LD is allowed by a `script-src 'sha256-...'` token. Any byte-level change to that script text requires a new hash.
