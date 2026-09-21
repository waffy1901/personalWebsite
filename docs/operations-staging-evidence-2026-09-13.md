# Operations Phase 1 staging evidence

Refs #229. Measurements: 2026-09-13 UTC; final pause/readback: 2026-09-14 UTC.
This report records an isolated,
user-authorized feasibility experiment. It does not activate the operations
product or complete the provider exit gate.

## Decision and scope

Cloudflare Free remains a conditional design target. Scheduled collection,
owner token validation, D1 constraints, bounded retention, and recovery worked
in staging. The additional private workloads below measure selected components.
A complete production request/collector path, representative cold/warm
distributions, and full-schema 30-day cost remain unproven. Do not infer
production readiness or guaranteed account-wide free usage from these samples.

The user confirmed Workers Free and Zero Trust Free onboarding. The connected
API could not read billing subscriptions, so the plan claim is user-confirmed.
No paid upgrade, production DNS, registrar, portfolio deployment, public
operations route, or owner mutation endpoint was introduced.

The experiment has stricter UTC-day ceilings of 500,000 D1 reads and 40,000 D1
writes. Account analytics can lag; returned statement metadata and conservative
next-batch bounds were also checked. Large fixtures are retained while paused
because deletion adds indexed writes.

## Source and isolated resources

The merged foundation is PR #230 at
`3ffb9dd906cf227a32ee82bf9203c5b8fd5f340d`. The compatibility date is
`2026-09-10`. These resources contain synthetic staging data only:

| Resource | Identifier and purpose |
| --- | --- |
| Original Worker | `portfolio-operations-staging`; scratch collector and read-only auth |
| Scratch D1 | `87221a46-c850-4459-8080-cc84278d7de7`; 30-day prototype cardinality |
| Schema D1 | `b3b52dce-4c3b-4129-b04c-ffc3184a81a8`; production migration/retention rehearsal |
| Recovery D1 | `0d2f0f9f-736c-485f-a0a1-bfd32f9355ac`; export restore and later full-schema fixtures |
| Benchmark Worker | `portfolio-operations-feasibility`; private service binding only |
| Runner Worker | `portfolio-operations-feasibility-runner`; finite, expiring scheduled cases |

The original fix source SHA-256 is
`21d03aeba7f48dcdb34e5122a512105f1133bff6ec222e41fdfb46815d66e6e0`.
Its first fixed deployment was `61bd4743-3178-4590-b8f8-3a2008b6a853`
at 14:04:47 UTC; same-source uploads followed at 14:17:42 and 17:01:37 UTC.
The owner request below used `2c7ed8b9-5ee1-4d20-bc52-e4fb8cddfd22`.

The private auth suite used benchmark
`3c9add28-7116-44f3-af87-241ca200991a` and runner
`e743ecff-f247-42ce-b2c2-79d09c4a4dbc`.
The spread suite used benchmark
`bc99228f-0bb6-4abf-ae1d-48835bb65ac1` and runner
`2c3679e6-6b48-43b1-9a6e-4aaedab09128`.
Both had public and preview URLs disabled. The spread cron was
`13-26 22 13 9 *`: one case per minute, seven cases planned twice.
It was stopped at 22:20:59 after the first metric sample approached the CPU
limit; eight child invocations had completed. The runner was disabled before
removing its schedule. Absolute expiry was 22:45 UTC. Propagating old cron
events outside the new minute range were rejected before any child call.

See the [prototype instructions](../operations/prototype/README.md) for fixture
bounds, disabled configurations, and reproduction constraints. Synthetic signing
keys were generated locally; only public JWKs and synthetic tokens were uploaded.
No real owner bearer token, cookie, or private signing key was copied.

## Scheduler correction and real observations

Eighteen original cron invocations failed with `Invalid slot`: the provider's
scheduled timestamp contained seconds within the scheduled minute. The fix
validates that event timestamp before network work and floors it to the
five-minute epoch grid. Delayed delivery cannot move it to another slot.

A September 21 source review also identified future timestamps reaching the
probe before rejection. The source now rejects them against a clock captured
before any effects, including future times inside the current slot. Fixed-clock
regression checks cover those cases with zero fetch/database calls. This later
source correction has not been deployed to the paused staging Workers.

The fixed finite schedule was `10-35/5 14 13 9 *`. Removing it at 14:21:10
still allowed one 14:25 invocation during propagation. Four real GETs to the
allowlisted portfolio URL persisted; all returned HTTP 200 and outcome `ok`.

| UTC slot | Response-header duration | Worker CPU | Worker wall time |
| --- | --- | --- | --- |
| 14:10 | 797 ms | 5 ms | 1,551 ms |
| 14:15 | 586 ms | 2 ms | 1,312 ms |
| 14:20 | 800 ms | 6 ms | 1,529 ms |
| 14:25 | 874 ms | 2 ms | 1,593 ms |

CPU p50 was 3.5 ms; nearest-rank p95 and max were 6 ms. This small success sample
does not establish a worst case or cold/warm population. The observations survived
two same-source uploads. Durations stop at response headers; they are synthetic
HTTP response times, not page-render or user-experience measurements.

With 8,640 marked synthetic scratch rows, each measured collector batch read
8,648 rows and wrote four. The grouped query scanned its covering index.
At 288 daily runs, this projects 2,490,624 reads/day; a conservative six
writes/run projects 1,728 writes/day. These costs belong to the simpler scratch
schema, not the production schema. The fixtures are never availability evidence.

## Authentication and private workload measurements

At 17:11:06.681 UTC the user opened the protected auth path and supplied a
screenshot showing `{"workload":"prototype-auth","verified":true}`.
Provider telemetry independently recorded HTTP 200, outcome `ok`, 1 ms CPU,
and 1 ms wall time on the configured original Worker version.

Anonymous and forged-header requests redirected to Access login. The policy
allowed only the owner, with one-hour sessions and no Everyone, bypass, or
service-token rule. Earlier 401 responses were caused by missing validation
bindings; the same source was configured with the trusted issuer, audience,
owner subject, and current public JWK. Automated Chrome navigation was blocked
by `ERR_BLOCKED_BY_CLIENT`; the successful browser check was performed by the user.

Three private synthetic auth suites produced:

| Case | Worker CPU samples (ms) | Result |
| --- | --- | --- |
| Supplied-key import and valid signature | 1, 0, 0 | Verified |
| Wrong subject | 1, 0, 0 | Rejected as expected |
| Altered signature | 0, 0, 0 | Rejected as expected |
| Supplied-key lookup/rotation simulation | 1, 0, 0 | Initial miss, refreshed hit, verified |

Runner CPU was 5, 3, and 3 ms. Every harness invocation returned 200 with outcome
`ok`; for denial cases 200 means the expected rejection assertion passed.
Zero is the provider's rounded CPU measurement, not zero computation.
The first valid-key invocation was first module use; the remaining invocations
reused that isolate. This diagnostic is not proof of provider cold starts.
Synthetic rotation uses two supplied keys and a fixed fixture clock; it is not
production JWKS refresh, session expiry, revocation, or a complete owner flow.

The spread suite measured the following components independently:

| Case | Worker CPU (ms) | Wall time (ms) | D1 reads/writes | Result |
| --- | --- | --- | --- | --- |
| Seven-statement schema batch, first insert | 3 | 510 | 10 / 19 | Passed |
| Same batch, next slot and summary updates | 2 | 490 | 13 / 16 | Passed |
| Materialized summary, cache miss then hit | 3 | 137 | 1 / 0 | Passed |
| Incident plus audit inserts and reads | 2 | 63 | 4 / 7 | Passed |
| Two synthetic HTTP 503 responses | 1 | 2 | 0 / 0 | Primary and confirmation retained |
| Two injected ten-second timeout waits | 2 | 20,000 | 0 / 0 | Both timeouts recorded |
| 288-observation availability plus status | 9 | 10 | 0 / 0 | Correct result, insufficient CPU headroom |
| Public JWKS fetch/import, first attempt | 1 | 2 | 0 / 0 | HTTP 500; diagnostic follow-up below |

The timeout case waited on real AbortController timers but sent no network
requests. The metric case generated synthetic data and ran one availability
window plus status; it did not query D1 or compute all three windows. At 9 ms,
even this 24-hour sample approached the Free CPU limit. Its second repetition
and the 2,016/8,640-observation remote cases were cancelled rather than risking
a limit breach. All cardinalities passed local correctness tests; local timing
does not substitute for provider measurements. No resource-limit outcome was
observed. These one/two-sample measurements do not establish tail percentiles.

Five diagnostic attempts from 22:29 through 22:33 on version
`e23a5e3e-928d-482f-90b2-4d4771344191` isolated the failure to `fetch`, before
an HTTP response. The harness used `redirect: 'error'`, which the workerd runtime
rejects. It now uses `manual` and rejects non-success responses, including
redirects, without following them. A regression verifies that a 302 produces one
request and fails before key import.
[workerd request implementation](https://github.com/cloudflare/workerd/blob/main/src/workerd/api/http.c%2B%2B)

Version `358800a4-3487-449b-a277-72cb11b71a0c`, uploaded at 22:34:19, then
completed nine public-certificate fetch/import calls from 22:34 through 22:42.
Every call returned 200 and imported two RSA keys. CPU samples were
`2, 1, 1, 1, 2, 1, 1, 1, 1` ms; wall times were
`78, 72, 15, 71, 79, 22, 59, 18, 68` ms. Runner CPU was 0-1 ms. These calls
made no D1 queries. First module use was followed by eight reused-isolate calls;
production token verification and JWKS cache/rotation remain separate work.

The diagnostic-only runner version was `8316e6bd-111c-46dc-a92e-f467caade066`,
with finite cron `28-42 22 13 9 *` and absolute expiry at 22:45 UTC. Fourteen
calls were observed in that window: five failures before the fix and nine
successes after it. An earlier 22:24-22:25 diagnostic schedule produced no
recorded invocation. Cron changes can take up to 15 minutes to propagate.
[Cron Triggers](https://developers.cloudflare.com/workers/configuration/cron-triggers/)

## Production-schema sample and traffic bounds

The recovery database was sampled with 500 synthetic failed-primary slots, each
with a run and timeout confirmation. IDs are `feasibility-v2-history-0..499`,
on slots `570000000000..570149700000`. A ten-slot calibration and 490-slot
expansion measured five indexed writes/run, four/primary, and three/confirmation:
**12 writes/slot**, or 6,000 writes for this sample.

Database size grew from 233,472 to 471,040 bytes, including index/page overhead.
The incremental 237,568 bytes are about 475 bytes/slot in this fixture. A linear
30-day extrapolation is about 4.34 MB including the baseline; it is not an observed
30-day size or a conservative upper bound. The indexed outcome/range query
reported 1,000 rows read for 500 primaries; EXPLAIN selected the composite index.
The foreign-key check returned no violations.

A full 8,640-slot worst-case seed alone would require **103,680 indexed writes**,
before checkpoints, summaries, or other account work. It was not run: that
exceeds both the 40,000-write experiment ceiling and the 100,000-write Free
daily allowance. This is a setup budget result, not a claim that normal daily
collection needs that many writes.

Projecting the measured two reads/slot to a full 30-day scan on every five-minute
run gives 17,280 reads/run and **4,976,640 reads/day**, before all other work.
This is an extrapolation from 500 slots, not a measured full-corpus query.
Phase 2 needs a bounded aggregation/materialization design and fresh evidence;
it must not adopt repeated full-history scans based on the scratch result.

The observed summary-cache miss read one materialized row and its immediate
follow-up lookup hit without another D1 query. Public traffic must use bounded
materialized data. Cache API storage is local to a data center and is unavailable
for Workers fronted by Access, so this private service-binding test does not
prove public multi-location hit rates or owner response caching.
[Cache API](https://developers.cloudflare.com/workers/runtime-apis/cache/)

For an illustrative steady-state budget, the observed 16-write batch repeated
288 times/day is 4,608 writes. Retiring an equal volume at the measured 12
indexed history writes/slot would add about 3,456 writes/day (a projection,
not a measured sustained cleanup rate). Ten owner incident/audit operations
add 70 writes and 40 reads, and 1,000 summary cache misses add 1,000 reads.
That scenario is about 8,134 writes/day before configuration, deployment sync,
and other account use. Request traffic caps and overload behavior are not yet
implemented; this scenario is neither a promised traffic allowance nor proof
that the complete collector fits the CPU/read budgets.

## Constraints, retention, and recovery

The unchanged production migration ran on the separate empty schema database:
41 statements, 47 reads, 74 writes, 15 tables, 16 indexes, and ten triggers.
All 13 invalid mutation probes failed at the expected constraint, covering
ownership, immutable/unique observations and configuration, period overlap,
slot alignment, foreign keys, publications, checkpoints, and audit records.
Direct SQL did not create a Wrangler migration ledger; deployment still needs
the normal numbered-migration process.

Two passes of the exact nine production retention statements reduced 125 old
rows in each tested history/audit table to 25, then zero. Each statement stayed
capped at 100 deletions. The unresolved-down checkpoint, open incident, current
and latest publication references, and referenced deployments survived.
Old pending deployment, closed incident/update, and ended maintenance were
removed; foreign-key checks remained empty.

Recovery was rehearsed with synthetic data only:

1. Capture a Time Travel bookmark, insert an audit marker, restore, and verify
   the marker disappeared while retained state and foreign keys survived.
   API plus readback took about 2.1 seconds.
2. Export retained schema/data (14,416 bytes, SHA-256
   `7f434ac5e5160c3508c0e033376db12477be4890c0db865df1c5578547062fcb`),
   restore into the empty recovery DB, and compare all 41 schema definitions and
   all 15 table contents. They matched; restore used 69 reads and 108 writes.

These small-fixture timings are not a production recovery-time guarantee.
Local SQLite integrity checking passed. D1 disallowed `PRAGMA integrity_check`;
that unsupported check is not reported as passed.

For repetition, capture an export/bookmark before mutation, restore only into
the explicitly selected staging target, and compare retained tables, foreign
keys, checkpoints, and publication references before activation. Time Travel
Free recovery is seven days; it is separate from application retention.
[D1 Time Travel](https://developers.cloudflare.com/d1/reference/time-travel/)

## Free-plan limits and remaining adoption gate

Provider documentation checked 2026-09-13: Workers Free allows 100,000 requests/day
and 10 ms CPU per HTTP/cron invocation. Network/database waiting is not CPU.
D1 Free allows five million rows read/day, 100,000 written/day, 5 GB total storage,
and 500 MB per database. Indexed changes and deletes add writes.
[Workers limits](https://developers.cloudflare.com/workers/platform/limits/),
[D1 pricing](https://developers.cloudflare.com/d1/platform/pricing/),
[D1 limits](https://developers.cloudflare.com/d1/platform/limits/)

At 03:35 UTC on September 14, account D1 analytics returned the following
September 13 totals, including fixture setup and restoration:

| Database | Rows read | Rows written | Retained size (bytes) |
| --- | --- | --- | --- |
| Scratch | 51,885 | 25,939 | 2,236,416 |
| Schema | 4,335 | 2,505 | 233,472 |
| Recovery | 9,296 | 6,154 | 471,040 |
| Total | 65,516 | 34,598 | 2,940,928 |

These totals remain below the experiment's 500,000-read/40,000-write ceilings.
No September 14 D1 activity was returned. Workers adaptive analytics returned
85 requests across the three Workers for the inspected interval; observability
usage returned 176 log events. These are separate provider analytics counts,
not interchangeable billing counters. No CPU-limit outcome was recorded in the
private suite, and the larger metric loads stayed cancelled.

The recovery checkpoint baseline was restored and the three benchmark summary
rows removed at 22:23:58 on September 13, using four writes. Readback matched the
baseline, summaries were empty, and foreign-key validation passed. Identified
history and incident fixtures remain; no bulk deletion or future cleanup is
scheduled.

The diagnostic schedule finished at 22:42, with no later invocation recorded.
On September 14 at 03:34:42, the runner was explicitly disabled before its cron
was removed; the benchmark was disabled at 03:34:43. Final versions were
`ef1a22f3-4714-48bf-86f5-95341e90951c` (runner) and
`33f44f4f-bda9-4625-b383-7c8e70cafb3b` (benchmark). Readback confirmed
`PROTOTYPE_ONLY=false` for both, and empty schedules plus disabled workers.dev
and preview URLs for all three Workers. The original staging Worker retained
its existing bindings and version. Nothing remains scheduled to collect data.

Before production adoption:

- Validate the complete bounded collector and all three summary windows at
  representative retained history; establish CPU headroom and combined account
  budgets, including retention, public cache misses, owner traffic, and sync.
- Measure repeated first-use/reused-isolate behavior without treating ordinal
  counters as proof of cold starts.
- Implement and test production JWKS rotation, malformed/ambiguous-token denial,
  exact owner authorization, mutation Origin/CSRF protection, and atomic audits.
- Use normal migration tracking and rehearse recovery against representative
  production-size synthetic data under a separately budgeted experiment.

Keep the provider exit gate open. Any revised provider, paid plan, or production
activation requires a separate decision and grant.

## Source verification

The scheduler regression covers timestamp jitter, delayed delivery, and invalid
timestamps rejected before fetch. Harness tests cover gates, bounded cases,
synthetic auth failures, expiry, schema batches, cache behavior, and finite runner
selection. After the final redirect fix, root lint, tests (45 operations
JavaScript, ten migration Python, and 62 frontend tests: 117 total), and the
production build passed on Node 26.5.0. CI uses the repository's pinned Node
22.22.3; these local checks do not claim that pinned runtime. Generated public
artifacts remained current. Exact source publication is recorded in the PR.
No public content, SEO, AI discovery, route, resume, analytics, or CSP surface
changes in this patch.

Sanitized API measurements, deployment readbacks, SQL and restore comparisons
were recorded in a temporary local staging evidence directory. That directory
was no longer available when publication resumed on September 19, so the raw
artifacts cannot be independently reread from disk. This tracked report preserves
the recorded observations and explicitly labels projections and unmeasured
conditions; the earlier measurements were not rerun.

A fresh API readback at 17:22:28 UTC on September 19 reconfirmed empty schedules
and disabled workers.dev/preview URLs for all three Workers, with both benchmark
and runner gates still false. This readback verifies the paused settings only;
the September 13 usage totals above remain the historical analytics snapshot.
