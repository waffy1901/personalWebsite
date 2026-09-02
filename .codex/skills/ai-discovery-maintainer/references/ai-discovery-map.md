# AI Discovery Map

## Files

- `main/public/llms.txt`: short entry point for AI systems.
- `main/public/ai-summary.txt`: long-form plain-text portfolio summary.
- `main/public/portfolio.json`: structured data for tools.
- `main/index.html`: JSON-LD profile graph and alternate links.
- `main/public/sitemap.xml`: discoverable canonical URLs.

## Canonical Inputs

- `main/src/data/siteIdentity.js`: shared name, employment, and canonical URL values.
- `main/src/data/publicPortfolio.js`: structured public-portfolio and AI-guidance fields.
- `main/src/data/resume.mjs`: semantic resume content to cross-check when discovery copy refers to resume material; it feeds resume generation and `ResumeDocument`, not the public-discovery generator.
- `main/scripts/generate-public-artifacts.mjs`: generates the public discovery files and README blocks from canonical modules; do not hand-edit generated blocks.

## Summary Emphasis

Emphasize backend/platform reliability over the website implementation. Strong topics include Kubernetes autoscaling, production operations, CI/CD modernization, observability, incident response, credential rotation, CVE remediation, Cassandra, Elasticsearch, BigQuery, Java, Python, and public health data reconciliation.

## Coordination

When case-study slugs, project IDs, resume links, social links, or site domain change, update all discovery files together.
