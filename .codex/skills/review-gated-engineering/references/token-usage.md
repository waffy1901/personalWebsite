# Token Usage Snapshots

At every workflow human gate and terminal handoff, run the collector when the local Codex session JSONL is available:

```bash
python3 .codex/skills/review-gated-engineering/scripts/summarize_token_usage.py \
  --root-session-id <root-session-id> \
  --since <workflow-start-UTC> \
  --phase <workflow-phase> \
  --requested-model <requested-model> \
  --requested-effort <requested-effort>
```

For mixed delegated work, repeat `--session-label 'SESSION=PHASE|ROLE|REQUESTED_MODEL|REQUESTED_EFFORT'`. It overrides only the report labels for that unique session ID; actual model/effort still come from `turn_context`.

Use `--format markdown` for a packet and `--format json` for machine-readable evidence. The collector is read-only and deterministic apart from its recorded UTC collection time. It normalizes the first metadata record immediately to only identifiers, linkage, role/path, and start time, then extracts only selected-session metadata, `turn_context`, and `token_count` telemetry. It neither retains, prints, nor persists prompts, responses, instructions, tool inputs, or tool outputs.

Each group is phase, role, session, actual model, and actual effort. It reports response count, input, cached input, cache-write input, derived uncached input, output, reasoning output, and total. Cached/cache-write are subsets of input, reasoning output is a subset of output, and total is input plus output: none are added twice. Requested model/effort are user-supplied labels, while actual values come only from `turn_context`.

Missing or inconsistent telemetry produces warnings and `unavailable`, never invented zeroes or estimates. The report records both its UTC collection time and the latest included telemetry observation. Its aggregate table is a complete total only when every selected group has that metric; otherwise it is an observed subtotal with unavailable-group coverage. State those times and linked-session coverage in the handoff. The report's own final response and later turns are excluded because they are not observable before delivery.
