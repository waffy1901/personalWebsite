# Authorized Closeout and Independent Readback

Read `docs/quality-and-verification-policy.md` first. Preparation and verification
are read-only; closing the issue, completing named criteria, posting evidence,
and changing project fields must fit the direct human grant for the exact target.
Use existing matching authorization without asking again. A grant to merge or
verify production does not grant closeout.

1. Before writes, map every acceptance criterion to dated evidence. Link the
   implementation, merged PR/SHA, relevant checks, and deployment evidence when
   production changed. Use `$portfolio-deployment-verifier` for that provenance.
   State why Browser or External account evidence is unnecessary when applicable.
2. Read the existing issue and Project 2 item. Preserve assignment, priority,
   severity, area, and evidence-needed values unless the grant or established
   issue contract calls for an explicit change. Set expected values from this
   pre-write snapshot and the authorized closeout, rather than from the result.
3. Complete the authorized writes only after the criterion/evidence mapping is
   reviewable. Record their completion time. Use fresh, independent reads after
   the last write, rather than trusting returned mutation objects or automation.
4. Read the issue state/reason and all assignees, and independently find its item
   in [Project 2](https://github.com/users/waffy1901/projects/2). Read Status,
   Priority, Severity, Area, Evidence needed, and any additional fields relevant
   to the issue. Follow all pages for assignees, project items, and field values.
5. Compare those reads with the saved expectation. Stop closeout reporting on a
   mismatch or incomplete connection. Repeat a bounded read if project automation
   is still settling; correction writes need to fit the existing grant.

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
the normalized file. It checks persistence and identity, not whether the evidence
actually satisfies a criterion or whether the human granted closure.

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
