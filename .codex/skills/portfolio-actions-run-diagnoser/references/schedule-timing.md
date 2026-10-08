# Scheduled Run Timing

Read the workflow at the default-branch revision applicable to the occurrence.
Record the UTC cron and the specific expected UTC timestamp. Do not pair a run
with an expected occurrence solely by nearest time: inspect its event, workflow,
branch, run history, schedule changes, and any recorded triggering schedule.

## Separate the phases

| Phase | Evidence | Interpretation |
| --- | --- | --- |
| Expected occurrence to run creation | Expected UTC timestamp and REST run `created_at` | Trigger/run-creation delay. It precedes job execution and cannot be explained by later runner assignment alone. |
| Run creation to run start | `created_at` and `run_started_at` | Broad elapsed interval. Reruns reuse the original run creation timestamp, so this is not a rerun queue duration. |
| Job creation to job start | Job `created_at`, when present, and `started_at` | Queue/wait interval; determine concurrency, dependencies, approvals, and runner assignment from further evidence. |
| Job execution | `started_at` to `completed_at` | Execution duration, distinct from trigger and queue delay. |

The helper emits raw timestamps and durations without treating `updated_at` as
completion or substituting run creation for missing job creation. Some API
responses omit job creation or runner-assignment timestamps; preserve unknowns.
Use selected runner/setup logs or check metadata to refine assignment timing.

Collect several recent scheduled runs of the same workflow, including earlier
and later occurrences around an incident. Pair each with its intended schedule;
exclude manual runs from cron comparisons and label reruns by attempt. A missing
run is not a zero-minute delay or proof that the workflow was disabled. Check
default-branch schedule/configuration, repository inactivity rules, run retention,
and access before assigning a cause.

Check official GitHub Status incident times when relevant. An overlapping incident
is correlation; establish that its affected service and phase fit the measured
delay. State uncertainty if the incident began after run creation or does not
explain earlier lateness.

## Assess the consequence

Daily Production health provides periodic route/header/artifact contract checks.
Recurring long trigger delays leave a monitoring gap even if every job passes.
Weekly external-link, performance, WebKit, audit, and token-reminder work may
tolerate more drift; assess the actual deadline and recurrence. Changing cron
does not guarantee timely execution. Propose continuous monitoring only when the
requested reliability requirement calls for it, without installing a service as
part of diagnosis.

Use authenticated read-only tools or these CLI commands for history and selected
logs. Apply the human's existing authority before any rerun or dispatch:

```bash
rtk gh run list --repo OWNER/REPO --workflow WORKFLOW_FILE --event schedule --limit 20
rtk gh run view RUN_ID --repo OWNER/REPO --log-failed
```

API fields and attempt pagination: [workflow runs](https://docs.github.com/en/rest/actions/workflow-runs#get-a-workflow-run),
[jobs for one attempt](https://docs.github.com/en/rest/actions/workflow-jobs#list-jobs-for-a-workflow-run-attempt).

Test the timing helper with:

```bash
rtk proxy python3 .codex/skills/portfolio-actions-run-diagnoser/scripts/test_run_timing.py
```
