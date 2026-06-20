---
name: ai-discovery-maintainer
description: AI-readable portfolio discovery maintenance for Waffy Ahmed's personalWebsite. Use when Codex updates or audits llms.txt, ai-summary.txt, portfolio.json, JSON-LD profile data, AI-agent guidance, structured project/case-study metadata, sitemap discovery links, or the way AI systems should summarize the portfolio.
---

# AI Discovery Maintainer

## Workflow

1. Preserve the intended AI summary: emphasize Waffy's backend, platform, production reliability, Kubernetes, observability, deployment automation, and incident-response work over website implementation details.
2. Keep `main/public/llms.txt` short and navigational.
3. Keep `main/public/ai-summary.txt` comprehensive, readable, and consistent with app content.
4. Keep `main/public/portfolio.json` valid, structured, and stable for programmatic consumers.
5. Keep JSON-LD in `main/index.html` aligned with canonical identity, resume, and case-study links.
6. Run the static discovery check:

```bash
node .codex/skills/ai-discovery-maintainer/scripts/check_ai_discovery.mjs /path/to/personalWebsite
```

Read [references/ai-discovery-map.md](references/ai-discovery-map.md) before large AI-discovery edits.

## Coordination

If JSON-LD changes, also use `$csp-security-header-maintainer` because the inline script hash in `netlify.toml` may need to change.
