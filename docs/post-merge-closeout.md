# Automatic post-merge issue closeout

`Post-deploy issue closeout` follows a successful `Create deployment release`
**push** run on `main`. It can close one issue from that exact merged PR, after
checking every required criterion, the exact production deployment, and the
existing Project 2 item. Missing evidence leaves the issue open and produces a
pending result in the workflow summary/artifact. It does not post gap comments.

The repository owner approved this bounded automatic path as standing permission.
That permission belongs only to `.github/workflows/post-deploy-closeout.yml` and
`scripts/post_deploy_closeout.py` under the gates below. A contract is evidence
configuration, not authority. A merge, validation result, or contract never grants
a chat agent permission to perform manual closure, dispatch this workflow, merge,
release, deploy, remediate, or close another issue. Manual closeout retains the
[direct-grant policy](quality-and-verification-policy.md#closure-contract).

## Preparing an implementation PR

The implementation and publisher skills prepare `.github/closeout/issue-N.json`
as part of normal scoped issue work, without another permission prompt. Read the
current issue's full body and Project 2 `Evidence needed`; map each required
criterion to checks that actually exercise it. Use `Refs #N`, not closing keywords,
so merge cannot bypass deployment validation. Have the reviewer inspect the map
alongside the source and tests. No live contract is included with this automation.

Version 1 processes exactly one added or modified contract in the exact merged
PR's complete changed-file list. Renames, removals, multiple contracts, multiple
exact associated PRs, missing contracts, forks, or incomplete pagination stay
pending. Existing unchanged contracts are never swept retrospectively.

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

PR checks validate schema and offline guard behavior. Runtime also validates the
fresh issue fingerprint and full line coverage. A schema pass is not evidence
that the mapping is semantically correct.

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
The advisory production browser job is deliberately excluded. It cannot establish
arbitrary layout behavior, mobile Safari/iOS, analytics receipt, or real contact
delivery. Do not relabel those requirements to fit the catalog; leave them pending
for ordinary evidence collection and separately authorized manual closeout.

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

The durable baseline in the comment is readable data (base64 is not encryption).
Project 2 and every returned Project membership must still be public before that
baseline can be published or resumed; private or inaccessible memberships block
all writes. No private Project field values are copied to a public issue.

Writes are limited to:

1. One self-contained evidence comment with a stable run/attempt/issue/SHA marker
   and a durable original expectation. Fetch its exact body back before closure.
2. A checkbox-only body update and `CLOSED` / `COMPLETED` in one issue update.
3. The existing Project 2 item's `Status: Done`, if it is not already Done.

Title, labels, milestone, all assignees, Priority, Severity, Area, Evidence needed,
extra fields, and membership are compared against the saved expectation. Final
independent requests verify the exact comment/body, issue state/reason, metadata,
membership and field values. Mutation responses alone are never success.

Closeout jobs are serialized. Fresh issue/comment/Project reads precede each
write; changes stop further writes. GitHub does not offer a transaction across
these resources, so a narrow read/write race remains possible. Independent
readback detects drift; the workflow never overwrites metadata to "repair" it.
A partial failure is an explicit failing result, with the attempted stages in the
artifact, not a claim that closeout completed.

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
