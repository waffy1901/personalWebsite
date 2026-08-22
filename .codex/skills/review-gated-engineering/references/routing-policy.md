# Runtime Routing Policy

Apply this reference before every `spawn_agent` call for a delegated planner, implementer, reviewer, or specialist, and when reviewing a routing record. It enforces runtime routing without changing authority, human gates, SHA binding, review independence, or any stop condition in the parent workflow.

## Live Capability Inspection And Spawn Contract

Inspect the live `spawn_agent` schema immediately before routing. Record whether it exposes `model`, `reasoning_effort`, and `fork_turns`, together with the model overrides advertised by the active session. A request saying "use Terra," an agent prompt, or a custom profile does not prove a runtime override.

When both `model` and `reasoning_effort` are exposed, every delegated planner, implementer, reviewer, and specialist spawn must pass both values explicitly by default. The only exception is the pre-spawn intentional-inheritance decision defined below. Every delegated spawn must also set `fork_turns: "none"`, unless the smallest positive bounded context is necessary and recorded. Never omit `fork_turns`, pass `"all"`, or depend on inherited full history as a shortcut. Send the complete packet required by `handoff-contracts.md`, including original request, approved plan/version, authority, exact scope, verification evidence, base/head SHA, and relevant repository conventions.

The spawn result or another runtime/session metadata source is the only evidence for an actual selected model or effort. If it does not expose those fields, record `actual_model: unknown` and `actual_reasoning_effort: unknown`; do not infer them from the requested override.

## Capability Mapping And Safe Fallback

Resolve classes from the live override list in this order:

| Capability | Preferred runtime model |
| --- | --- |
| `efficient` | `gpt-5.6-luna` |
| `balanced` | `gpt-5.6-terra` |
| `frontier` | `gpt-5.6-sol` |

Treat the preferred names as runtime mappings, not architectural identities. If the preferred override is absent, select the nearest runtime-observed model that has an evidenced equal or higher class: efficient may use balanced or frontier; balanced may use frontier; frontier cannot fall below frontier. Use a known live class mapping or explicit runtime capability annotation to establish that relation. If no equal-or-higher option is evidenced, stop delegation at the applicable workflow stop/decision state instead of silently downgrading.

First choose and record the policy target model and effort for the role/tier. That requested target never changes merely because the spawn must inherit. If the schema lacks either explicit override control and no intentional-inheritance exception was recorded before spawning, use inheritance only as a visible fallback: retain the selected `requested_model` and `requested_reasoning_effort`, set `routing_source: fallback_inheritance`, set `actual_routing: inherited_parent`, state exactly which control was unavailable, and mark actual model/effort `unknown` unless runtime metadata proves them. Do not start an external `codex exec` process to evade this limitation without a direct human authorization for that architectural change.

The normal path is explicit override when both controls are available, or `fallback_inheritance` when either is unavailable. `intentional_inheritance` is a separately documented, narrowly gated exception to that normal path; a missing control alone is never a reason to select it. It may be selected only when all of the following are recorded before the spawn:

1. The parent model and reasoning effort are runtime-confirmed, not inferred from a prompt, policy, or custom profile, and demonstrably meet or exceed the selected child capability and effort target.
2. A concrete role-specific reason requires avoiding explicit child routing. Cost, convenience, task length, and ordinary parent copying are not reasons.
3. The packet records the equal-or-higher comparison, reason, source `intentional_inheritance`, `actual_routing: inherited_parent`, and child actual model/effort as `unknown` unless child runtime metadata proves them.

This exception is never a default and cannot turn a Sol Max coordinator into Sol Max children. If any gate is absent, explicit overrides remain mandatory when supported; if they are unsupported, use `fallback_inheritance`.

## Tier Floors And Proportional Selection

Choose the lowest-cost profile meeting the floor after assessing task ambiguity, execution complexity, blast radius/failure cost, role, failed attempts, and uncertainty. Escalate with evidence, not merely because work is long.

| Tier | Planner, if delegated | Implementer | Reviewer | Specialist |
| --- | --- | --- | --- | --- |
| `T0` | Efficient, low or medium. | Normally no subagent. If delegation is justified: efficient, low or medium. | Normally no subagent; same-agent self-review. | Only if concrete risk warrants it: efficient, low or medium. |
| `T1` | Balanced, medium. | Balanced, medium or high. | Fresh balanced, high. | Efficient or balanced, low through high as the named risk requires. |
| `T2` | Frontier, high or higher when justified. | Balanced, high by default; frontier only for deeply coupled execution. | Fresh frontier, high. | Balanced, high unless the named risk itself requires frontier. |
| `T3` | Frontier, highest justified effort. | Frontier, high by default; increase only for demonstrated execution complexity. | Fresh frontier at the highest justified effort, normally max when planning/risk warrants it. | Balanced or frontier based on the concrete specialist risk; never automatic max. |

These are floors/defaults, not a parent inheritance rule. The coordinator may remain on the user's selected profile. Lower-cost implementation never reduces the reviewer floor, and reviewers remain fresh independent agents.

## Required Behavioral Regression Cases

Use these cases when changing or forward-testing this policy. Evaluate the routing decision, actual spawn arguments or visible fallback, fresh-review requirement, telemetry, and authority/SHA invariants rather than matching prose alone.

| Case | Inputs | Required observable behavior |
| --- | --- | --- |
| Sol Max parent, T1 implementer | Controls and Terra available; limited familiar implementation | Spawn with explicit Terra-equivalent balanced model and medium/high effort; do not inherit Sol Max; record explicit source and actual values only if runtime metadata exposes them. |
| Sol Max parent, T2 implementer | Controls and Terra available; normal coupled scope, not deeply coupled execution | Spawn explicit balanced/high; use frontier only with evidence of deeply coupled execution; do not inherit parent. |
| Sol Max parent, T2 reviewer | Reviewable exact SHA; controls and Sol available | Spawn a fresh reviewer with explicit frontier/high and `fork_turns: "none"` or minimal bounded context, plus complete packet. |
| Sol Max parent, T3 implementer | Controls and Sol available; high-risk but ordinary execution complexity | Spawn explicit frontier/high, not automatic max; justify any escalation. |
| T3 reviewer effort | Highest-risk planning/risk warrants max | Fresh frontier reviewer receives max (or strongest justified available effort); preserve independent review and human gate. |
| Preferred model unavailable | Required balanced; Terra absent; Sol present and evidenced frontier | Use Sol as the equal-or-higher safe fallback, record why; never route to Luna. If no equal-or-higher model is evidenced, stop delegation visibly. |
| Schema lacks overrides | `model` and/or `reasoning_effort` absent; no intentional-inheritance exception recorded | Do not claim explicit routing; retain the policy-selected requested model/effort (for example Terra/high), record the unavailable-control reason, use `fallback_inheritance`, and keep actual fields unknown absent metadata. |
| Intentional inheritance exception | Controls exist; parent model/effort are runtime-confirmed equal-or-higher than the selected child target; a concrete role-specific reason rules out explicit child routing | Record all three pre-spawn gates, retain the policy-selected requested model/effort, use `intentional_inheritance`, and keep actual child model/effort unknown unless child metadata proves them. Without every gate, use explicit override. |
| Post-review change | Reviewer delivered verdict for exact SHA; new commit/rebase/base change follows | Invalidate the verdict and any SHA-bound recommendation/grant; require fresh independent review before the human gate. |
| Routing and authority | Any model/effort/fallback decision under limited grant | The routing record does not expand `IMPLEMENT_LOCAL`, `IMPLEMENT_TO_PR`, merge, deployment, production, remediation, or closure authority; stop at the existing phase boundary. |

For this skill update, independently inspect the live session tool definition before reporting that overrides are supported. The policy can prove requested spawn arguments and fallback behavior; it cannot prove an actual child model/effort without runtime metadata.
