# Automatic post-merge issue closeout

`Post-deploy issue closeout` follows a successful `Create deployment release`
**push** run on `main`. It can close one issue from that exact merged PR, after
checking every required criterion, the exact production deployment, and the
existing Project 2 item. The workflow reports its disposition in the summary and
retained result artifact. Missing evidence leaves the issue open. The workflow
does not post gap comments.

The repository owner approved this bounded automatic path as standing permission.
That permission belongs only to `.github/workflows/post-deploy-closeout.yml` and
`scripts/post_deploy_closeout.py` under the gates below. A contract is evidence
configuration, not authority. A merge, validation result, or contract never grants
a chat agent permission to perform manual closure, dispatch this workflow, merge,
release, deploy, remediate, or close another issue. Manual closeout retains the
[direct-grant policy](quality-and-verification-policy.md#closure-contract).

## Preparing an implementation PR

For issue work, add `Refs #N` to the PR body. A direct URL to an issue in this
repository also declares that issue. Use non-closing references so merging cannot
bypass deployment validation. Bare numbers, PR links, and links to other
repositories do not declare a closeout target. Put the declaration in the PR's
own prose. The check ignores examples in code spans, fenced code, comments,
and blockquotes.

- For automatic closeout, declare exactly one issue and add or modify its
  `.github/closeout/issue-N.json` in the same-repository PR. Read the current
  issue body and Project 2 `Evidence needed` and map every required criterion to
  a check that exercises it. Have the reviewer inspect the map with the source
  and tests.
- For manual closeout, declare the issue or issues and add one plain
  `Manual closeout: <reason>` line outside quotes, comments, and code blocks.
  Name what remains to be verified or done, for example
  `Manual closeout: Owner must approve the wording and verify enlarged text in a browser.`
  Omit a contract. The disposition records the follow-up and prevents automatic
  writes. Manual closure still needs its own authorization.
- Issue-free maintenance and dependency PRs need neither field.

The required `Validate portfolio surfaces` job checks preparation on PR opens,
reopens, pushes, and description edits. It reads the current PR metadata and
complete changed-file list. For an automatic contract it checks the data schema,
issue body fingerprint, and line coverage with a read-only GitHub token. The
reviewer still checks the semantic mapping. Project fields, upstream evidence,
current production identity, and write access are checked after merge.

Version 1 accepts exactly one added or modified contract. Renames, removals,
multiple contracts, and a contract for a different issue fail preparation.
An unchanged contract from an earlier PR is never swept retrospectively.

Example issue body (including its final newline):

```markdown
## Acceptance
- [ ] Canonical route status checks pass in production.
```

Its minimal contract would be:

```json
{
  "version": 1,
  "issue": 123,
  "body_sha256": "6eb7f25063b3e3d0b54f5f7f57fec5e3beff78befcaf8f9dac12905e33d24e1a",
  "evidence_needed": ["Production HTTP"],
  "requirements": [
    {
      "line": 2,
      "text": "- [ ] Canonical route status checks pass in production.",
      "evidence": ["http.routes"]
    }
  ],
  "context_lines": [1]
}
```

Use the actual issue number/body, not this example. Hash the exact UTF-8 body
returned by GitHub with SHA-256; do not trim or normalize it. Lines are one-based.
Every nonblank line must appear exactly once as a requirement or context.
Checklist lines, including previously checked tasks, must be requirements. Map
non-checklist requirements explicitly too. Headings/background may be context;
calling a requirement "context" is a reviewer-visible mistake, not a waiver.
`text` must be the exact source line. Empty evidence, unknown keys/IDs, duplicate
JSON keys/lines, incomplete coverage, and body drift block closure. The script
changes only task checkbox characters in the body.

Validate the schema locally with:

```bash
rtk proxy python3 scripts/post_deploy_closeout.py --validate-contracts .github/closeout
rtk proxy python3 scripts/test_post_deploy_closeout.py
```

The focused fixture job validates schema and offline guard behavior. Runtime
also checks the fresh issue fingerprint and line coverage before writes.

## Evidence catalog and limits

| ID | Evidence class | Exact upstream evidence |
| --- | --- | --- |
| `source.merged_pr` | Source | Associated same-repository merged PR and exact merge SHA; reviewed source interpretation |
| `checks.lint` | Local checks | Verify app / Lint |
| `checks.test` | Local checks | Verify app / Test |
| `checks.build` | Local checks | Verify app / Build |
| `checks.csp` | Local checks | Create release / Verify CSP JSON-LD hash |
| `http.immutable` | Production HTTP | Create release / Validate immutable deployment |
| `http.routes` | Production HTTP | Create release / Validate deployed routes |
| `http.headers` | Production HTTP | Create release / Validate deployed security headers |
| `http.artifacts` | Production HTTP | Create release / Validate deployed artifacts |
| `http.legacy_redirect` | Production HTTP | Create release / Validate legacy Netlify domain redirect |

The current `check-deployed-routes.py`, header, and artifact checkers define the
scope of each HTTP claim; read them when mapping a criterion. `checks.test` is
useful only when the merged tests actually cover that requirement. `source.merged_pr`
records the reviewed diff; it does not mechanically prove arbitrary source
behavior. The human-reviewed map remains a semantic trust boundary. Generic green
CI cannot establish arbitrary UI, provider, security-setting, business-outcome,
or accessibility claims.

Version 1 has no trusted Browser or External account evidence IDs. Such a required
class in the issue/map or Project `Evidence needed` blocks automatic closure.
The advisory production browser job is excluded from the catalog. Use manual
closeout for requirements such as layout behavior, mobile Safari/iOS, analytics
receipt, and real contact delivery.

Every declared evidence class must be supplied by the mapped IDs and exactly
match the current Project 2 `Evidence needed`. Required evidence in the issue's
prose must also be mapped; do not omit it merely because the Project field is stale.
The workflow itself performs no browser/form checks or production writes.

## Provenance and write gates

The workflow checks out its trusted default-branch workflow revision, not an
upstream PR branch or downloaded artifact. The helper fetches contracts and the
upstream release workflow as data at `workflow_run.head_sha`; it never executes
contract text or URLs. `GITHUB_SHA` is not used as deployment identity. The
upstream workflow file must match the helper's reviewed SHA-256 pin; changes to
that workflow require a deliberate catalog/pin review and fixture update.

The helper requires a completed successful same-repository `push` run on `main`,
its exact current attempt, matching job SHAs, and individually successful required
steps. A green run with a skipped Netlify release does not qualify. It completes
pagination for run jobs, associated PRs/files, releases, comments, issue assignees
and labels, Project membership/definitions/values, and nested field connections.
Completion must be no more than 24 hours old. A newer attempt invalidates old
evidence; retries do not silently substitute its results.

The matching non-draft `deploy-*` release must have been published within this
attempt's `Create GitHub release` step and identify the exact run, SHA, deployment
ID and immutable URL. The tag is independently peeled to its commit. The existing
Netlify publication classifier verifies the site's current ready production
`published_deploy`, site identity, custom domain, SHA, deployment ID and immutable
URL. That identity is reread before each write and at final readback. Prior HTTP
results are explicitly dated to their upstream run; they are not a new browser
or live HTTP sweep. Production advancing, a skipped deploy, malformed metadata,
or another deployment of the same SHA leaves closeout pending.

Before the first write, the helper captures and checks issue write access, Project
write access, the full issue body/metadata, all comments, exactly one existing
unarchived Project 2 item, definitions/options and all supported fields. It never
adds a Project item. Unsupported extra field/value types block before writes,
including organization issue fields that version 1 cannot normalize. Supported
extra scalar, iteration, select, and nested built-in values are preserved. Only
built-in `Updated`/`Closed` lifecycle values are excluded from equality because
closing the issue changes them; custom fields with those names are preserved.

The comment stores SHA-256 fingerprints of the complete original and expected
final issue and Project snapshots. Full snapshots stay in memory, including values
that a Project credential can see on an otherwise public item. Project 2 and every
returned Project membership must be public for the workflow to proceed.

Writes are limited to:

1. One self-contained evidence comment with a stable run/attempt/issue/SHA marker
   and the original and expected snapshot fingerprints. Verify its identity,
   author and exact body before closure.
2. A checkbox-only body update and `CLOSED` / `COMPLETED` in one issue update.
3. The existing Project 2 item's `Status: Done`, if it is not already Done.

Title, labels, milestone, all assignees, Priority, Severity, Area, Evidence needed,
extra fields, and membership are compared against the saved expectation. Final
independent requests verify the exact comment/body, issue state/reason, metadata,
membership and field values. Mutation responses alone are never success.

Closeout jobs are serialized. Before each write the helper rechecks the PR
identity and body, the issue, comments, and Project item. Changes stop further
writes. GitHub does not offer a transaction across these resources, so a change
can still race with a write. Independent readback checks the resulting values.
A partial failure produces a failed job and records the attempted stages in the
artifact.

The summary and result artifact report these outcomes:

| Status | Meaning |
| --- | --- |
| `verified` | Closure and Project status passed independent readback. |
| `manual` | The exact merged PR declared manual follow-up. See its body for the reason. |
| `no_issue` | The exact merged PR declared no closeout issue. |
| `not_prepared` | The PR lacked the required disposition or its changed contract was invalid. The job fails before any write. |
| `pending` | Provenance, access, or evidence checks stopped the run before a write attempt. The job records a warning with the reason. |
| `partial` | The job failed after attempting a write. Review the recorded stages. |

PR [#346](https://github.com/waffy1901/personalWebsite/pull/346) declared
`Refs #340` and needed owner and browser verification. It had neither a changed
contract nor a manual disposition. The preparation check now fails that case,
and runtime records `not_prepared` if it reaches production.

Rerunning the **closeout workflow's existing run** can reuse its exact bot-authored
comment and original expectation. An independent GitHub edit-history check
rejects edited comments even if someone restored the original text. A rerun
reuses the existing comment and respects manual closure. A completed issue
can resume only when the last close event is by `github-actions[bot]` after that
comment and all expected values match.
Uncertain authorship, edited evidence, different markers, changed metadata, stale
run evidence, or expired credentials require manual reconciliation. It never
reopens issues, creates follow-up issues, redeploys, or retries writes in a loop.

## One-time setup and operation

Publication and credential setup are separate authorized operations. Local
implementation does not install or activate the workflow or configure secrets.

After review/publication, the repository needs:

- Existing `NETLIFY_AUTH_TOKEN` and `NETLIFY_SITE_ID` for read-only publication reads.
- `CLOSEOUT_PROJECT_TOKEN`, a separate user credential with Projects read/write
  access to the owner's Project 2 and read access to the repository's issue
  membership. For a classic PAT, GitHub documents the `project` scope. Keep the
  account/token scope as narrow as GitHub's user-Project model supports; avoid
  unnecessary repository write scopes. Rotate it under the owner's normal secret
  process. The built-in `GITHUB_TOKEN` cannot access user Projects v2.

Only the closeout job gets `issues: write`; its built-in token otherwise has
contents, Actions, and pull-request reads. The Project credential is passed only
to the Python step and used only for Project GraphQL reads and the Status mutation.
Tokens are never stored in the evidence comment/artifact. No OpenAI key or new
service/dependency is needed. Missing credentials produce a pending summary with
no comments, closures, or Project mutations.

An exact-PR/SHA merge approval must acknowledge automatic deploy validation,
deploy tag/release creation, advisory browser checks, and eligible automatic issue
closeout. No extra manual "close it" prompt is needed for the bounded automatic
path. Manual issue work continues to require its own matching grant.

To disable, disable `Post-deploy issue closeout` in Actions or remove its Project
credential; removing the workflow in a reviewed PR also disables future runs.
Removing a contract affects future merges, not an in-flight run's exact-SHA data.
To stop a running closeout, cancel it and inspect the partial result; cancellation
can occur between API writes. Reverting code does not undo an evidence comment,
closed issue, or Project status. Reopening or other corrective writes need a
separate direct instruction and fresh reads. No rollback runs automatically.

Authoritative references: [workflow_run](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#workflow_run),
[Projects authentication](https://docs.github.com/en/issues/planning-and-tracking-with-projects/automating-your-project/automating-projects-using-actions),
[Project GraphQL types](https://docs.github.com/en/graphql/reference/projects), and
[exact-attempt jobs](https://docs.github.com/en/rest/actions/workflow-jobs#list-jobs-for-a-workflow-run-attempt).
