# Semantic Version Assessment

Read this reference during planning when a change could affect a release, and again immediately before creating a review-gated PR.

Use exactly one decision: `none`, `patch`, `minor`, `major`, or `release-carrier`.

- `none`: no deployable portfolio contract change that merits a semantic release.
- `patch`: compatible corrective change.
- `minor`: compatible additive product change.
- `major`: incompatible product contract change from `1.0.0` onward; before `1.0.0`, follow the repository policy that treats intentionally breaking or substantial milestones as `minor`.
- `release-carrier`: a dedicated version-only PR following a verified deployment; it never schedules another carrier.

Use [docs/release-versioning.md](../../../../docs/release-versioning.md) as the repository source of truth. Planning is provisional. At PR creation, inspect the exact base-to-head diff and refresh current authoritative `main/package.json` and published semantic-release state. Record current version, decision, proposed version when applicable, rationale/evidence, basis, base/head SHA, UTC time, and deferred status in the PR and handoff contract.

The primary implementation PR must not change `main/package.json` or `main/package-lock.json` simply to carry its own proposed bump. If it needs a bump, wait for its exact merge and production deployment to be verified. A new direct `IMPLEMENT_TO_PR` grant is required for a dedicated version-only `release-carrier` PR. It remains independently reviewable and needs later exact merge authorization, post-merge verification, and a separate `RELEASE_OR_DEPLOY` grant before publishing. Neither an assessment nor a prior grant transfers any future authority.
