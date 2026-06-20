---
name: csp-security-header-maintainer
description: CSP and security-header maintenance for Waffy Ahmed's Netlify-hosted personalWebsite. Use when Codex changes inline JSON-LD, Google Analytics, Formspree, external assets, Netlify headers, Content-Security-Policy hashes, redirects, frame/object/base policies, or wants to verify that structured data is not blocked by security headers.
---

# CSP Security Header Maintainer

## Workflow

1. Inspect `netlify.toml` before changing any external script, form, image, frame, or connection behavior.
2. If `main/index.html` JSON-LD changes, recompute the `script-src` SHA-256 hash.
3. Keep the CSP narrow: allow only self, the inline JSON-LD hash, Google Tag Manager/Analytics, Formspree, data fonts/images when needed, and no object/frame embedding beyond current requirements.
4. Run the CSP hash check:

```bash
node .codex/skills/csp-security-header-maintainer/scripts/check_csp_jsonld_hash.mjs /path/to/personalWebsite
```

Read [references/security-header-map.md](references/security-header-map.md) before changing headers.

## Coordination

Use this skill after `$ai-discovery-maintainer` when JSON-LD changes. Use a broader security scan only when the user asks for repository-wide security review.
