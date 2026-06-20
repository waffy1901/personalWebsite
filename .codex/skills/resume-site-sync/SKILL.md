---
name: resume-site-sync
description: Resume asset and portfolio-reference synchronization for Waffy Ahmed's personalWebsite. Use when Codex updates, replaces, previews, validates, links, opens, downloads, or summarizes the resume PDF; refreshes the resume preview image; checks resume route behavior; or keeps resume links in portfolio JSON, AI summary, llms.txt, redirects, and tests aligned.
---

# Resume Site Sync

## Workflow

1. Confirm the canonical PDF path is `main/public/waffyAhmedResume.pdf`.
2. Confirm the preview image path is `main/public/resume-preview.png`.
3. Keep `main/src/data/profile.js`, `main/src/pages/Resume.jsx`, `main/public/portfolio.json`, `main/public/llms.txt`, `main/public/ai-summary.txt`, and `main/public/_redirects` aligned with the canonical PDF.
4. Use the existing `pdf:pdf` skill when resume visual rendering, text extraction, or PDF inspection matters.
5. Run the resume asset check:

```bash
node .codex/skills/resume-site-sync/scripts/check_resume_assets.mjs /path/to/personalWebsite
```

Read [references/resume-map.md](references/resume-map.md) when replacing or regenerating resume assets.

## Validation

After changes, run the app test that covers `/resume`, then run build. For visual changes, render or inspect the resume preview on mobile and desktop widths before finishing.
