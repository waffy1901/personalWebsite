# Operations API v1 contract

Refs #229. Phase 1 design contract; these are not active endpoints.
The [architecture](operations-architecture.md) defines measurements and state.

## Public requests

The future API accepts HTTPS GET only:

| Path | Query | Maximum response |
| --- | --- | --- |
| `/v1/summary` | `service=portfolio`, optional `window=24h\|7d\|30d` | One service/summary, 128 KiB |
| `/v1/history` | Same query | 288 buckets, 128 KiB |
| `/v1/events` | Same query | 100 chronological incident/maintenance/publication events, 128 KiB |

`window` defaults to `24h`. Unknown, duplicated, empty, or unsupported parameters
are 400 errors. URLs, hosts, alternate paths/targets, arbitrary date ranges,
pagination offsets, owner fields, and write methods are not accepted. Use 405
with `Allow: GET` for unsupported methods, 404 for unknown paths, and 503 for
missing/unreadable required storage. Error bodies contain an allowlisted code,
never a provider/SQL exception. Apply fixed body/query length limits before
parsing. Rate limits and exact production origin are Phase 2 configuration.

`parsePublicRequest` and `publicWindowRange` in
[contracts.mjs](../operations/src/contracts.mjs) implement the shared query
boundary; the Worker prototype intentionally does not expose these endpoints.

For a successful summary, `buildPublicStatusEnvelope` serializes only:

```json
{
  "service": { "id": "portfolio" },
  "generatedAt": "2026-09-10T12:00:20.000Z",
  "status": {
    "state": "operational",
    "reason": "fresh_success",
    "lastObservationAt": "2026-09-10T12:00:00.125Z",
    "observationAgeMs": 19875,
    "latencyMs": 125.5,
    "slowThresholdMs": 2000,
    "hasGapWarning": false,
    "lastCollectorErrorAt": null
  },
  "history": {
    "window": "24h",
    "startAt": "2026-09-09T12:00:20.000Z",
    "endAt": "2026-09-10T12:00:20.000Z",
    "availability": 100,
    "availabilityNumerator": 288,
    "availabilityDenominator": 288,
    "coverage": 100,
    "coverageNumerator": 288,
    "coverageDenominator": 288,
    "missingPrimary": 0,
    "hasGaps": false,
    "lastMissingSlotAt": null
  }
}
```

Percentage fields are numbers or `null`. Count fields are integers. Latency may
be fractional and is `null` without a measurement. UTC timestamps never represent
the request receipt time unless named `generatedAt`. Storage materializes that
timestamp; serving/caching a summary must not refresh it or its observation times.
The API and client must recompute age/stale state from preserved timestamps and
show "Unknown" once age reaches 15 minutes, including cached responses.

Public summaries may be cached for at most 60 seconds, without stale-while-revalidate
extensions until stale-state rendering is verified. Errors and owner responses
use `no-store`. The eventual CORS allowlist contains only the portfolio's exact
approved origin; no credentials or owner responses pass through public CORS.

History buckets contain `startAt`, `endAt`, `successfulPrimary`, `failedPrimary`,
`completedPrimary`, `expectedPrimary`, `missingPrimary`, and `meanLatencyMs`/
`maxLatencyMs` (or null). Windows downsample to five-minute, 35-minute, and
150-minute buckets respectively, at most 288 each. Weighted aggregates retain
all sample/failure counts and gaps; never interpolate missing observations or
substitute retry latency. UI chart and table consume the same buckets.

Events contain public titles/messages, UTC timestamps, and one explicit kind:
`incident`, `maintenance`, or `publication`. Add `truncated: true` when the fixed
limit omits older events, plus `oldestReturnedAt`; do not imply a complete timeline.
Deployment data distinguishes `currentPublication` from `attempts`. A publication
contains the provider deployment ID, exact 40-character commit, verification
timestamp, optional validated GitHub workflow/release links, and independent
provider synchronization freshness. Never include provider credentials or raw
API payloads. A failed sync preserves the last verified publication.

## Owner requests (Phase 3)

The owner surface lives on a separate Access-protected origin/path. No route is
implemented or authorized by this document. Every endpoint requires Worker-side
validation of Access signature, issuer, audience, token lifetime, and exact owner
identity, including GET and denied/malformed requests. All mutation requests
require same-origin/CSRF validation and `application/json`, at most 8 KiB.

| Method/path | Allowed body or response |
| --- | --- |
| `GET /owner/v1/service` | Current configuration, enabled state and version |
| `PATCH /owner/v1/service` | Expected version, enabled boolean, slow threshold 1..10000 ms; fixed target/cadence/timeout |
| `POST /owner/v1/incidents` | Title 1..160 chars, plain-text message 1..4000 chars |
| `POST /owner/v1/incidents/:id/updates` | Expected version, plain-text message, state `investigating\|identified\|monitoring\|resolved` |
| `POST /owner/v1/maintenance` | Title, UTC start/end with end after start |
| `PATCH /owner/v1/maintenance/:id` | Expected version, title and/or UTC start/end |
| `GET /owner/v1/audit` | Latest 100 sanitized private audit entries; no credentials |

Unknown fields, invalid IDs, stale configuration versions, unsupported methods,
and invalid times fail before writes. Use 400 invalid request, 401 absent/invalid
authentication, 403 unauthorized owner or CSRF, 409 version conflict, 413 oversized
body, and 503 unavailable dependencies. Never return partial success. Changes
and audit records commit in one atomic D1 batch. Plain-text incident messages
must be escaped when rendered; no submitted HTML is executed. Owner identity is
private and is excluded from every public response. Idempotency and concurrency
fixtures are required before these management handlers can be activated.
