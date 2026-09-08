---
name: ai-discovery-maintainer
description: AI-readable portfolio discovery maintenance for Waffy Ahmed's personalWebsite. Use when Codex updates or audits llms.txt, ai-summary.txt, portfolio.json, JSON-LD profile data, AI-agent guidance, structured project/case-study metadata, sitemap discovery links, or the way AI systems should summarize the portfolio.
---

# AI Discovery Maintainer

## Workflow

1. Identify canonical inputs in `main/src/data/*`, especially `siteIdentity.js`, `publicPortfolio.js`, and route metadata in `seo.js`. For requested edits, change these inputs; keep read-only audits free of edits. Do not hand-edit generated discovery files, README blocks, JSON-LD, or its CSP hash. Preserve the intended AI summary: emphasize Waffy's backend, platform, production reliability, Kubernetes, observability, deployment automation, and incident-response work over website implementation details.
2. Run `npm run generate:public` from the repository root after changes, inspect the diff, then run `npm run generate:public -- --check`. `main/scripts/generate-public-artifacts.mjs` owns the discovery files, README blocks, JSON-LD in `main/index.html`, and its hash in `netlify.toml`. For a read-only audit, run only the freshness check.
3. Check the generated outputs: keep `llms.txt` short and navigational, `ai-summary.txt` readable and consistent with app content, and `portfolio.json` structured and stable. Keep JSON-LD aligned with canonical identity, resume, and case-study links.
4. Run the static discovery check:

```bash
node .codex/skills/ai-discovery-maintainer/scripts/check_ai_discovery.mjs /path/to/personalWebsite
```

Read [references/ai-discovery-map.md](references/ai-discovery-map.md) before large AI-discovery edits.

## Coordination

If JSON-LD changes, also use `$csp-security-header-maintainer` because the inline script hash in `netlify.toml` may need to change.
