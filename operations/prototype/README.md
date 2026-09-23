# Isolated Phase 1 workloads

These disposable prototypes are measurement tools, not production adapters.
The example configurations have no routes or schedules and disable workers.dev
and preview URLs. Repository builds do not deploy them.

`worker.mjs` probes the fixed portfolio URL, exercises a scratch D1 schema, and
optionally verifies an owner JWT against a supplied public key. Its scheduler
validates the provider event timestamp and floors it to the five-minute epoch
grid. Delayed delivery cannot move the observation into a later slot.

## Private feasibility suite

`feasibility-worker.mjs` accepts only POST requests sent through a service
binding to `https://benchmark.invalid/v1/<case>`. It rejects effects unless all
three gates validate: `PROTOTYPE_ONLY=true`, a future absolute
`BENCHMARK_UNTIL_MS` no more than six hours away, and `BENCHMARK_FIXTURES`.
Keep both Workers' public and preview URLs disabled throughout the experiment.

Generate fixtures locally with `node operations/scripts/feasibility-fixtures.mjs
<epoch-ms>`. The output contains synthetic signed tokens and two public JWKs;
private signing keys remain in process memory. Never substitute owner session
tokens or store fixture bindings in Git. The verifier uses the fixture's fixed
clock, so these cases do not measure real session expiry or revocation.

| Case | Work measured and limits |
| --- | --- |
| `auth_import` | Import a public RSA key and verify a synthetic JWT |
| `auth_denied_claim`, `auth_denied_signature` | Reject a wrong subject or altered signature |
| `auth_lookup_rotation` | Supplied two-key lookup miss, simulated refresh, import and verification; no production JWKS cache |
| `public_jwks_import` | Fetch the configured Cloudflare Access certificate URL and import its public RSA keys; five-second timeout, 64 KiB body, at most eight keys |
| `collector_http_failure` | Synthetic HTTP 503 primary and one HTTP 503 confirmation |
| `collector_timeout` | Two real ten-second AbortController timers against an injected fetch; no outbound portfolio requests |
| `metrics_288`, `metrics_2016`, `metrics_8640` | Allocate the specified synthetic history and call existing availability and status functions once each; not all three summary windows together |
| `schema_batch` | Seven-statement batch: completed run, primary, confirmation, checkpoint and three summary upserts |
| `summary_cache` | Cache lookup, at most one fixed materialized-summary SELECT, cache put and confirmation lookup |
| `owner_incident_audit` | Synthetic incident and audit inserts plus two fixed reads; no owner endpoint or authorization integration |

Bind `SCHEMA_DB` only to an explicitly disposable database with the production
schema. The fixture parents must include service `portfolio`, configuration 1,
and an enabled monitoring period starting at epoch 0. Schema requests use at
most 40 slots starting at `750000000000`, with `feasibility-v2-` IDs. Replaying a
sequence is idempotent for history/incident inserts but still updates checkpoint
and summary rows. Capture their baseline before running. Do not point this suite
at operational data. It deliberately performs no retention or bulk cleanup.

The private `feasibility-runner.mjs` binds `BENCHMARK_SERVICE` to the benchmark
Worker and has no HTTP trigger. In addition to the shared gates, configure:

- `BENCHMARK_CASES`: JSON array of unique allowlisted case names.
- `BENCHMARK_REPETITIONS`: integer string 1 through 3; at most 40 calls per run.
- `BENCHMARK_SCHEDULE_DATE`: exact UTC date, `YYYY-MM-DD`.
- `BENCHMARK_MINUTE_RANGE`: inclusive UTC minute-of-day range, such as `720-721`.
- Optional `BENCHMARK_SPREAD_MINUTES=true`: make exactly one call per scheduled
  minute, in case/repetition order. The range length must equal cases times
  repetitions. This keeps separate workloads out of the same runner invocation.
- `PUBLIC_JWKS_URL` on the benchmark only: the trusted team's exact
  `https://<team>.cloudflareaccess.com/cdn-cgi/access/certs` URL.

Use a finite cron matching that range, and account for every possible invocation
in the budget. The runner awaits calls sequentially, stops on a failed response,
and logs bounded results with credential/owner fields removed. Start with small
subsets: a 40-call cap is not evidence that 40 calls fit the CPU budget. Compare
provider invocation CPU, outcomes and D1 metadata before increasing workload.
The isolate ordinal distinguishes first module use from reuse; it does not prove
a provider cold start. Record runner CPU separately from child Worker CPU.

Before each experiment, read account usage and reserve a conservative allowance
for the next batch and shutdown. Stop before the local test ceilings of 500,000
D1 reads or 40,000 D1 writes per UTC day. Keep the account on Free, remove cron
after measurement, read back empty schedules and disabled URLs, and retain
identified fixtures when deletion would consume the remaining write budget.
An absolute expiry prevents further useful work even during schedule removal
propagation. No scheduled follow-up or paid upgrade is part of this suite.

The [staging evidence](../../docs/operations-staging-evidence-2026-09-13.md)
separates provider measurements from synthetic tests, projections, and remaining
production adoption requirements.
