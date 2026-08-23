# Main Branch Governance

This document defines the proposed protection contract for the default branch.
It does not claim that GitHub settings have been applied. Creating or changing
the ruleset, exercising a canary pull request, merging, deploying, releasing,
and closing Issue #164 each require their own direct authorization.

## Dated Baseline

On 2026-08-23, authenticated read-only API requests returned no repository
rulesets and reported that `main` had no branch-protection rule. Issue #164
tracks applying and proving the design below. Because provider state can drift,
operators must refresh this evidence before any settings change or closure.

## Proposed Active Ruleset

Create one repository branch ruleset named `Protect main quality gates` with
`enforcement: active`, targeting only the default branch (`~DEFAULT_BRANCH`).
Configure these rules:

- Require changes through a pull request, with zero required approving reviews.
- Require all review conversations to be resolved before merge.
- Require branches to be up to date before merging.
- Require these four GitHub Actions status checks by exact job name:

  1. `Verify app` from `.github/workflows/dev-ci.yml`
  2. `Pre-merge browser smoke` from `.github/workflows/dev-ci.yml`
  3. `Validate portfolio surfaces` from
     `.github/workflows/portfolio-integrity.yml`
  4. `Audit npm dependencies` from `.github/workflows/npm-audit.yml`

- Require native code-scanning results from `CodeQL` with security alerts set
  to `high_or_higher` and non-security alerts set to `errors`.
- Block branch deletion and block force pushes.

Do not add a required Netlify Deploy Preview, Netlify deployment, production
browser, or other third-party status check. The production browser smoke in
`.github/workflows/release-on-deploy.yml` remains an additional advisory lane
after the production deployment and release are created.

GitHub rulesets identify ordinary workflow checks by job name, not by workflow
name. The workflow paths above disambiguate ownership for operators and
reviewers; the backticked job names are the exact required-check contexts.

## Emergency Bypass Policy

Grant bypass only to the repository-admin role, with bypass mode set to
`pull_request`. This keeps an auditable pull-request trail while permitting the
solo owner to handle a genuine repository emergency. Do not grant an
always-allow bypass, direct-push bypass, GitHub App bypass, Dependabot bypass,
or other bot/integration bypass.

Use the emergency bypass only when waiting for the normal gate would materially
worsen an active incident or prevent repair of the gate itself. Record the
reason in the pull request. Routine maintenance, dependency updates, and CI
flake are not bypass reasons.

## No-Deadlock Design

Every proposed required workflow reports on every pull request to `main`:

- `dev-ci.yml` has no path filter and its two candidate required jobs use only
  repository contents and the local Vite preview.
- `portfolio-integrity.yml` has no path filter.
- `npm-audit.yml` has no pull-request path filter.
- `codeql.yml` has no pull-request path filter.

The pre-merge browser job and npm audit job use read-only repository access,
do not require secrets, and do not depend on Netlify. These properties let them
run for documentation-only and Dependabot pull requests without a privileged
bot bypass. `release-on-deploy.yml` runs only after a push to `main`, so it must
not be configured as a pre-merge requirement.

## Bootstrap And Proof Sequence

Perform these phases in order, stopping for the named human gate between them:

1. Merge the reviewed repository PR only after a separate `MERGE_PR` grant that
   names its exact reviewed SHA and acknowledges the automatic Netlify deploy,
   verification, deploy tag, GitHub Release, and advisory production-browser
   consequences.
2. Confirm a representative pull request has reported all four exact job names
   and CodeQL has produced results. Do not configure a context that has not
   appeared in GitHub's authenticated check-run readback.
3. With a separate settings-mutation grant, create the ruleset exactly as
   proposed. Immediately read back the ruleset by authenticated API and verify
   its target, active enforcement, bypass actors/modes, pull-request settings,
   strict required checks, CodeQL thresholds, deletion rule, and force-push
   rule. Also inspect all rules applying to `main` for unexpected layering.
4. With separate authorization, open a non-production canary pull request.
   Introduce an intentionally failing browser assertion, prove that
   `Pre-merge browser smoke` fails and merge is blocked, then restore the
   assertion, prove all requirements pass, and leave the canary unmerged unless
   merge is separately authorized. The canary must use localhost, intercept
   GA4/GTM and Formspree, submit no form, and create no production traffic.
5. Exercise a documentation-only change and a representative Dependabot pull
   request, or use equivalent authenticated check-run evidence, to confirm all
   required contexts report instead of remaining pending.
6. Record dated authenticated settings, check-run, canary, and release evidence
   in Issue #164. Closing the issue or changing its project state requires a
   separate `CLOSE_WORK_ITEM` grant after every acceptance criterion is proven.

If any exact context is absent, CodeQL is not configured for the target, an
unexpected rule layers onto `main`, or the canary cannot prove both blocked and
restored states, stop and repair the repository workflow or revise the proposed
settings through a new reviewed change before activating or retaining the gate.

## Evidence Checklist

Retain the following immutable or dated evidence:

- the reviewed PR URL, base-tip SHA, merge-base SHA, and exact head SHA;
- successful check-run IDs and conclusions for the four named jobs and CodeQL;
- the authenticated ruleset JSON and the effective rules applying to `main`;
- canary PR URL and failing/restored head SHAs with mergeability readback;
- documentation-only and Dependabot reporting evidence;
- the separately authorized merge/release workflow and exact deployed commit,
  if a merge occurs; and
- residual gaps and the explicit closure authorization, if Issue #164 closes.

Local lint, unit, build, audit, and Playwright results prove repository behavior
only. They do not prove GitHub ruleset enforcement, hosted-runner behavior,
Netlify deployment, production behavior, or acceptance-criteria closure.

## GitHub References

- [Available rules for rulesets](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-rulesets/available-rules-for-rulesets)
- [Rulesets REST API](https://docs.github.com/en/rest/repos/rules)
- [Code scanning merge protection](https://docs.github.com/en/code-security/how-tos/find-and-fix-code-vulnerabilities/manage-your-configuration/set-merge-protection)
