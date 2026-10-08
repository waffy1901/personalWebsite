---
name: portfolio-deployment-verifier
description: Verify read-only production deployment provenance and live evidence for an exact personalWebsite merge SHA. Use for post-merge deployment checks, Netlify published-deploy identity, deploy release validation, CI-only skipped deploys, or production advancing beyond the requested commit; use portfolio-release-qa for local pre-push readiness.
---

# Portfolio Deployment Verifier

Bind production claims to an exact commit and a dated provider snapshot. This skill verifies evidence; it grants no merge, release, deploy, workflow dispatch, issue closure, or remediation.

1. Check repository status without altering the checkout. Resolve the target PR's actual merge SHA or the exact commit explicitly supplied by the user. Keep the reviewed PR head distinct from its merge SHA.
2. Read `docs/release-versioning.md`, `.github/workflows/release-on-deploy.yml`, and [references/deployment-evidence.md](references/deployment-evidence.md). Inspect the workflow at the target revision if behavior has since changed.
3. Collect the exact release-on-deploy run and attempt, the Netlify site object, and any matching non-draft `deploy-*` release with its independently resolved tag commit. Use the site's `published_deploy` as current production authority. Newest deploy attempts, semantic release tags, and green CI alone do not establish current production.
4. Classify skipped, pending, failed, malformed, different-commit, and exact-target evidence. Reuse `scripts/check_netlify_deploy_state.py` for the exact target's skipped/no-content signal. A CI-only skip can establish source/CI evidence while production remains on a previous commit. Say production advanced only after checking ancestry.
5. When live behavior is in scope and the target is still published, use the existing route, header, and artifact HTTP validators with expectations from that exact revision. Keep HTTP, browser, and real provider delivery evidence separate. Use `$telemetry-safe-browser-qa` for browser work; mocked analytics/Formspree and hosted WebKit have their own limits.
6. Re-read the site pointer after live checks. If it changed, report the race and repeat only the bounded reads needed to identify the serving revision. Do not combine observations from different deployment instances as one verified result, even when their SHAs match.

For repeatable provenance checks against captured JSON, use:

```bash
rtk proxy python3 .codex/skills/portfolio-deployment-verifier/scripts/verify_deployment_evidence.py --packet /path/to/evidence.json
```

The helper validates snapshot consistency and exact workflow/tag/deploy links. It does not fetch providers or verify live behavior. Missing evidence stays incomplete.

Report target merge SHA, workflow/run/attempt, serving SHA and deploy ID, release/tag and resolved SHA, target URL, capture times, evidence classes, and residual gaps. When closeout is separately authorized, hand the packet to `$portfolio-audit-maintainer`.
