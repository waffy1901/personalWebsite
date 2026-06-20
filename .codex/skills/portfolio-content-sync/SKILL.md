---
name: portfolio-content-sync
description: Content synchronization for Waffy Ahmed's personalWebsite portfolio. Use when Codex updates profile, experience, projects, case studies, metrics, links, route slugs, public portfolio metadata, AI summaries, resume references, or recruiter-facing copy and needs to keep source data, public artifacts, SEO metadata, and discovery files aligned.
---

# Portfolio Content Sync

## Workflow

1. Treat `main/src/data/*` as the primary app content source.
2. Update dependent public artifacts when content changes: `main/public/portfolio.json`, `main/public/ai-summary.txt`, `main/public/llms.txt`, `main/public/sitemap.xml`, and route metadata in `main/src/data/seo.js`.
3. Preserve the portfolio voice: production ownership, measurable impact, reliability/platform focus, and precise technical claims.
4. Avoid trust-risk copy. In particular, never imply Firestore stores user passwords; write that FirebaseAuth handles authentication and Firestore stores profile metadata, saved jobs, and preferences.
5. Run the content sync check:

```bash
node .codex/skills/portfolio-content-sync/scripts/check_content_sync.mjs /path/to/personalWebsite
```

Read [references/content-map.md](references/content-map.md) before making broad content changes.

## Editing Rules

Keep public AI/SEO files consistent with visible portfolio content. If only wording changes, make the same meaning available in the structured JSON and AI-readable summary. If slugs or routes change, update App routes, route metadata, sitemap, llms, portfolio JSON, tests, and redirects together.
