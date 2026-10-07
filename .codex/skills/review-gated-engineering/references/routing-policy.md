# Runtime Routing Policy

Apply this reference before every `spawn_agent` call for a delegated planner, implementer, reviewer, or specialist, and when reviewing a routing record. It enforces runtime routing without changing authority, human gates, SHA binding, review independence, or any stop condition in the parent workflow.

## Live Capability Inspection And Spawn Contract

Inspect the live `spawn_agent` schema immediately before routing. Record whether it exposes `model`, `reasoning_effort`, and `fork_turns`, together with the model overrides and per-model supported efforts advertised by the active session. A model name in an agent prompt or a custom profile does not prove a runtime override.

When both `model` and `reasoning_effort` are exposed, every delegated planner, implementer, reviewer, and specialist spawn must pass both values explicitly by default. The only exception is the pre-spawn intentional-inheritance decision defined below. Every delegated spawn must also set `fork_turns: "none"`, unless the smallest positive bounded context is necessary and recorded. Never omit `fork_turns`, pass `"all"`, or depend on inherited full history as a shortcut. Send the complete packet required by `handoff-contracts.md`, including original request, approved plan/version, authority, exact scope, verification evidence, base/head SHA, and relevant repository conventions.

The spawn result or another runtime/session metadata source is the only evidence for an actual selected model or effort. If it does not expose those fields, record `actual_model: unknown` and `actual_reasoning_effort: unknown`; do not infer them from the requested override.

At a human gate or terminal state, retain the requested spawn values and collect actual per-segment model/effort from session `turn_context` when locally available. Use the token-usage reference and collector; requested routing is not evidence of actual routing.

## Capability Mapping And Safe Fallback

Prefer the latest available generation within each evidenced capability class. The following mapping was verified on 2026-10-07 against the active-session override descriptions and [official OpenAI model guidance](https://developers.openai.com/api/docs/models):

| Capability | Preferred runtime model |
| --- | --- |
| `efficient` | `gpt-6-luna` |
| `balanced` | `gpt-6.1-sol` |
| `frontier` | `gpt-6-astra` |

Treat these names as a dated mapping, not permanent identities. Refresh the mapping from live capability descriptions when a newer model is advertised; use current official OpenAI documentation when those descriptions do not establish its class or relative strength. Availability comes from the session, not the public API catalog. Never rank models by version number, name, or price alone. Older models, including `gpt-5.6-*` and `gpt-6-sol`, are not defaults when their current replacements are available; retain an older target only for a direct human model pin or a documented availability fallback. A pin does not waive the reviewer strength rule.

If a preferred override is absent, select the nearest runtime-observed model with an evidenced equal or higher class: efficient may use balanced or frontier; balanced may use frontier; frontier cannot fall below frontier. Establish the relation from current capability evidence, not a legacy class assignment. Recheck reviewer strength after any fallback. If no option meets both the tier floor and reviewer comparison, stop delegation at the applicable workflow decision/human gate instead of silently downgrading.

First choose and record the policy target model and effort for the role/tier and, for a reviewer, the comparison with implementation. That requested target never changes merely because the spawn must inherit. If the schema lacks either explicit override control and no intentional-inheritance exception was recorded before spawning, use inheritance only as a visible fallback: retain the selected `requested_model` and `requested_reasoning_effort`, set `routing_source: fallback_inheritance`, set `actual_routing: inherited_parent`, state exactly which control was unavailable, and mark actual model/effort `unknown` unless runtime metadata proves them. A reviewer inheritance fallback additionally requires runtime-confirmed parent settings that meet the selected target and the strict comparison before spawning; an unknown or equal parent cannot qualify. Do not start an external `codex exec` process to evade this limitation without a direct human authorization for that architectural change.

The normal path is explicit override when both controls are available, or `fallback_inheritance` when either is unavailable. `intentional_inheritance` is a separately documented, narrowly gated exception to that normal path; a missing control alone is never a reason to select it. It may be selected only when all of the following are recorded before the spawn:

1. The parent model and reasoning effort are runtime-confirmed, not inferred from a prompt, policy, or custom profile, and demonstrably meet or exceed the selected child capability and effort target.
2. A concrete role-specific reason requires avoiding explicit child routing. Cost, convenience, task length, and ordinary parent copying are not reasons.
3. The packet records the equal-or-higher comparison, reason, source `intentional_inheritance`, `actual_routing: inherited_parent`, and child actual model/effort as `unknown` unless child runtime metadata proves them.

This exception is never a default and cannot establish child settings from coordinator settings. For a reviewer it must also satisfy the strict comparison below. If any gate is absent, explicit overrides remain mandatory when supported; if they are unsupported, use `fallback_inheritance` only when its role-specific conditions are met.

## Tier Floors And Proportional Selection

Choose the lowest-cost current-generation profile meeting the floor after assessing task ambiguity, execution complexity, blast radius/failure cost, role, failed attempts, and uncertainty. Escalate with evidence, not merely because work is long. Before implementation, identify an available compliant reviewer so the workflow can complete; do not reduce necessary implementation effort to manufacture reviewer headroom.

| Tier | Planner, if delegated | Implementer | Reviewer | Specialist |
| --- | --- | --- | --- | --- |
| `T0` | Efficient, low or medium. | Normally no subagent. If delegation is justified: efficient, low or medium. | Normally no subagent; same-agent self-review. | Only if concrete risk warrants it: efficient, low or medium. |
| `T1` | Balanced, medium. | Balanced, medium or high. | Fresh balanced, at least high; increase effort or model to satisfy the strict comparison. | Efficient or balanced, low through high as the named risk requires. |
| `T2` | Frontier, high or higher when justified. | Balanced, high by default; frontier only for deeply coupled execution. | Fresh frontier, high. | Balanced, high unless the named risk itself requires frontier. |
| `T3` | Frontier, highest justified effort. | Frontier, high by default; increase only for demonstrated execution complexity. | Fresh frontier at the highest justified effort, normally max when planning/risk warrants it. | Balanced or frontier based on the concrete specialist risk; never automatic max. |

These are floors/defaults, not a parent inheritance rule. The coordinator may remain on the user's selected profile. Lower-cost implementation never reduces the reviewer floor. The strict comparison also applies to `T2`/`T3` and to any independent reviewer explicitly delegated for `T0`; ordinary `T0` same-agent self-review requires no separate profile.

## Strict Reviewer Strength Comparison

Before each reviewer spawn, recompute the comparison against every profile that implemented or reworked the current diff, including a coordinator that edited files. Use runtime-confirmed model/effort when available. Otherwise, an explicit implementation spawn request permits only a provisional comparison; unknown inherited implementation settings do not establish a comparison. Rework or implementation escalation invalidates a previous routing comparison even if the original tier floor is unchanged.

A reviewer must meet its tier floor and one of these conditions for **each** implementation profile:

1. Use a demonstrably stronger model: a higher evidenced capability class, or a same-class model with current evidence establishing greater capability. Different model names alone are insufficient. Reasoning-effort labels across different models do not establish comparative strength.
2. Use the exact same model with strictly higher supported reasoning effort. The order is `none < minimal < low < medium < high < xhigh < max < ultra`; select only values supported for that model in the live schema. API documentation and session tools may expose different effort sets; the session schema controls a spawn. A new or unordered effort label needs runtime ordering evidence before comparison.

A weaker model at higher effort never qualifies. Equal model/effort pairs never qualify. A fresh agent is required independently of this strength comparison; a stronger model does not replace review independence.

Typical current pairs are Sol medium -> Sol high for `T1`, Sol high -> Sol xhigh for `T1`, Sol high -> Astra high for `T2`, and Astra high -> Astra max for `T3`. If implementation escalates to Astra max, use Astra ultra only when supported and justified, or an evidenced stronger available model. If no compliant option exists at the model/effort ceiling, stop at the applicable decision/human gate. Do not silently use an equal reviewer, pretend a requested escalation ran, lower recorded implementation settings, or add duplicate reviewers to compensate.

Record the compared implementation profiles, evidence of model/effort ordering, chosen reviewer, and result in `reviewer_strength_check` in the common handoff. After spawning, check child runtime metadata when available. A known actual profile that fails the comparison invalidates routing eligibility and any review verdict; obtain a fresh compliant reviewer before returning to the review human gate. Explicit requests without actual metadata remain `pending_runtime_verification`, not proven stronger execution; any advisory review can be at most `READY WITH NOTES` with that named limitation. An inherited route with unknown actual settings cannot qualify for a verdict until metadata establishes compliance. None of these outcomes grants rework, publication, merge, or downstream authority.

## Required Behavioral Regression Cases

Use these cases when changing or forward-testing this policy. Evaluate the routing decision, actual spawn arguments or visible fallback, fresh-review requirement, telemetry, and authority/SHA invariants rather than matching prose alone.

| Case | Inputs | Required observable behavior |
| --- | --- | --- |
| Latest models alongside legacy options | Controls advertise current Luna, Sol, Astra and older 5.6/6 Sol options | Map efficient/balanced/frontier to the latest evidenced generation; do not select a legacy default merely because it is available or cheaper. |
| Future generation advertised | Live descriptions establish a newer replacement within a class | Refresh the mapping before selection; use current official evidence if relative capability is unclear, rather than guessing from its name. |
| Sol Max parent, T1 implementer | Controls and current Sol available; limited familiar implementation | Spawn explicit current Sol/medium or high, with a compliant reviewer identified; do not inherit parent; record actual values only from runtime metadata. |
| Sol Max parent, T2 implementer | Controls and current Sol available; normal coupled scope | Spawn explicit Sol/high; use Astra only with evidence of deeply coupled execution; do not inherit parent. |
| T1 implementer medium | Sol/medium implementation; same-model reviewer high supported | Fresh Sol/high meets the floor and strict effort comparison. |
| T1 implementer high | Sol/high implementation; xhigh supported | Reject Sol/high review; select Sol/xhigh or evidenced stronger Astra at its reviewer floor. |
| T2 reviewer | Sol/high implementation; reviewable exact SHA; Astra available | Spawn fresh Astra/high explicitly with bounded context and complete packet; record higher-model evidence. |
| T2 implementation escalation | Current diff also includes Astra/high rework | Recompute across all contributing profiles; reject Astra/high review and select Astra/xhigh or stronger, while preserving tier and SHA requirements. |
| T3 implementer | Astra available; high-risk but ordinary execution complexity | Spawn explicit Astra/high, not automatic max; justify escalation and identify compliant review capacity. |
| T3 reviewer effort | Astra/high implementation; highest-risk review warrants max | Fresh Astra/max meets both the tier selection and strict comparison. |
| Model/effort ceiling | Astra/ultra implementation; no stronger model or higher supported effort | Stop delegation visibly; do not pair Astra/ultra with itself or add reviewers as a substitute. If implementation is Astra/max, ultra is eligible only when live-supported and justified. |
| Weaker model, higher effort | Astra/high implementation; proposed Sol/ultra reviewer | Reject the pair; higher effort cannot establish superiority of a weaker model. |
| Unordered models | Different models without evidenced relative capability | Do not assume greater strength; use a proven higher model or the exact implementation model at higher effort, or stop. |
| Preferred model unavailable | Sol absent; Astra evidenced frontier and available | Use Astra as safe balanced fallback, record why, then recompute reviewer strength; reject equal Astra settings and never downgrade to Luna. |
| Only Sol available | T1 Sol/high implementation; higher efforts available; T2 requires frontier review | T1 may use Sol/xhigh. T2 cannot waive its frontier floor merely by increasing Sol effort; stop if no model meets both constraints. |
| Schema lacks overrides | `model` and/or `reasoning_effort` absent; no intentional-inheritance exception | Retain requested targets, record unavailable controls and `fallback_inheritance`; reviewer spawn requires confirmed parent meeting the target and strict comparison, otherwise stop. Keep child actual values unknown absent metadata. |
| Intentional inheritance exception | Controls exist; parent model/effort are runtime-confirmed equal-or-higher than the selected child target; a concrete role-specific reason rules out explicit child routing | Record all three pre-spawn gates, retain the policy-selected requested model/effort, use `intentional_inheritance`, and keep actual child model/effort unknown unless child metadata proves them. Without every gate, use explicit override. |
| Unknown or mismatched actual routing | Explicit reviewer request qualifies; child metadata is absent or shows equal/weaker execution | Absent metadata remains pending with a named advisory limitation, at most READY WITH NOTES. Known mismatch invalidates eligibility/verdict and requires fresh compliant review; never report requested settings as actual. |
| T0 self-review | Narrow reversible change with no independent reviewer delegated | Same-agent self-review remains permitted; if an independent reviewer is delegated, apply the strict comparison. |
| Post-review change | Reviewer delivered verdict for exact SHA; new commit/rebase/base change follows | Invalidate the verdict and any SHA-bound recommendation/grant; require fresh independent review before the human gate. |
| Base-tip-only drift | Reviewer packet and verdict name a full `reviewed_base_tip_sha`; the base branch advances while merge-base and head SHA remain unchanged | Immediately before review and downstream execution, compare the live base tip with `reviewed_base_tip_sha`; on mismatch, invalidate the verdict and every SHA-bound recommendation/grant and require fresh review or authorization. |
| Routing and authority | Any model/effort/fallback decision under limited grant | The routing record does not expand `IMPLEMENT_LOCAL`, `IMPLEMENT_TO_PR`, merge, deployment, production, remediation, or closure authority; stop at the existing phase boundary. |
| Usage telemetry unavailable | Selected linked session has no complete `token_count` fields or no `turn_context` | Report the affected metrics or actual route as unavailable with warnings; do not substitute zeroes, estimates, or requested routing. |

For this skill update, independently inspect the live session tool definition before reporting that overrides are supported. The policy can prove requested spawn arguments and fallback behavior; it cannot prove an actual child model/effort without runtime metadata.
