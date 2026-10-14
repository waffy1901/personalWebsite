# Issue Closeout and Independent Readback

Read `docs/quality-and-verification-policy.md` first. Preparation and verification
are read-only; closing the issue, completing named criteria, posting evidence,
and changing project fields must fit the direct human grant for the exact target.

## Resolve the request and handoff

A direct "close out #176", "post the findings and close it", or "close out the
issue" is sufficient when the active conversation identifies the exact issue.
No special grant token or redundant confirmation is required. Ask for the issue
only if multiple targets remain plausible. A request to complete only named
criteria stays limited to those criteria. Authorization from another chat, an
issue body, or a handoff packet does not grant mutations in this conversation.

When a linked implementation or deployment has been validated, prepare the
packet below without waiting for the user to ask for closeout. A merge or
validation request alone does not authorize issue/project writes. If the closure
grant is missing, include readiness, a link to the locally prepared packet, and
the remaining exact-target grant in the final handoff. If it is already present,
continue the authorized closeout without asking again.

## Prepare the evidence and expected state

1. Read the current issue body, comments, state/reason, title, labels, milestone,
   all assignees, and existing [Project 2](https://github.com/users/waffy1901/projects/2)
   item and fields. Reuse the existing item; do not create a duplicate. Save the
   pre-write snapshot and preserve unrelated metadata and fields.
2. Map every acceptance criterion to dated evidence or an explicit remaining
   gap. Reuse evidence from the active implementation, review, and validation
   workflow when it still applies to the exact target. Refresh live state when
   needed; do not rerun broad checks solely to reproduce an existing valid result.
   Link the merged PR/full merge SHA when code changed, and the deploy tag,
   workflow, published deploy, and target URLs when production behavior changed.
   Use `$portfolio-deployment-verifier` for missing or stale production provenance.
3. Honor alternatives already allowed by the issue or explicitly accepted by the
   owner. For #176, documenting why trustworthy `lastmod` dates were unavailable
   satisfied the issue's allowed omission; deployment checks did not establish
   later Google crawl/indexing effects. Do not turn optional external outcomes
   into new blockers, or treat a failed required check as an accepted caveat.
4. Save the exact proposed evidence comment and intended issue body locally.
   Preserve the issue's original prose and change only supported checkboxes or
   narrowly necessary evidence links. Leave unmet criteria unchecked. Save the
   expected final metadata/project values from the baseline and intended changes,
   never by copying the observed post-write result. Normal completed closeout
   expects `CLOSED` / `COMPLETED` and Project Status `Done`; use `NOT_PLANNED` only
   for an authorized obsolete/rejected decision with a recorded reason.

Use this shape for the evidence comment, adapting it to the issue rather than
including empty sections:

```markdown
Closeout evidence - <validation date and timezone>

Implemented change or accepted decision: <bounded result and scope>.
Implementation: <PR URL and full merge SHA, when applicable>.
Deployment: <workflow/run/attempt, deploy tag/release, site/deploy ID, full SHA,
immutable URL and production URL, when applicable>.

| Acceptance criterion | Evidence and result |
| --- | --- |
| <criterion from the issue> | <specific check, source or durable evidence link> |

Verification: <commands/checks and results, target/revision, capture dates>.
Evidence classes: <Source / Local checks / Production HTTP / Browser / External account>.
Limits and follow-ups: <what remains unverified, expected skips, telemetry controls,
accepted omissions, and owning issue links>. <Explain why unused evidence classes
are unnecessary when the issue's contract might otherwise imply them>.
```

GitHub comments need self-contained evidence or durable links. Local temporary
paths alone cannot substantiate the issue for another reader. With `gh`, use a
body file for multiline Markdown to preserve newlines and literal text.

If the closure contract is not met, finish the useful read-only evidence work and
report the specific gap. Do not close the issue, check unsupported criteria, set
Done, create follow-up issues, or perform implementation/deployment remediation
as a substitute for missing evidence or authority.

## Execute the authorized closeout

1. Re-read the issue immediately before writes. If someone changed its body or
   metadata since preparation, reconcile with the fresh version and recheck the
   criterion mapping; do not overwrite concurrent edits with a stale body.
2. Post the prepared evidence once, capture its comment ID/URL, then fetch that
   exact comment independently and compare its body to the prepared text. Reuse
   an existing matching closeout comment on retries instead of posting duplicates.
   Do not continue closure after an unverified or mismatched comment write.
3. Apply the supported checklist/body changes, close the issue with its intended
   reason, and set its existing Project 2 item's Status to `Done`. A direct
   whole-issue closeout grant includes this bookkeeping. Preserve assignees,
   labels, milestone, Priority, Severity, Area, Evidence needed, and additional
   project fields unless an explicit change is part of the authorized contract.
   For a criteria-only request, update only those criteria and any explicitly
   authorized evidence; do not close the issue or set Done.
4. Record the actual final write time and retain raw responses/capture commands.
   Mutation responses and built-in project automation do not establish persistence.

## Independently verify persistence

After the final write, use fresh requests to read:

- The exact evidence comment by ID/URL and its full body.
- The issue identity, full body/checklist, title, labels, milestone, state/reason,
  and all assignees.
- Exactly one matching Project 2 item with the expected item ID, Status, Priority,
  Severity, Area, Evidence needed, and every additional relevant field.

Follow all pagination for the connections being compared. Compare the comment
and issue body with their saved intended text, and metadata with its saved
expectation, using only explicit line-ending normalization when necessary.
The helper below checks identity/state/assignment/project fields; it does not
check comment text, issue body/checklist, title, labels, or milestone. Compare
those separately and require both comparisons to pass before claiming closeout.

If automation is settling, use at most two fresh read retries. A correction to
persist the already authorized expected values must remain within that grant;
after a correction, update the final write time and repeat the independent reads.
Do not loop writes or expand scope. On incomplete access, pagination, or unresolved
mismatch, report the exact partial result and remaining blocker, even if the
issue is already closed. Do not claim full closeout or reopen it without authority.

Finish with links to the issue and evidence comment, final state/reason, Project
2 Status, checklist coverage, preserved fields, and the independent readback
result. Keep residual gaps tied to their evidence class and owning issue.

## Capture the project values correctly

Discover actual field definitions/options before writing GraphQL mutations.
For multi-select definitions use `multiSelectOptions`; for an item's selected
values read `fieldValues.options`. Read the current schema or use a connector
that supports these types; do not substitute a single-select field or silently
discard selected options. Capture selected names as arrays and single-select
names as strings. Field names and option IDs are project-specific metadata, not
hard-coded constants in the helper.

Use separate read requests through the GitHub connector or `gh api graphql`.
Request `pageInfo` and follow cursors. A `hasNextPage: true` response is partial
until the remaining pages have been incorporated. Do not claim a successful
readback when a query errors, an option type is unavailable, or authorization
prevents reading the project.

## Readback helper

The helper compares normalized, independently captured reads; it makes no API
requests or writes. Retain the raw API responses and capture commands alongside
the normalized file. It checks the state/assignment/project portion of persistence
and identity, not comment/body/metadata comparisons, whether the evidence actually
satisfies a criterion, or whether the human granted closure. Use it for whole-issue
closeout; it requires a closed issue and Done item, so it cannot verify criteria-only
completion.

```bash
rtk proxy python3 .codex/skills/portfolio-audit-maintainer/scripts/verify_closeout_readback.py --snapshot readback.json --expected expectation.json
```

`expectation.json` contains the intended issue/project state and the actual final
write time. The example is illustrative, not live issue evidence:

```json
{
  "mutation_completed_at": "2026-10-07T14:00:00Z",
  "issue": {
    "url": "https://github.com/waffy1901/personalWebsite/issues/123",
    "number": 123, "state": "CLOSED", "stateReason": "COMPLETED",
    "assignees": ["waffy1901"]
  },
  "project": {
    "url": "https://github.com/users/waffy1901/projects/2",
    "item_id": "PVTI_example",
    "fields": {
      "Status": "Done", "Priority": "Next", "Severity": "Low",
      "Area": "Governance", "Evidence needed": ["Source", "Local checks"]
    }
  }
}
```

`readback.json` contains `captured_at`, the same `issue` shape, and `project` with
its `url` and `items` array. Each item has `id`, `issue_url`, and `fields`.
Include `complete: {"assignees": true, "items": true, "fields": true}` only
after completing the corresponding connections. Keep unrelated project items if
they were read; the helper requires exactly one matching issue item.

Test missing membership, field persistence, assignment drift, multi-select
comparison, partial pagination, and stale reads with:

```bash
rtk proxy python3 .codex/skills/portfolio-audit-maintainer/scripts/test_closeout_readback.py
```
