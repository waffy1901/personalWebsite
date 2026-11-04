# Issue 271 local case-study review

Recorded November 3, 2026 (America/New_York; checks continued November 4 UTC).
Scope: local implementation of [issue 271](https://github.com/waffy1901/personalWebsite/issues/271), including its October 31 four-case expansion.
Source HEAD: `dbf6b72a122b51588d09515e3fd379220682e02a`.
Branch: `feat/issue-271-swe-ii-case-studies`.

## Selection and evidence

The topic selection was recorded before drafting in the coordinator's local
plan v1 (`/private/tmp/personalWebsite-issue-271-plan-v1.md`). The four stories
cover complementary engineering decisions: moving internal reconciliation into
an operational workload, recovering security-blocked delivery, grounding AI
triage in inspectable evidence, and changing CI credential lifecycles. All three
earlier stories remain available. Internal order reconciliation remains distinct
from the CDC project; operational AI triage remains distinct from the Jira-to-GKE
hackathon prototype.

Sources are the issue and owner clarification in the active conversation,
cross-checked against canonical `experience.js`, `currentRoleEvidence.js`, and
`currentRoleHighlights.js`. Repository consistency checks do not independently
verify employer outcomes. No private logs, screenshots, identities, credentials,
or configurations were imported.

The owner supplied these clarifications verbatim:

- Build-gate scope: "100% over ~15 services".
- OIDC findings: "Tokens being printed in plain text in the CI logs across ~20 repos".
- AI ownership: "I did a little more than half the implementation myself, 3 other engineers contributed. I did KT and handoff to the RE Run and PTM teams, the PTM team now owns the tool and is actively using it".

Before final acceptance the owner also clarified the historical choices:

- Security/CI: "the alternative was to get exception(s), but I wanted a true fix".
- AI: "the ask was to extend an existing skill/router".
- OIDC: "service account/password with custom masking, but I felt OIDC was the much better approach (was the first one to adopt this approach and set this as the standard for my org\u2014in fact, I reviewed a SR Principal's PR for migrating to OIDC auth, explained that I had already implemented this and described it as the correct approach before approving)".

The security story describes an available exception route, without asserting an
exception request or approval. The AI story explicitly describes extension work,
not ground-up creation, and removes a hypothetical historical comparison. The
OIDC standard is scoped to the owner's engineering organization, with adoption
still bounded to two teams and approximately 20 repositories; the later review
does not imply authorship of that engineer's migration or a company-wide Home
Depot standard. The senior engineer's title is unnecessary in public narrative.

Public copy uses generic receiving-team language for the handoff. Its supported
AI outcome is cited evidence for human investigation and active operational use;
automatic remediation behavior is not established by the source packet.

| Story | Central decision and outcome | Remaining evidence limits |
| --- | --- | --- |
| Internal reconciliation | GKE workload identity and managed secrets; in-container PGAdapter under a blocked sidecar constraint; staged writes and report/queue aftercare; approximately 2,200 backlog items reprocessed by normal processing | Seven weekly runs and approximately 120 hours/year are owner-reported cadence and an estimate. Per-run timing and annualization are unvalidated. No claim of idempotence, universal run success, or automatic rollback. |
| Booking security and delivery | Underlying remediation chosen over an exception route; framework/container/build modernization, 10 services directly remediated plus five assisted, restored release paths, 66 unique critical/high CVE IDs removed from release builds | Final owner-reported 100% across approximately 15 services, earlier 33%; exact windows and build-attempt denominator unavailable. Running-production image cleanup is not established. Code/SAST findings and PR scanning remain separate evidence. |
| AI-assisted payment triage | Extension of an existing skill/router using code/config tracing, telemetry, baselines, citations, coverage and false-finding checks; four people total, majority personal implementation, validation and active receiving-team ownership | No reliable accuracy percentage, benchmark, causal productivity result, or claim of a seven-application autonomous deployment. Future evaluation suggestions are marked as recommendations. |
| JFrog OIDC | Short-lived job-scoped Maven/Docker authentication chosen over service-account/password plus custom masking; organizational standard reinforced in later PR review; two teams and approximately 20 repositories; reported 1,100+ findings tied to plaintext token output | Findings are not distinct secrets. Scan tool, observation window and deduplication are unspecified. Private trust configuration and historical recovery procedure are not supplied; standard adoption is not company-wide. |

Each story has an ordered text diagram with a topic-specific accessible name and
an explicitly illustrative artifact. The examples are conceptual review aids,
not historical output, real incident data, executable configuration, internal
schemas, or employer runbooks. Design rationale and suggested future evidence
are distinguished from historical actions. The four case-study narratives,
metric details, artifacts, and qualifications are mirrored through the existing
public-artifact generator.

The same claim qualifications are aligned in Experience and current-role
summaries. Resume source, PDF and previews are deliberately unchanged under the
authorized scope; older resume wording remains a separate owner-controlled
surface requiring review before any future synchronization.

## Delivery and performance

Amendment 1 to plan v1 accepts a bounded data split. The browser index receives
the three legacy records and lightweight recent summaries; Home and Experience
use only small SEO link records. The four new full narratives load when a new
detail route renders, under the existing route Suspense and error boundary.
`caseStudies.js` composes full records for generation and tests. No dependencies,
third-party services, analytics events, broad routing changes, or version bumps
were introduced.

The new `src/data/recentCaseStudies.js` byte budget counts its complete static
closure after startup subtraction, including the shared case-study index.
Existing startup and route limits remain unchanged. See
[bundle budget evidence](bundle-budgets.md#issue-271-narrative-entry).

## Local verification

Checks use Node 22.22.3 from
`/private/tmp/node-v22.22.3-darwin-arm64/bin` and root package scripts. The
validation-environment diagnostic rejects the valid linked local `minimatch`
lock entry because it has no inline version. The coordinator manually verified
all 24 installed direct versions against the lock, including linked
`minimatch@1.0.0`; no dependency repair was required. This is existing-install
validation, not a clean-install claim.

- `npm run generate:public -- --check`: passed.
- `check_change_impact.mjs --source worktree --check`: all eight selected checks passed (generated freshness, content, resume assets, SEO, AI discovery, CSP JSON-LD hash, GA4 contract, frontend performance policy).
- Focused `npm run test -- --run src/App.test.jsx`: 78 app tests passed before the final transition assertion; operations' 45 JavaScript and 10 Python tests also passed.
- `npm run lint`: passed.
- `npm run test`: passed; 181 Vitest tests across eight files, plus 45 operations JavaScript and 10 Python tests. The app checks include all seven index entries, four complete new routes, topic diagram reading order, artifact/qualification mirrors, owner-confirmed alternatives and extension/standard context, Home/Experience links, new-to-new-to-legacy navigation, unknown case-study slug metadata and uppercase redirects.
- `VITE_GA_MEASUREMENT_ID= VITE_FORMSPREE_KEY=synthetic-premerge-test-key npm run build`: passed; 13 route metadata shells generated.
- `npm run check:bundle-budgets`: passed; the new deferred closure measures 35152 raw / 12395 gzip against 38500 / 13000. All existing limits pass unchanged; detailed measurements are in the linked budget note.
- `git diff --check`: passed.
- Root lint, full test, build, byte budgets and the eight-validator suite passed again after the owner-confirmed decision updates and regenerated artifacts.
- Independent technical-reader assessment (Astra/high): no code defects reported; three older narratives preserved and all four central decisions clear. After the owner clarifications, delta acceptance found no actionable defect: security/OIDC alternatives are resolved, and AI is explicitly scoped as extension of an existing skill/router without claiming historical evaluation of competing architectures. Existing evidence qualifications and recovery limits remain intact. The delta reader checked narrative content, not regenerated artifacts, tests, or browser behavior; those checks are recorded separately here.
- Coordinator browser QA: Chromium 156.0.8078.80 on the built localhost preview, with GA/GTM/Formspree blocked before navigation and no form submission. All four new stories passed at 1440x1000, 390x844, and 390x844 with a 32px root font (200% text approximation): no horizontal overflow or visible text clipping across the 12 cases; ordered diagrams and readable conceptual artifacts verified. Home/Experience navigation and the seven-story index also passed mobile normal/enlarged-text geometry. Tab/Enter opened each new story from Home and Experience (eight transitions).
- Browser route checks: all three older stories render their expected headings; `/CaseStudies`, `/Case-Studies`, and `/Experience` redirect to canonical lowercase routes; unknown detail shows non-indexable Page not found. All eight distinct related/return/context destinations resolve, including the two Experience fragments and the separate Jira project fragment. No ordinary page errors were observed.
- Browser loading/recovery checks: a delayed cold narrative request showed the existing Loading page fallback; a slow index-to-new-story transition retained the index with its pending indicator before resolving; a one-time aborted OIDC narrative request focused the existing alert, kept a canonical retry URL, and restored the story after retry.
- Automated accessibility: refreshed final-build axe checks passed all eight desktop/mobile Chromium cases in 8.6 seconds, with no critical/serious violations. Safari and manual assistive-technology testing were not performed.

The coordinator used the installed Playwright binary against the existing build
(avoiding a second build through the e2e prehook):

```bash
rtk proxy env PATH=/private/tmp/node-v22.22.3-darwin-arm64/bin:$PATH PLAYWRIGHT_LOCAL_PREVIEW=1 main/node_modules/.bin/playwright test accessibility.spec.js --config=main/playwright.production.config.js --grep 'production-order-reconciliation|booking-security-cicd-recovery|ai-assisted-payment-triage|jfrog-oidc-adoption'
```

The coordinator stopped its preview server; the config-owned test preview exited.

No production browser traffic, real form submissions, hosted CI, deployment,
publication, or issue/project changes are part of this local implementation.
Independent technical-reader feedback and telemetry-blocked browser QA were
coordinated separately; the recorded results apply to this local change. Final
prose and employer disclosure remain subject to owner review
before any later publication grant.

## Owner follow-up: Experience copy

The owner requested removal of the PR-review-volume note from Experience. The
canonical evidence note, its visible paragraph, its AI-summary generator line,
and the two corresponding test assertions were removed; `portfolio.json` and
`ai-summary.txt` were regenerated. The underlying activity and ownership facts
are unchanged.

After this edit, root lint, 83 app tests (plus the root script's 45 operations
JavaScript and 10 Python tests), all eight consistency validators, the production
build and bundle budgets passed. Experience now measures 33735 raw / 11975 gzip
bytes, with 265 raw bytes of headroom. Earlier browser and independent-reader
evidence above applies to the four-story implementation before this small copy
removal; browser and reader checks were not repeated for the deletion.

## Provisional version assessment and authority

Current source package version: 0.3.0. Decision: `minor`; proposed 0.4.0 for a
compatible additive four-story milestone, based on plan v1 and the source HEAD
above. Published release state was not refreshed for local drafting. Refresh the
assessment against exact base/head and authoritative published state if a future
PR is requested. The bump is deferred; package manifests and lockfile are
unchanged.

The direct work request authorizes `IMPLEMENT_LOCAL`. This note is an evidence
and owner-review record, not an issue closeout or a formal PR verdict. Commits,
push, PR creation, merge, deploy, release, and issue/project mutation require
their own direct grants.
