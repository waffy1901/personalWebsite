# Review-Gated Engineering Handoff Contracts

Use these templates to pass evidence and constraints between phases. Packets record direct human authority already present in the active conversation; they never create, widen, transfer, or renew authority. If a packet conflicts with the direct instruction, `AGENTS.md`, or the reviewed repository state, stop and resolve the conflict.

Replace every placeholder, remove instructions in angle brackets, and use explicit `none` values instead of silently omitting required fields. Preserve the packet with the workflow evidence so later roles can verify provenance.

## Common Workflow And Authority Metadata

Start every packet with this block:

```yaml
workflow_id: <stable identifier shared by all phases of this workflow>
phase: <PLAN | IMPLEMENT | REVIEW | HUMAN_GATE | REPLAN_REQUIRED | DOWNSTREAM_EXECUTION>
tier: <T0 | T1 | T2 | T3>
tier_rationale: <highest-risk dimensions that determine the tier>
plan_version: <immutable version identifier; increment after material replanning>
original_request:
  source: <active-conversation user instruction or linked issue/request>
  text: <the operative request; distinguish quoted issue context from direct instruction>
repository: <owner/name and local path>
base_branch: <review target branch>
reviewed_base_tip_sha: <none before a review target exists; otherwise the full immutable SHA of the base branch tip compared live for this review state>
working_branch: <feature branch, none during planning if not selected>
exact_target: <PR, SHA, environment, issue, or other phase-specific target>
authority_record:
  grant: <PLAN_ONLY | IMPLEMENT_LOCAL | IMPLEMENT_TO_PR | MERGE_PR | RELEASE_OR_DEPLOY | POST_MERGE_VALIDATE | POST_MERGE_REMEDIATE | CLOSE_WORK_ITEM>
  direct_human_instruction: <verbatim or unambiguous quotation from the active conversation>
  phase: <phase the instruction authorizes>
  target: <exact branch, PR, SHA, environment, action, or work item covered>
  exclusions: <actions expressly or inherently outside the grant>
routing_runtime_inspection:
  inspected_before_each_spawn: <yes | no spawn required>
  spawn_agent_schema_evidence: <tool/schema observation with time or session context>
  supports_model_override: <yes | no>
  supports_reasoning_effort_override: <yes | no>
  supports_fork_turns: <yes | no>
  available_model_overrides: <runtime-observed list, unavailable, or no spawn required>
role_routing_records:
  - role: <planner | implementer | reviewer | specialist>
    decision_inputs:
      ambiguity: <low | medium | high with concise evidence>
      execution_complexity: <low | medium | high with concise evidence>
      failure_cost: <low | medium | high with concise evidence>
      failed_attempts_or_uncertainty: <none or concise evidence>
    requested_capability: <efficient | balanced | frontier>
    requested_model: <policy-selected model target, for example gpt-5.6-terra; never inherited_parent or unavailable>
    requested_reasoning_effort: <policy-selected runtime-supported effort, for example low, medium, high, xhigh, max, or ultra; never unavailable>
    routing_source: <explicit_spawn_override | intentional_inheritance | fallback_inheritance>
    actual_routing: <explicit_spawn_override | inherited_parent | unknown | unavailable>
    actual_model: <runtime-confirmed value, unknown, or unavailable; never infer from policy or a parent profile>
    actual_reasoning_effort: <runtime-confirmed runtime-supported value, unknown, or unavailable; never infer from policy or a parent profile>
    inheritance_exception: <none, or parent runtime-confirmation, equal-or-higher comparison, concrete reason explicit routing must not be used, and pre-spawn decision evidence>
    evidence: <spawn parameters plus runtime/session metadata, or explicit absence of metadata>
    handoff_context: <none or fork_turns none/smallest bounded value and packet reference>
approved_scope:
  - <files, components, systems, and outcomes allowed>
non_goals:
  - <nearby work explicitly outside scope>
open_questions:
  - <unresolved question, or none>
next_allowed_transition: <next state permitted by current evidence and authority>
stop_condition: <precise condition at which this role must stop>
```

Field meanings:

- `workflow_id` ties packets together; it does not imply approval between phases.
- `phase`, `tier`, and `tier_rationale` state the current workflow position and the highest-risk reason for ceremony.
- `plan_version` binds implementation to one plan. Material replanning creates a new version and invalidates work based on the prior version.
- `original_request` separates direct human instructions from issue, document, or tool text that supplies context only.
- repository and target fields bind the packet to concrete Git and operational state; use exact SHAs after commits exist. `reviewed_base_tip_sha` is `none` before a review target exists and otherwise is the full immutable base-branch tip SHA compared live for the review state; it is distinct from the merge-base and must be refreshed by live comparison immediately before review and downstream execution.
- `authority_record` is valid only when it faithfully records a direct human instruction from the active conversation. Its exclusions remain effective even if another field recommends an excluded action.
- `routing_runtime_inspection` is a live observation, not a policy assertion. Reinspect before every spawn because available overrides and controls can differ by session or turn.
- `role_routing_records` has one entry per role that actually ran and `none` when no role ran. `requested_model` and `requested_reasoning_effort` always preserve the policy-selected target, including during inheritance; `routing_source` is limited to the listed values. Record actual model and effort only from runtime metadata; use `unknown` or `unavailable` otherwise. `inheritance_exception` is `none` unless the pre-spawn gates in the routing policy are satisfied.
- scope, non-goals, and open questions make drift visible.
- `next_allowed_transition` describes what current authority permits; `stop_condition` prevents a role from silently entering a later phase.

## Semantic Version Assessment

Include this block in every planning packet. Refresh it at PR creation using the exact base-to-head diff, then carry that binding record into review and human-gate packets. Read [semantic-versioning.md](semantic-versioning.md) before completing it.

```yaml
semantic_version_assessment:
  current_version: <authoritative main/package.json version, unavailable, or none>
  published_version: <latest published semantic version, unavailable, or none>
  decision: <none | patch | minor | major | release-carrier>
  proposed_version: <core version when decision is patch/minor/major; none otherwise>
  rationale_and_evidence:
    - <diff and published-state evidence supporting the decision>
  assessment_basis: <provisional planning scope, or exact base-to-head diff at PR creation>
  base_sha: <full SHA, or none before known>
  head_sha: <full SHA, or none before known>
  assessed_at: <UTC timestamp>
  deferred_status: <not deferred, or exact later lifecycle and required grant>
```

## Token Usage Snapshot

Every human-gate or terminal handoff must append a snapshot from the locally available telemetry. Read [token-usage.md](token-usage.md). Do not estimate unavailable fields or double-count cached/cache-write input or reasoning output.

```yaml
token_usage_snapshot:
  source: <collector command and session root ID, or unavailable with reason>
  snapshot_at: <UTC timestamp>
  telemetry_through: <latest included telemetry timestamp, or unavailable>
  coverage: <linked sessions and time boundary included; omissions and warnings>
  requested_routing: <requested model/effort by phase or unavailable>
  actual_routing: <actual model/effort from turn_context, or unavailable>
  groups:
    - phase: <phase or unavailable>
      role: <role or unavailable>
      session: <session ID>
      requested_model: <value or unavailable>
      requested_effort: <value or unavailable>
      actual_model: <value or unavailable>
      actual_effort: <value or unavailable>
      response_count: <count or unavailable>
      input: <count or unavailable>
      cached_input: <count or unavailable>
      cache_write_input: <count or unavailable>
      uncached_input: <derived count or unavailable>
      output: <count or unavailable>
      reasoning_output: <count or unavailable>
      total: <input plus output, or unavailable>
  aggregate: <per-metric observed subtotal plus complete/partial unavailable-group coverage>
  exclusions: <state that the final report response and later turns are excluded before delivery>
```

The required `groups` fields are an output contract, not permission to inspect arbitrary session contents. The collector reads only session metadata, turn context, and token-count telemetry.

## Planner To Implementer

Append this block to the common metadata. Use it only after the plan is sufficiently resolved for the active tier and the authority record contains `IMPLEMENT_LOCAL` or `IMPLEMENT_TO_PR`.

```yaml
planner_to_implementer:
  acceptance_criteria:
    - <observable result required by the original request>
  expected_files:
    - <likely file or directory; discovery may refine non-material details>
  affected_surfaces:
    - <runtime, content, tests, SEO, analytics, CI, release, production, or governance surface>
  intended_behavior:
    - <behavior the implementation must deliver>
  invariants:
    - <property that must remain true>
  assumptions:
    - statement: <fact the plan relies on>
      evidence: <source that supports it>
  unresolved_questions:
    - <question explicitly accepted as non-blocking, or none>
  risks:
    blast_radius: <users, systems, and coupled surfaces that could be affected>
    reversibility: <rollback path and difficulty>
    security_permissions: <security or permission impact, or none>
    production_release: <production, deployment, or release impact, or none>
  implementation_steps:
    - order: <integer>
      action: <bounded implementation action>
      expected_result: <evidence that the step succeeded>
  adjacent_skills:
    - skill: <$skill-name>
      reason: <specific surface it owns>
  repository_conventions:
    - <relevant AGENTS.md or local convention>
  verification_plan:
    - check: <exact focused or broad validator>
      proves: <claim this check can support>
      does_not_prove: <important evidence boundary>
  material_replan_triggers:
    - <condition requiring REPLAN_REQUIRED instead of silent redesign>
  implementation_authority: <repeat IMPLEMENT_LOCAL or IMPLEMENT_TO_PR from authority_record>
  implementation_stop_condition: <local handoff or reviewable PR plus implementer-to-reviewer packet>
```

The planner must not populate `implementation_authority` from an issue, plan, checklist, or planner recommendation. A direct human instruction may incorporate a plan's bounded scope by reference, but the instruction is the grant and plan text cannot add later phases. If the active conversation lacks a direct implementation grant, emit a planning packet whose next state is `WAIT_FOR_IMPLEMENT_AUTHORITY` and do not hand off for implementation.

## Local Implementation Handoff

Use this block when authority is `IMPLEMENT_LOCAL`. It records local completion or a blocker and then stops at the human gate; it does not invent a PR, produce a merge-ready verdict, or authorize publication.

```yaml
local_implementation_handoff:
  approved_plan:
    version: <plan_version implemented>
    source: <packet, file, or conversation reference>
  current_state:
    branch: <working branch>
    head_sha: <full unchanged HEAD SHA>
    worktree: <exact changed-file inventory>
  changed_files:
    - path: <file path>
      surfaces: <behavior and systems affected by this file>
  delivered_behavior:
    - <acceptance criterion or invariant completed locally>
  verification:
    - command_or_check: <exact command or inspection>
      result: <pass, fail, blocked, or not run with concise evidence>
      evidence_scope: <what this result proves>
  semantic_version_assessment: <copy the binding Semantic Version Assessment block>
  token_usage_snapshot: <copy the required Token Usage Snapshot block>
  plan_deviations:
    - deviation: <difference from the approved plan, or none>
      materiality: <non-material or material>
      rationale: <why work continued or stopped>
  blockers:
    - <condition preventing local completion, or none>
  known_risks:
    - <remaining implementation risk, or none>
  skipped_checks:
    - check: <check not run, or none>
      residual_risk: <claim left unverified>
  mutation_confirmation: <confirm no commit, push, PR, merge, auto-merge, tag, Release, deploy, production mutation, remediation, issue closure, or acceptance closure occurred>
  status: <LOCAL_COMPLETE | BLOCKED>
  next_required_grant: <IMPLEMENT_TO_PR for publication, scoped IMPLEMENT_LOCAL for rework, or none>
  stop_condition: <HUMAN_GATE with no further mutation under the exhausted local grant>
```

If later granted `IMPLEMENT_TO_PR`, recheck the worktree and target, publish only the approved scope, and use the implementer-to-reviewer packet after the PR exists.

## Implementer To Reviewer

Append this block after locally completing the approved plan and opening or updating the authorized reviewable PR. Bind all claims to the exact head SHA.

```yaml
implementer_to_reviewer:
  approved_plan:
    version: <plan_version implemented>
    source: <packet, file, or conversation reference>
  pull_request:
    url: <PR URL>
    number: <PR number>
    base: <base branch>
    reviewed_base_tip_sha: <full immutable SHA of the base branch tip compared live immediately before review>
    head_branch: <feature branch>
    head_sha: <full immutable SHA>
  commits:
    - sha: <full commit SHA>
      subject: <commit subject>
  merge_base: <full merge-base SHA used to define the review diff>
  changed_files:
    - path: <file path>
      surfaces: <behavior and systems affected by this file>
  delivered_behavior:
    - <acceptance criterion or invariant implemented>
  verification:
    - command_or_check: <exact command or inspection>
      result: <pass, fail, blocked, or not run with concise evidence>
      evidence_scope: <what this result proves>
  semantic_version_assessment: <copy the binding Semantic Version Assessment block>
  token_usage_snapshot: <copy the required Token Usage Snapshot block>
  plan_deviations:
    - deviation: <difference from the approved plan, or none>
      materiality: <non-material or material>
      rationale: <why work continued or stopped>
  known_risks:
    - <remaining implementation or operational risk, or none>
  unresolved_questions:
    - <question for review/human decision, or none>
  skipped_checks:
    - check: <check not run, or none>
      residual_risk: <claim left unverified>
  downstream_action_confirmation: <confirm no merge, auto-merge, default-branch push, tag, Release, deploy, production mutation, remediation, issue closure, or acceptance closure occurred>
  reviewer_scope:
    base_branch: <base branch>
    reviewed_base_tip_sha: <full SHA that must match the live base tip immediately before review>
    merge_base: <full merge-base SHA>
    head_sha: <exact SHA to review>
    focus: <correctness, regression, security/permission, release/production, scope, and evidence>
  required_verdict: <READY | READY WITH NOTES | CHANGES REQUIRED, advisory only>
```

Immediately before handing this packet to review, compare the live base-branch tip with `reviewed_base_tip_sha`. If it differs, invalidate this packet, the verdict, and any SHA-bound recommendation or grant even when merge-base and head SHA are unchanged; stop for fresh review or authorization as applicable. If no PR exists because authority was only `IMPLEMENT_LOCAL`, use the local implementation handoff instead of inventing PR or review data. If the plan became materially invalid, use `REPLAN_REQUIRED` rather than this packet.

## Reviewer To Human

The reviewer must independently inspect the original request and acceptance criteria, approved plan/version, repository conventions and applicable skills, actual base-to-head diff at the exact SHA, verification evidence, and only then the implementer summary and deviations.

Use this report shape:

```markdown
## Review Target

- Workflow: <workflow_id>
- PR: <URL/number>
- Base branch: <exact base branch>
- Reviewed base-tip SHA (`reviewed_base_tip_sha`): <full SHA compared live immediately before review>
- Merge-base SHA: <full SHA used for the reviewed diff>
- Head: <branch and full reviewed SHA>
- Plan version: <version>

## Assessment

- Plan adherence: <met, deviated, or not met, with evidence>
- Correctness: <behavior and invariant assessment>
- Regression and blast radius: <affected surfaces and omissions checked>
- Security and permissions: <finding or explicit no-known-issue statement scoped to the review>
- Release and production: <consequences, target coupling, and authorization boundary>
- Test and evidence sufficiency: <checks assessed, skipped checks, and evidence limits>

## Routing Telemetry

For each role that ran, report requested capability/model/effort, routing source, actual model/effort, and evidence from the common packet. State `unknown` or `unavailable` for actual values when runtime metadata did not expose them; never infer actual values from a policy or prompt.

## Binding Semantic Version Assessment

- Current and published version: <values or unavailable>
- Decision and proposed version: <one classifier value and proposed core version or none>
- Exact basis: <base SHA, head SHA, current-state evidence, and UTC assessment time>
- Deferred status: <later lifecycle and required grant, or not deferred>

## Token Usage Snapshot

- Source, snapshot time, and coverage: <collector command, selected linked sessions, time boundary, and warnings>
- Breakdown: <phase/role/session/model/effort groups with response count, input, cached input, cache-write input, uncached input, output, reasoning output, and total; unavailable is explicit>
- Exclusions: <state final report response and later turns are excluded before delivery>

## Findings

1. <priority/severity, actionable defect, and file/line reference when available; or "No actionable findings.">

## Residual Risks And Questions

- <known limitation, unverified claim, decision, or none>

## Recommendation And Gate

- Merge recommendation: <recommend, recommend after explicit note acceptance, or do not recommend>
- Known automatic consequences of merge: <deploy, validation, tag, Release, or none after current workflow inspection>
- Next allowed transition: <HUMAN_GATE and the direct grant required for any mutation>

This verdict is not merge authorization.

<replace with exactly one of: READY, READY WITH NOTES, or CHANGES REQUIRED>
```

Immediately before producing the verdict, compare the live base-branch tip with `reviewed_base_tip_sha`. If it differs, do not issue a verdict: invalidate any prior verdict and every SHA-bound recommendation or grant, including when merge-base and head SHA are unchanged, and require fresh review or authorization as applicable. Replace the final placeholder so the report's final line is exactly `READY`, `READY WITH NOTES`, or `CHANGES REQUIRED`. `READY` means no known blocker at the exact reviewed SHA and reviewed base tip. `READY WITH NOTES` means no known blocker but the human must accept named limitations. `CHANGES REQUIRED` means at least one blocker exists. Every verdict stops at the human gate; the reviewer does not edit or authorize rework.

## REPLAN_REQUIRED

Use this packet when implementation evidence makes the approved plan materially wrong. Preserve safe work and do not silently select a new architecture, dependency, permission, production action, surface, or risk tier.

```yaml
replan_required:
  invalidating_evidence:
    - observation: <fact or failed verification>
      source: <file, command, output, or system state>
  affected_plan:
    assumptions:
      - <assumption invalidated>
    steps:
      - <step no longer safe or sufficient>
    acceptance_criteria:
      - <criterion affected, or none>
  current_state:
    branch: <branch>
    head_sha: <full SHA or uncommitted>
    worktree: <concise dirty-state inventory>
  safe_work_completed:
    - <work that remains useful and within authority>
  new_risks:
    - <scope, blast radius, security, release, production, or reversibility change>
  authority_implications:
    - <new phase or target that current grant does not cover>
  bounded_options:
    - option: <safe alternative>
      tradeoffs: <cost, risk, and evidence needs>
  recommendation: <preferred option and rationale>
  decision_needed: <specific planner or human choice>
  next_allowed_transition: <WAIT_FOR_PLAN_DECISION or WAIT_FOR_IMPLEMENT_AUTHORITY>
  stop_condition: <no implementation until a new plan version and valid grant exist>
```

## Optional Post-Approval Execution

Use this only after review and a later direct human grant for one exact downstream action. Use one packet and one gate transition per downstream phase, even when one human message explicitly grants several phases. After each action, stop, capture evidence, and revalidate the next packet's target and preconditions.

```yaml
post_approval_execution:
  reviewed_pr: <PR URL/number>
  reviewed_base: <base branch>
  reviewed_base_tip_sha: <full SHA; stop if the live base tip differs, even when merge-base and head SHA are unchanged>
  reviewed_head_sha: <full SHA; stop if current state differs>
  grant: <MERGE_PR | RELEASE_OR_DEPLOY | POST_MERGE_VALIDATE | POST_MERGE_REMEDIATE | CLOSE_WORK_ITEM>
  direct_human_instruction: <verbatim or unambiguous quotation from the active conversation>
  authorized_action: <one exact merge, release/deploy, validation, remediation, or closure action>
  target: <exact PR, SHA, environment, deployment, or work item>
  merge_method: <required for MERGE_PR; otherwise none>
  automatic_consequences:
    - consequence: <automatic deployment, validation, tag, Release, or other effect>
      acknowledged: <yes only when the direct instruction acknowledged it>
  preconditions:
    - <fresh state, review, CI, evidence, telemetry, or provenance condition>
  exclusions:
    - <nearby action not granted, including closure unless separately named>
  execution_evidence:
    - <command, result, URL, run ID, SHA, or dated observation to capture>
  stop_condition: <exact completion or drift/failure point that ends execution>
```

Immediately before execution, compare the live base-branch tip with `reviewed_base_tip_sha`, as well as the live PR, SHA, base, workflow behavior, environment, and automatic consequences with this packet. Any drift invalidates the packet, verdict, and every SHA-bound recommendation or grant and requires fresh review or authorization, including base-tip-only drift when merge-base and head SHA are unchanged. Validation does not authorize remediation; merge or deployment does not authorize work-item closure.
