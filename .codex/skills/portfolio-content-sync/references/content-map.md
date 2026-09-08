# Portfolio Content Map

## Primary Content Files

- `main/src/data/profile.js`: identity, intro, contact copy, social links, resume paths, deploy info.
- `main/src/data/experience.js`: work, ownership, extracurricular experience.
- `main/src/data/projects.js`: project cards and project stats.
- `main/src/data/caseStudies.js`: case-study listing and detail pages.
- `main/src/data/seo.js`: canonical route metadata and keywords.
- `main/src/data/siteIdentity.js`: shared identity, employment, and canonical site URLs.
- `main/src/data/publicPortfolio.js`: structured public portfolio, discovery, and AI-guidance fields.
- `main/src/data/resume.mjs`: canonical data for generated resume assets and the semantic resume HTML alternative.

## Public Discovery Files

`main/scripts/generate-public-artifacts.mjs` derives these files, the README blocks, JSON-LD in `main/index.html`, and its CSP hash from canonical inputs. Edit the inputs, run `npm run generate:public`, inspect the diff, and check freshness with `npm run generate:public -- --check`; do not hand-edit generated output.

- `main/public/portfolio.json`: structured public data for machines and AI systems.
- `main/public/ai-summary.txt`: comprehensive plain-text portfolio summary.
- `main/public/llms.txt`: concise AI-agent entry point.
- `main/public/sitemap.xml`: canonical route discovery.

## Copy Guardrails

- Lead with reliability, platform ownership, Kubernetes, observability, deployment automation, incident response, and measurable impact.
- Prefer precise metrics already supported by the repo.
- Avoid wording that implies insecure credential storage. For Job Search Aid, say FirebaseAuth handled email/password authentication and Firestore stored profile metadata, saved jobs, and preferences.
- Keep public-facing claims consistent across app data, JSON, AI summary, and README.
