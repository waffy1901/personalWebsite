# Exact Deployment Evidence

Use `docs/release-versioning.md` and the target revision's
`.github/workflows/release-on-deploy.yml` for the maintained release contract.
Resolve the repository from Git; this skill belongs to
`waffy1901/personalWebsite`, serving `https://waffy.dev`.

## Read-only collection

Read the merged PR and record its actual merge commit, separately from the
reviewed head. For an explicitly supplied commit, resolve its full SHA and record
how it was selected. Collect the release workflow run at that SHA, including its
attempt, jobs, and selected deployment/release logs. A successful run may have
skipped release creation after a CI-only Netlify skip.

```bash
rtk gh pr view PR_NUMBER --repo waffy1901/personalWebsite --json url,mergedAt,mergeCommit,headRefOid
rtk proxy gh api repos/waffy1901/personalWebsite/actions/runs/RUN_ID
rtk proxy gh api --paginate --slurp 'repos/waffy1901/personalWebsite/actions/runs/RUN_ID/attempts/ATTEMPT/jobs?per_page=100'
```

Use the authenticated Netlify connector/API to read `GET /api/v1/sites/{site_id}`.
Confirm the site's identity and custom domain from provider metadata. Retain the
site object's `published_deploy`, its ready state, exact `commit_ref`, safe ID,
and HTTPS `deploy_ssl_url` or `ssl_url`. Record capture time. No tokens or
authorization headers belong in evidence files or user-facing output.

Read production-filtered deploy attempts only to diagnose pending/failure/skip
state for the exact target. A ready newer attempt is not serving authority until
the site points to it. Reuse `scripts/check_netlify_deploy_state.py` for the exact
`skipped: true` or exact no-content cancellation signal. Generic build errors,
an absent target attempt, a successful workflow, and changed-files guesses do
not prove a skip.
The raw attempt's `site_id` must match the independently confirmed expected site;
the helper rejects a missing or different site identity before classifying a skip.

Find a non-draft, non-prerelease `deploy-*` release for the target; do not select
the newest release or a `v*` semantic release as a substitute. Read its tag ref
and peel annotated tag objects until reaching the commit. Compare that SHA to
the target; `target_commitish: main` is not resolved commit evidence. Retain the
release URL/body with exact workflow and Netlify deploy links. If no release has
been found, complete pagination before claiming absence.
The helper compares complete standalone URL tokens, as emitted by the release
workflow. A longer run ID, lookalike host, port, path, query, or fragment cannot
substitute for the expected workflow or published-deploy URL.

## Snapshot classification helper

The packet has these keys:

| Key | Captured value |
| --- | --- |
| `target_sha` | Exact lowercase 40-character merge/explicit target SHA |
| `site_id` | Provider-confirmed site ID, without any token |
| `site_before`, `site_after` | Each is `{ "captured_at": "UTC timestamp", "site": <raw site object> }` |
| `workflow` | Raw REST run object, with repository/path/ref/SHA/attempt identity |
| `release` | Matching raw REST release object, or null |
| `resolved_tag` | `{ "tag_name": "deploy-...", "commit_sha": "resolved full SHA" }`, or null |
| `target_attempt` | Optional raw production deploy object with matching `site_id`, used to confirm a skip |
| `ancestry` | Optional `{ "ancestor": target_sha, "descendant": serving_sha, "is_ancestor": true }`, backed by a retained ancestry check |

Keep raw responses and collection commands next to the assembled packet.
Do not manufacture missing fields, normalize away a failed read, or infer a
timestamp/URL from a release name. The helper checks provider snapshot consistency
and provenance links; it cannot authenticate a supplied file or prove the capture
method. Inspect the source of the evidence before relying on it.

The helper returns `exact_target`, `target_skipped`, `different_commit`,
`production_advanced`, or `production_changed_during_checks`. It rejects malformed
identity or non-ready published metadata. `production_advanced` requires recorded
ancestry; a different SHA alone does not imply forward movement. Exit 0 means
either exact provenance passed or a successful workflow's skipped target was
classified; inspect `classification` and `provenance_verified`. It never sets
`live_behavior_verified` true. Exit 1 means incomplete/raced/non-target evidence;
exit 2 means invalid input. No branch grants mutation authority.

## Bind behavior to the serving revision

For a current exact target, select the checks required by the change and claim.
Run existing HTTP validators with source expectations from an isolated read-only
snapshot of that SHA, rather than an unrelated newer checkout:

```bash
rtk proxy python3 scripts/check-deployed-routes.py --repo /path/to/exact-revision --site-url https://waffy.dev
rtk proxy python3 scripts/check-deployed-security-headers.py --repo /path/to/exact-revision --site-url https://waffy.dev
rtk proxy python3 scripts/check-deployed-artifacts.py --repo /path/to/exact-revision --site-url https://waffy.dev
```

Retain the date, URL, command, exit status, and relevant output. Missing/blocked
HTTP access does not establish healthy routes or headers. Local lint/test/build
does not repair an evidence gap about an already-deployed target. Avoid rerunning
local suites unless a separate local claim needs them.

Read the site pointer again after checks. An unchanged pointer brackets the
observations but cannot rule out an unobserved transient switch between reads.
If it changed, stop assigning the combined observations to the requested target.
Report the new serving SHA; do not merge, dispatch, redeploy, retag, or change an
issue to force the result. If production has advanced, an immutable deploy URL
may support historical deploy HTTP/browser evidence; label it historical and
separate it from the current custom-domain result.

For browser checks, use `$telemetry-safe-browser-qa` and the exact target's browser
fixtures. Record engine and viewport. Intercepted analytics/Formspree prove local
application behavior, not real receipt/delivery. Hosted WebKit proves that engine,
not Safari or iOS. External provider receipt requires its own authorized evidence.

Test the helper's false-success and race boundaries with:

```bash
rtk proxy python3 .codex/skills/portfolio-deployment-verifier/scripts/test_deployment_evidence.py
```
