# Semantic production releases

This repository keeps two independent release records:

- `deploy-YYYYMMDDTHHMMSSZ-<short-sha>` releases are immutable production-deployment provenance. Every successful production merge continues to create one, and they are never retagged, deleted, or made Latest.
- `vMAJOR.MINOR.PATCH` releases are deliberately curated milestones. They point to an already-ready Netlify production commit and are marked Latest.

`main/package.json` is the authoritative semantic version. `main/package-lock.json` repeats the same value in its top-level `version` and root-package `packages[""]` fields. A release request must use the package version without a `v`; the published tag receives the `v` prefix.

## Version policy

Only core [SemVer 2.0](https://semver.org/) versions are accepted: `MAJOR.MINOR.PATCH`. Pre-release identifiers, build metadata, a leading `v`, and leading zeroes are rejected.

Before `1.0.0`:

- minor increments represent intentionally breaking or substantial curated milestones;
- patch increments represent compatible fixes; and
- `v0.1.0` is the selected baseline.

From `1.0.0` onward, major increments represent incompatible changes, minor increments represent backwards-compatible additive changes, and patch increments represent backwards-compatible fixes.

## Operator procedure

1. Land the implementation with a merge commit on `main`, then wait for its **Create deployment release** workflow and Netlify production deploy to succeed.
2. Confirm Netlify's current ready production deploy has the exact merge SHA as `commit_ref`, and confirm a non-draft `deploy-*` GitHub release targets that same SHA. Stop if production has advanced.
3. Ensure `main/package.json` and both version fields in `main/package-lock.json` agree. Run `npm run test:release` and the normal release checks.
4. In Actions, run **Publish semantic production release** from `main`. Provide the core version (for example `0.1.0`) and the exact 40-character merge SHA.
5. The workflow verifies ancestry on `main`, version consistency, Netlify readiness, matching deployment provenance, existing semantic releases/tags, and monotonic version ordering before creating a release.
6. Read back the Actions run, tag target, non-draft release, Latest status, release notes, deployment release, and Netlify deploy metadata. Record those exact links and identifiers on the tracking issue.

The workflow is idempotent only when the requested semantic tag and published non-draft release already point to the supplied commit. Tag-only, draft, duplicate, non-increasing, or different-target collisions fail for manual investigation.
