---
name: portfolio-content-sync
description: Content synchronization for Waffy Ahmed's personalWebsite portfolio. Use when Codex updates profile, experience, projects, case studies, metrics, links, route slugs, public portfolio metadata, AI summaries, resume references, or recruiter-facing copy and needs to keep source data, public artifacts, SEO metadata, and discovery files aligned.
---

# Portfolio Content Sync

## Workflow

1. Identify the canonical content in `main/src/data/*`, including `siteIdentity.js`, `publicPortfolio.js`, and `seo.js` as applicable. For requested edits, change these inputs; keep read-only audits free of edits. Do not hand-edit generated discovery files, README blocks, JSON-LD, or its CSP hash.
2. Run `npm run generate:public` from the repository root after canonical content changes, inspect the resulting diff, then run `npm run generate:public -- --check`. `main/scripts/generate-public-artifacts.mjs` owns `portfolio.json`, `ai-summary.txt`, `llms.txt`, `sitemap.xml`, the README blocks, JSON-LD in `main/index.html`, and its hash in `netlify.toml`. For a read-only audit, run only the freshness check.
3. Preserve the portfolio voice: production ownership, measurable impact, reliability/platform focus, and precise technical claims.
4. Avoid trust-risk copy. In particular, never imply Firestore stores user passwords; write that FirebaseAuth handles authentication and Firestore stores profile metadata, saved jobs, and preferences.
5. Run the content sync check:

```bash
node .codex/skills/portfolio-content-sync/scripts/check_content_sync.mjs /path/to/personalWebsite
```

Read [references/content-map.md](references/content-map.md) before making broad content changes.

## Editing Rules

Keep public AI/SEO files consistent with visible portfolio content through canonical data and regeneration, including wording-only changes. If slugs or routes change, align App routes, canonical route metadata, tests, and redirects, then regenerate discovery outputs. Use the CSP skill when generated JSON-LD or its hash changes.
