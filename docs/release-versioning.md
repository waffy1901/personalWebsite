# Semantic production releases

This repository keeps two independent release records:

- `deploy-YYYYMMDDTHHMMSSZ-<short-sha>` releases are immutable production-deployment provenance. A successful `main` commit creates one only when Netlify's site-level `published_deploy` identifies the selected ready production deployment for that exact commit. These releases record the deployment ID and immutable Netlify URL and are never retagged, deleted, or made Latest.
- `vMAJOR.MINOR.PATCH` releases are deliberately curated milestones. They point to an already-ready Netlify production commit and are marked Latest.

The deployment-release workflow exits successfully without creating a GitHub release when Netlify marks the exact commit's production deploy with `skipped: true` or returns the exact no-content cancellation signal. This covers non-deployable commits without weakening the exact-commit gate: other terminal deploy failures, malformed responses, and polling timeouts still fail closed.

The automatic deployment-release resolver validates each candidate's site ID, deployment ID, full lowercase 40-character commit SHA, production context, state, and skipped status. It searches the latest 100 production attempts for the exact target commit, selects the first matching attempt, and retains that deployment ID through subsequent polls of `GET /api/v1/deploys/{deploy_id}`. A newer unrelated or skipped attempt cannot replace it. If the target is outside this window, the resolver times out without a release.

Attempt readiness alone is insufficient. For a ready target, the resolver reads `GET /api/v1/sites/{site_id}` and requires the expected site identity plus a ready, production, non-skipped `published_deploy` with the same deployment ID and exact target SHA. A well-formed different published deployment can wait within the existing 45-poll budget, with 20 seconds between polls. Missing or malformed identity, wrong-site responses, and API errors fail closed. API reads have a five-second connection timeout and a 15-second total timeout; the resolver job is capped at 40 minutes including API time and checkout.

The resolver constructs `https://<deploy-id>--<site-name>.netlify.app` from validated deployment and site-name metadata. It does not use provider alias URL fields, which can identify a mutable branch. The existing route, header, and nine public-artifact HTTP contracts run against this immutable URL as well as the production domain, and the legacy-domain redirect check remains required. Public-artifact equality is content evidence for those files only: different frontend JS/CSS can still share all nine files, so it never substitutes for the published-pointer identity gate.

Immediately before `Create GitHub release`, the workflow reads the site pointer again and requires the same site, deployment ID, ready production state, non-skipped status, exact SHA, and constructed immutable URL. A rollback, advance, same-SHA replacement deployment, or changed site name blocks release creation without another polling wait. This final check reduces the race window; the Netlify read and GitHub release write are not atomic, and publication can change between them. The recorded immutable URL and ID preserve the identity that was verified, not a guarantee that it remains the current production deployment.

The semantic-release workflow resolves production from `GET /api/v1/sites/{site_id}` and its `published_deploy` object. It does not select the newest deploy attempt, so a newer pending, failed, skipped, or unpublished ready deploy cannot displace the deployment currently serving production. Before publication, the workflow requires that pointer to be ready, match the requested lowercase 40-character commit SHA, and expose a safe nonempty deploy ID and HTTPS URL. Missing or malformed site and deployment metadata fails closed.

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
2. Confirm Netlify's site-level `published_deploy` is ready and has the exact primary merge SHA as `commit_ref`, and confirm a non-draft `deploy-*` GitHub release targets that same SHA. Stop if production has advanced.
3. For an assessment of `patch`, `minor`, or `major`, obtain a new direct `IMPLEMENT_TO_PR` grant and create a dedicated version-only `release-carrier` PR. Independently review it and merge only with later exact merge authorization. Do not treat the primary PR, its merge, or its deployment as authority for this carrier.
4. Wait for the carrier merge's deployment release and Netlify production deploy. Confirm the site-level `published_deploy` and non-draft `deploy-*` release both target that exact carrier merge SHA; stop if production has advanced.
5. Ensure `main/package.json` and both version fields in `main/package-lock.json` agree at the carrier SHA. Run `npm run test:release` and the normal release checks.
6. With a separate `RELEASE_OR_DEPLOY` grant, run **Publish semantic production release** from `main`. Provide the core version (for example `0.1.0`) and the exact 40-character carrier merge SHA. The workflow verifies ancestry on `main`, version consistency, Netlify readiness, matching deployment provenance, existing semantic releases/tags, and monotonic version ordering before creating a release.
7. Read back the Actions run, tag target, non-draft release, Latest status, release notes, deployment release, and Netlify deploy metadata. Record those exact links and identifiers on the tracking issue.

The workflow is idempotent only when the requested semantic tag and published non-draft release already point to the supplied commit. Tag-only, draft, duplicate, non-increasing, or different-target collisions fail for manual investigation.

## Local verification

Run the deterministic workflow fixtures and existing release checks from the repository root:

```bash
rtk proxy python3 scripts/test_semantic_release_workflow.py
rtk proxy python3 scripts/test_netlify_deploy_state.py
rtk proxy python3 scripts/test_netlify_published_deploy.py
rtk proxy python3 scripts/test_release_on_deploy_workflow.py
rtk npm run test:release
```

The semantic-release fixture suite executes the workflow's embedded Netlify lookup with synthetic responses and the deployment-provenance JavaScript with synthetic GitHub release data. It makes no provider requests and performs no release or deployment writes.

The automatic-release fixtures run in the automatic workflow's verification job and the PR workflow-lint job. They execute the actual resolver and final-guard shell with fake curl and sleep, enforce bounded API options and retained identity, and execute the release JavaScript with a fake GitHub client. The artifact counterexample passes all nine public-artifact comparisons with deliberately different frontend JS/CSS while both identity gates reject the other deployment. These are offline source and synthetic regression checks; they do not prove provider state, a live deployment, or a published release. Real deployment evidence and issue closure remain separate authorized work.
