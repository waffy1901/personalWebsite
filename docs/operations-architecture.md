# Operations dashboard: architecture and Phase 1 contracts

Refs #229. Decision version: `phase1-v1`, 2026-09-10.

Phase 1 provides a local backend foundation. Cloudflare Workers, D1, and Access
are the design target from the execution plan; account provisioning, production
adoption, deployment, and paid plans remain unapproved. The $0/month assumption
is conditional on the staging measurements below. No dashboard route, real
collector, owner endpoint, or production resources are activated by this change.

## Architecture decision

Keep the public React page on Netlify. Place collection, storage, the public
read API, and the private owner area on a separate Cloudflare Worker/D1 service.
Collection can continue during a Netlify outage; the public portfolio route
itself still depends on Netlify. Do not migrate the portfolio or duplicate the
health checks in #223, performance reports in #222, or resolver repair in #228.

Use Web APIs and plain ES modules for the foundation. There are no new npm
dependencies. Local SQL checks use Python 3.11's SQLite with foreign keys on;
they do not prove D1 deployment compatibility. The existing frontend ESLint
installation also lints the backend. Root lint/test commands and Main PR CI
include the backend. The bundler only builds the existing frontend.

The Worker prototype is isolated in [operations/prototype](../operations/prototype/).
Its configuration has no routes or cron, disables workers.dev and preview URLs,
and requires explicit configuration before scheduled work can run. HTTP requests
return a noncached 503 by default. Explicit prototype mode enables only a
read-only `/prototype/auth` workload to measure valid and denied JWT requests;
it provides no owner actions. Its scratch migration is separate from the real
schema. Synthetic fixtures must never be inserted into operational storage.

## Measurement and status contract

Resolve `portfolio` to the exact server-side target `https://waffy.dev/`. A probe
is an HTTPS GET with a ten-second timeout. Do not follow redirects, accept user
URLs, read response bodies, submit forms, or execute browser JavaScript. Measure
elapsed monotonic time until response headers arrive, in milliseconds; label it
**synthetic HTTP response time**, not rendering speed, user latency, or LCP.
HTTP 2xx succeeds. Redirects, other final HTTP errors, timeouts, and transport
errors fail. A slow successful response still counts as available.

Schedule every five minutes on the UTC epoch grid. Persist scheduled time,
observed time, outcome, HTTP status when available, duration, and immutable
configuration version. One optional confirmation retry may diagnose a failed
primary. It cannot replace the primary or affect availability or state streaks.
Collector failures are separate run records, never failed website observations.

| State | Rule |
| --- | --- |
| Operational | Fresh success below the configured slow threshold |
| Degraded | Slow response, first consecutive failed primary, or one recovery success |
| Down | Two failed consecutive scheduled primary probes |
| Unknown | No current monitoring data, disabled monitoring, current collector error, or observation age at least 15 minutes |

The initial slow threshold is 2,000 ms; equality is slow. Recovery from an
established outage requires two consecutive successful scheduled primaries.
Missing slots break consecutive evidence without erasing an unresolved outage;
disable/re-enable starts a new monitoring period. Once recovery is confirmed,
a subsequent isolated failure is a new episode. Incidents and maintenance
annotate data without changing outcomes, denominators, or state.

Metric functions accept validated, bounded inputs; adapters must map SQL outcome
codes to `success`/`failure`, supply the current configuration's `slow_ms`, and
load the necessary prior state. `calculateStatus` accepts and returns a private
`stateCheckpoint`: active period start, last processed slot, unresolved-down flag,
failure streak (capped at two), and recovery streak (zero or one). Ignore an old
period's checkpoint on re-enable. Store it atomically with collection in
`service_state_checkpoints` before raw history expires; an unresolved outage must
not become an invented healthy state after retention. Checkpoint persistence and
ordered processing of completed slots are Phase 2 implementation work.

## Availability and coverage

Selectable windows are 24 hours, seven days, and thirty days. Window and enabled
period boundaries are half-open `[start, end)`. Count only UTC grid slots in an
enabled period. Disabled time and time before monitoring started are excluded.
A slot becomes expected at scheduled time plus 20 seconds, allowing the bounded
primary and confirmation workload to finish. Even an early completion in the
current slot enters the denominator only at that deadline. Status can use that
completed observation immediately.

- Observed availability = successful primaries / completed primaries.
- Coverage = completed primaries / expected enabled scheduled slots.
- Missing observations = expected slots - completed primaries.

Return the raw numerator and denominator alongside every percentage. Empty
denominators produce `null`, never 0% or 100%. A complete-success subset with gaps
may mathematically be 100% observed availability, but must be shown with coverage,
missing count, and a gap warning; it must never be labeled unqualified uptime.
Show the observation timestamp and missing-slot warning before the stale limit.
Before monitoring began, display "No monitoring data."

## Storage and migrations

[0001_operations.sql](../operations/migrations/0001_operations.sql) is an additive,
unseeded migration. Apply numbered migrations once using D1's migration ledger.
Never edit a deployed migration or run this migration against the prototype DB.
Store UTC instants as integer epoch milliseconds; serialize public dates as ISO
8601 UTC. Foreign keys and checks enforce configuration ownership, unique primary
slots, one confirmation, valid outcomes, and nonoverlapping enabled periods.

| Tables | Responsibility |
| --- | --- |
| `services`, `service_configs`, `monitoring_periods` | Allowlisted identity, immutable configuration versions, historical enabled intervals |
| `collector_runs` | Started/completed/failed runs, including runs without observations |
| `service_state_checkpoints` | Private per-period outage/recovery state surviving raw retention |
| `observations`, `confirmation_observations` | Immutable primary results and separate optional retries |
| `deployments`, `deployment_publications`, `provider_sync_state` | Attempts, verified publication/rollback events, current reference and synchronization freshness |
| `incidents`, `incident_updates`, `maintenance_windows` | Public operational annotations |
| `owner_audit_events` | Private actor/action/request audit records |
| `public_summaries` | Three bounded materialized summaries per service, each at most 128 KiB |

Phase 2 must claim/deduplicate work before probing, persist the primary as soon as
it completes, and finish the collector run separately. Storage failure must
leave the run incomplete/failed, with no fabricated sample. Recovery must notice
overdue started runs. Phase 3 must use atomic batches for mutations and audit
events, with optimistic configuration/incident/maintenance version checks; an
audit failure rolls back the mutation. Reject historical period edits and
arbitrary target keys.

Use the currently published Netlify deployment reference and verify ready state
and its exact commit. Record a publication event only when that reference changes;
update synchronization freshness separately. A newer pending/failed/skipped
attempt, ready unpublished build, latest main, green workflow, or build timestamp
cannot replace it. On rollback record a new publication pointing to the old
deployment. On sync failure retain the verified reference and expose staleness.
Never turn a provider-sync failure into a website probe failure.

## Retention and recovery

[retention.mjs](../operations/src/retention.mjs) defines executable, parameterized
cleanup statements. Phase 2 runs them on a schedule independent of page visits.
Each statement deletes at most 100 rows; there are nine statements and no cascade
deletes. Report cleanup backlog/failures and resume in later invocations instead
of draining an arbitrary backlog in one Worker invocation.

- Raw primary/confirmation observations and collector runs: 30 days.
- Resolved incidents and their updates: 365 days after resolution. Keep open
  incidents regardless of age. Remove child updates before the incident.
- Deployment events, ended maintenance, and owner audit records: 365 days.
  Keep the current publication and referenced deployment even when older.
- Current provider and service-state checkpoints, three summary rows, and required service/configuration/
  period metadata: retain while the service exists. Phase 3 bounds configuration
  changes; never delete metadata needed to explain retained measurements.

The latest public summary must be regenerated or marked stale after collection
or cleanup. A D1 recovery window is not record retention: the free plan provides
seven days of Time Travel recovery. Before activation, document a separate
export/restore procedure, rehearse it in staging, and preserve history during
application rollback. Use backward-compatible schema changes and separate staging
and production databases. [D1 recovery](https://developers.cloudflare.com/d1/reference/time-travel/)

## Access and public API boundary

[The API contract](operations-api.md) fixes request/response bounds before the UI.
Public access is read-only. Build responses from explicit public fields; never
serialize SQL rows directly. Provider credentials, raw transport errors, owner
subjects, audit records, private configuration, response bodies, and tokens stay
server-side. Do not add frontend credentials or a production CSP origin yet.

Phase 3 uses Cloudflare Access plus Worker-side signature/issuer/audience/expiry
and exact owner-subject authorization on every owner request. Validate JWKS from
the configured issuer only, handle key rotation, deny malformed or ambiguous
tokens, check mutation Origin and CSRF protection, and set `Cache-Control:
no-store`. Public API access never grants write authority. The prototype's
fixture JWT workload is not production authentication and must not be reused as
such. [Access validation](https://developers.cloudflare.com/cloudflare-one/access-controls/applications/http-apps/authorization-cookie/validating-json/)

## Cost assumption and required staging evidence

Provider docs rechecked 2026-09-11 UTC: Workers Free allows 100,000 requests/day;
free HTTP and cron invocations each have 10 ms CPU. Network/database waiting is
not CPU time. Cold key import and authentication must be measured, not inferred
from local elapsed time. [Pricing](https://developers.cloudflare.com/workers/platform/pricing/),
[limits](https://developers.cloudflare.com/workers/platform/limits/)

D1 Free includes five million rows read/day, 100,000 rows written/day, and 5 GB
total storage, with a 500 MB per-database limit. Index updates and deletes add
writes; returned rows are not rows scanned. One service schedules 288 primary
probes/day (8,640 in 30 days), plus at most 288 retries/day. Materialize summaries
after collection: scanning 8,640 raw rows on each public request would exhaust the
daily read allowance after roughly 578 requests. The $0 target also depends on
other account usage, traffic, retention, and owner authentication eligibility.
[D1 pricing](https://developers.cloudflare.com/d1/platform/pricing/),
[D1 limits](https://developers.cloudflare.com/d1/platform/limits/)

Before Phase 1's provider exit gate can pass, obtain approval for an isolated
Cloudflare staging target and record:

1. Account plan/Access eligibility, exact reviewed source, compatibility date,
   scratch database ID, deployed Worker version, and actual five-minute schedule.
2. Remote application of the production schema to an empty separate validation
   database, constraints, disk persistence, and bounded cleanup under D1.
3. Worker CPU p50/p95/max for cold and warm collector and authenticated request
   paths, including timeout/retry, key lookup/import/rotation and denied requests.
   Reject the free-tier assumption if invocations consistently exceed 10 ms or
   hit limits. Do not silently upgrade the account.
4. D1 `rows_read`/`rows_written`, index/storage overhead at 30-day cardinality,
   cache hits/misses, owner traffic, and conservative traffic projections. The
   scratch prototype is a baseline, not proof of the full production schema's cost.
5. Scheduler timing and persisted real observations across a restart, token
   validation behavior, recovery rehearsal, and evidence timestamps.

Local `npm run prototype:operations` uses a synthetic response and generated key:
it sends zero network requests and reports Cloudflare CPU/D1 measurements as
`null`. Staging measurements and provider selection remain pending; no local
timing is presented as provider feasibility evidence.

## Phase boundaries and verification

Phase 2 implements real scheduled collection, summaries/history downsampling,
deduplication, cleanup execution, deployment synchronization, and recovery state.
Phase 3 implements Access/owner flows and audited writes. Phase 4 implements the
React route, accessible chart/table, navigation and metadata/CSP integration.

Run from the root: `npm run check:operations`, `npm run prototype:operations`,
`npm run lint`, `npm test`, `npm run build`, `npm run generate:public -- --check`,
and change-impact/diff checks. Local tests cover deterministic metrics, contract
validation, prototype boundaries, migration constraints and persistence, and
actual retention SQL. They do not prove Cloudflare runtime behavior, real cron
delivery, production authentication, or deployed frontend behavior.

Semantic assessment: provisionally `none` for Phase 1; it adds an inactive
foundation and CI without changing the deployed portfolio product contract.
Keep app version `0.2.3`. Publication, independent PR review, merge, deployment,
and issue closure remain separate phases under repository policy.
