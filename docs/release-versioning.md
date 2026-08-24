# Semantic production releases

This repository keeps two independent release records:

- `deploy-YYYYMMDDTHHMMSSZ-<short-sha>` releases are immutable production-deployment provenance. A successful `main` commit creates one only when Netlify reports a ready production deploy for that exact commit, and they are never retagged, deleted, or made Latest.
- `vMAJOR.MINOR.PATCH` releases are deliberately curated milestones. They point to an already-ready Netlify production commit and are marked Latest.

The deployment-release workflow exits successfully without creating a GitHub release when Netlify marks the exact commit's production deploy with `skipped: true` or returns the exact no-content cancellation signal. This covers non-deployable commits without weakening the exact-commit gate: other terminal deploy failures, malformed responses, and polling timeouts still fail closed.

`main/package.json` is the authoritative semantic version. `main/package-lock.json` repeats the same value in its top-level `version` and root-package `packages[""]` fields. A release request must use the package version without a `v`; the published tag receives the `v` prefix.

## Version policy

Only core [SemVer 2.0](https://semver.org/) versions are accepted: `MAJOR.MINOR.PATCH`. Pre-release identifiers, build metadata, a leading `v`, and leading zeroes are rejected.

Before `1.0.0`:

- minor increments represent intentionally breaking or substantial curated milestones;
- patch increments represent compatible fixes; and
- `v0.1.0` is the selected baseline.

From `1.0.0` onward, major increments represent incompatible changes, minor increments represent backwards-compatible additive changes, and patch increments represent backwards-compatible fixes.

## Assessment lifecycle

Before implementation, the review-gated workflow records a provisional assessment using exactly one decision: `none`, `patch`, `minor`, `major`, or `release-carrier`. At PR creation, it refreshes that assessment from the final exact base-to-head diff and current authoritative and published versions. The record names the current version, decision, proposed version when applicable, rationale/evidence, base and head SHA, assessment time, and deferred status.

The primary implementation PR never changes `main/package.json` or `main/package-lock.json` merely to carry its own proposed bump. When a primary change needs a bump, first merge and verify the exact production deployment. Only then can a later direct `IMPLEMENT_TO_PR` grant authorize a dedicated version-only PR. That later PR is classified `release-carrier`; it does not recursively schedule another version bump. It still requires independent review, exact merge authorization, and post-merge verification. Publishing its semantic release remains a separate, later `RELEASE_OR_DEPLOY` authorization.

## Operator procedure

1. Land the primary implementation with a merge commit on `main`, then wait for its **Create deployment release** workflow and Netlify production deploy to succeed.
2. Confirm Netlify's current ready production deploy has the exact primary merge SHA as `commit_ref`, and confirm a non-draft `deploy-*` GitHub release targets that same SHA. Stop if production has advanced.
3. For an assessment of `patch`, `minor`, or `major`, obtain a new direct `IMPLEMENT_TO_PR` grant and create a dedicated version-only `release-carrier` PR. Independently review it and merge only with later exact merge authorization. Do not treat the primary PR, its merge, or its deployment as authority for this carrier.
4. Wait for the carrier merge's deployment release and Netlify production deploy. Confirm the current ready production deploy and non-draft `deploy-*` release both target that exact carrier merge SHA; stop if production has advanced.
5. Ensure `main/package.json` and both version fields in `main/package-lock.json` agree at the carrier SHA. Run `npm run test:release` and the normal release checks.
6. With a separate `RELEASE_OR_DEPLOY` grant, run **Publish semantic production release** from `main`. Provide the core version (for example `0.1.0`) and the exact 40-character carrier merge SHA. The workflow verifies ancestry on `main`, version consistency, Netlify readiness, matching deployment provenance, existing semantic releases/tags, and monotonic version ordering before creating a release.
7. Read back the Actions run, tag target, non-draft release, Latest status, release notes, deployment release, and Netlify deploy metadata. Record those exact links and identifiers on the tracking issue.

The workflow is idempotent only when the requested semantic tag and published non-draft release already point to the supplied commit. Tag-only, draft, duplicate, non-increasing, or different-target collisions fail for manual investigation.
