---
name: portfolio-actions-run-diagnoser
description: Diagnose failed, cancelled, pending, flaky, late, or missing GitHub Actions runs in personalWebsite. Use for PR check failures, scheduled-run timing, runner delays, recurrence, and monitoring gaps; route workflow edits to portfolio-github-automation-maintainer.
---

# Portfolio Actions Run Diagnoser

Diagnose this repository's runs with read-only evidence. Resolve the repository from its Git remote; do not infer ownership from a run title.

1. Identify the workflow path, run ID, attempt, event, branch, exact SHA, and the user's requested phase.
2. Collect run metadata and every job for that attempt before reading selected logs:

```bash
rtk proxy bash .codex/skills/portfolio-actions-run-diagnoser/scripts/gha_run_summary.sh OWNER/REPO RUN_ID [EXPECTED_UTC_TIMESTAMP]
```

The helper requires `gh`, Python 3, and RTK. It uses read-only REST requests and reports missing or inconsistent timestamps as unknown.
3. For a late or absent scheduled run, read [references/schedule-timing.md](references/schedule-timing.md). Separate expected-trigger to creation, creation to job start, and job execution. Use job creation/runner-assignment evidence when available; run creation to job start also includes dependency and concurrency waits.
4. For failures, read the first meaningful failing step's logs. Inspect the workflow at the event's applicable revision: default branch for schedule, base branch for `pull_request_target`, and the captured inputs for manual dispatch. Avoid executing untrusted PR code in privileged contexts.
5. Classify the cause and uncertainty: app/test, dependency/runtime, workflow configuration, token/settings, external service, infrastructure, or expected advisory behavior. Compare recent scheduled occurrences and assess the workflow's purpose before recommending urgency.
6. Continue only within the human's existing grant. Diagnosis does not grant rerun, cancellation, dispatch, workflow edits, publication, merge, or closure. A matching grant already in the conversation does not need another confirmation.

Use `$portfolio-github-automation-maintainer` for workflow changes and `$portfolio-deployment-verifier` for production provenance. A green Production health run is a dated periodic observation; the weekly WebKit lane is hosted WebKit evidence, not Safari/iOS.

Report the exact workflow/run/attempt/SHA, timing phases or failing step, practical consequence, and any missing evidence. Network failures and unavailable logs leave the affected claim unverified.
