import assert from "node:assert/strict"
import test from "node:test"
import {
  BLOCKED_URL_PATTERNS,
  PROFILES,
  ROUTES,
  RUNS_PER_ROUTE_PROFILE,
  aggregateSuccessfulRuns,
  baselineValidationErrors,
  buildLighthouseConfig,
  criticalDependencyCaveats,
  measurementValidationErrors,
  previewTargetFromBaseUrl,
  provenanceValidationErrors,
  rawArtifactFileName,
  summarizeLhr,
  validateMeasurementPlan,
} from "./measure-route-performance.mjs"

function completeResult(overrides = {}) {
  const expectedFinalUrl = "http://127.0.0.1:4173/resume/"
  return {
    expectedFinalUrl,
    finalUrl: expectedFinalUrl,
    diagnostics: { runtimeError: null, runWarnings: [], auditErrors: {} },
    criticalDependencyEvidence: {
      auditId: "network-dependency-tree-insight",
      details: {
        type: "list",
        items: [{ value: { type: "network-tree", chains: { root: {} } } }],
      },
    },
    metrics: {
      lcpMs: 2500,
      fcpMs: 1200,
      tbtMs: 0,
      totalTransferredBytes: 100000,
      bytesByResourceType: { total: 100000, Script: 60000, Image: 40000 },
    },
    ...overrides,
  }
}

test("Issue #174 plan is the approved eight-route, two-profile, 80-run matrix", () => {
  const plan = validateMeasurementPlan()
  assert.equal(plan.plannedSuccessfulRuns, 80)
  assert.deepEqual(plan.routes, ROUTES)
  assert.ok(!ROUTES.includes("/"))
  assert.equal(plan.runs, RUNS_PER_ROUTE_PROFILE)
  assert.deepEqual(plan.profiles.map((profile) => profile.id), ["mobile", "desktop"])
})

test("Lighthouse profiles use simulated throttling and block analytics endpoints", () => {
  const mobile = buildLighthouseConfig(PROFILES[0]).settings
  const desktop = buildLighthouseConfig(PROFILES[1]).settings
  assert.equal(mobile.throttlingMethod, "simulate")
  assert.equal(mobile.screenEmulation.width, 390)
  assert.equal(mobile.screenEmulation.height, 844)
  assert.equal(mobile.throttling.cpuSlowdownMultiplier, 4)
  assert.equal(desktop.screenEmulation.width, 1440)
  assert.equal(desktop.screenEmulation.height, 1000)
  assert.equal(desktop.throttling.cpuSlowdownMultiplier, 1)
  assert.deepEqual(mobile.blockedUrlPatterns, BLOCKED_URL_PATTERNS)
  assert.ok(mobile.onlyAudits.includes("network-dependency-tree-insight"))
  assert.ok(!mobile.onlyAudits.includes("critical-request-chains"))
})

test("LHR summary and aggregation retain metrics, resource bytes, and critical-chain evidence", () => {
  const lhr = {
    finalUrl: "http://127.0.0.1:4173/resume/",
    fetchTime: "2026-08-22T00:00:00.000Z",
    lighthouseVersion: "12.8.2",
    userAgent: "Chrome/140",
    audits: {
      "largest-contentful-paint": { numericValue: 2500 },
      "first-contentful-paint": { numericValue: 1200 },
      "total-blocking-time": { numericValue: 75 },
      "total-byte-weight": { numericValue: 100000 },
      "resource-summary": { details: { items: [{ resourceType: "Script", transferSize: 60000 }, { resourceType: "Image", transferSize: 40000 }] } },
      "network-dependency-tree-insight": { score: 0.5, displayValue: "1.2 s", details: { type: "list", items: [{ value: { type: "network-tree", chains: { root: {} } } }] } },
    },
  }
  const result = summarizeLhr(lhr)
  assert.equal(result.metrics.lcpMs, 2500)
  assert.equal(result.metrics.bytesByResourceType.Script, 60000)
  assert.equal(result.criticalDependencyEvidence.auditId, "network-dependency-tree-insight")
  const aggregates = aggregateSuccessfulRuns([
    { status: "success", profile: PROFILES[0], route: ROUTES[0], rawArtifact: "a.json", result },
    { status: "success", profile: PROFILES[0], route: ROUTES[0], rawArtifact: "b.json", result: { ...result, metrics: { ...result.metrics, lcpMs: 3500 } } },
  ])
  assert.equal(aggregates[0].median.lcpMs, 3000)
  assert.equal(aggregates[0].median.bytesByResourceType.Image, 40000)
})

test("metric completeness rejects missing LCP or resource-summary totals and invalidates the baseline", () => {
  const validResult = completeResult()
  assert.deepEqual(measurementValidationErrors(validResult), [])
  assert.match(measurementValidationErrors({ ...validResult, metrics: { ...validResult.metrics, lcpMs: null } }).join(" "), /lcpMs/)
  assert.match(measurementValidationErrors({ ...validResult, metrics: { ...validResult.metrics, bytesByResourceType: { Script: 60000 } } }).join(" "), /total/)

  const plan = validateMeasurementPlan({ routes: ROUTES, profiles: PROFILES, runs: 5 })
  const records = []
  for (const profile of PROFILES) {
    for (const route of ROUTES) {
      for (let runNumber = 1; runNumber <= 5; runNumber += 1) {
        records.push({ profile, route, runNumber, status: "success", rawArtifact: `${profile.id}-${runNumber}.lhr.json`, result: validResult, attempts: [] })
      }
    }
  }
  assert.deepEqual(baselineValidationErrors(records, plan), [])
  records[0].result = { ...validResult, metrics: { ...validResult.metrics, tbtMs: null } }
  assert.match(baselineValidationErrors(records, plan).join(" "), /tbtMs/)
})

test("completeness rejects wrong navigation, Lighthouse diagnostics, and missing critical evidence", () => {
  const validResult = completeResult()
  assert.match(measurementValidationErrors({ ...validResult, finalUrl: "http://127.0.0.1:4173/contact/" }).join(" "), /finalUrl/)
  assert.match(measurementValidationErrors({ ...validResult, diagnostics: { ...validResult.diagnostics, runtimeError: { code: "ERRORED_DOCUMENT_REQUEST" } } }).join(" "), /runtimeError/)
  assert.match(measurementValidationErrors({ ...validResult, diagnostics: { ...validResult.diagnostics, runWarnings: ["warning"] } }).join(" "), /runWarnings/)
  assert.match(measurementValidationErrors({ ...validResult, diagnostics: { ...validResult.diagnostics, auditErrors: { "largest-contentful-paint": "missing" } } }).join(" "), /audit errors/)
  assert.match(measurementValidationErrors({ ...validResult, criticalDependencyEvidence: null }).join(" "), /critical dependency/)

  const plan = validateMeasurementPlan()
  const records = []
  for (const profile of PROFILES) {
    for (const route of ROUTES) {
      for (let runNumber = 1; runNumber <= RUNS_PER_ROUTE_PROFILE; runNumber += 1) {
        records.push({ profile, route, runNumber, status: "success", rawArtifact: `${profile.id}-${route}-${runNumber}.lhr.json`, result: validResult, attempts: [] })
      }
    }
  }
  records[0].rawArtifact = ""
  assert.match(baselineValidationErrors(records, plan).join(" "), /missing rawArtifact/)
})

test("critical dependency evidence requires the Lighthouse network-tree schema", () => {
  const validResult = completeResult()
  const withDetails = (details) => ({
    ...validResult,
    criticalDependencyEvidence: { auditId: "network-dependency-tree-insight", details },
  })
  assert.match(measurementValidationErrors(withDetails({ type: "list", items: [] })).join(" "), /items must be nonempty/)
  assert.match(measurementValidationErrors(withDetails({ type: "list", items: [{ value: { type: "text" } }] })).join(" "), /network-tree/)
  assert.match(measurementValidationErrors(withDetails({ type: "list", items: [{ value: { type: "network-tree" } }] })).join(" "), /chains must be an object/)
  assert.match(measurementValidationErrors(withDetails({ type: "list", items: [{ value: { type: "network-tree", chains: [] } }] })).join(" "), /chains must be an object/)
  assert.deepEqual(measurementValidationErrors(completeResult({
    criticalDependencyEvidence: { auditId: "critical-request-chains", details: { type: "criticalrequestchain", chains: { root: {} } } },
  })), [])
  assert.match(measurementValidationErrors(completeResult({
    criticalDependencyEvidence: { auditId: "critical-request-chains", details: { type: "list", chains: [] } },
  })).join(" "), /legacy critical-request-chains/)
})

test("empty critical dependency chains are structured caveats, not numeric metric failures", () => {
  const result = completeResult({
    criticalDependencyEvidence: {
      auditId: "network-dependency-tree-insight",
      details: { type: "list", items: [{ value: { type: "network-tree", chains: {} } }] },
    },
  })
  assert.deepEqual(measurementValidationErrors(result), [])
  assert.deepEqual(criticalDependencyCaveats([
    { status: "success", profile: PROFILES[0], route: "/contact/", runNumber: 1, rawArtifact: "raw/mobile/contact-run-1.lhr.json", result },
  ]), [{
    type: "empty-critical-dependency-chain",
    profile: "mobile",
    route: "/contact/",
    runNumbers: [1],
    rawArtifacts: ["raw/mobile/contact-run-1.lhr.json"],
  }])
})

test("preview ownership is restricted to the canonical localhost target", () => {
  assert.deepEqual(previewTargetFromBaseUrl("http://127.0.0.1:4173"), { host: "127.0.0.1", port: 4173 })
  assert.throws(() => previewTargetFromBaseUrl("http://localhost:4173"), /must use/)
  assert.throws(() => previewTargetFromBaseUrl("http://127.0.0.1:4174"), /must use/)
})

test("measurement provenance requires unchanged HEAD", () => {
  const valid = {
    startSha: "abc",
    completionSha: "abc",
    startWorktreeFingerprint: "fingerprint",
    completionWorktreeFingerprint: "fingerprint",
  }
  assert.deepEqual(provenanceValidationErrors(valid), [])
  assert.match(provenanceValidationErrors({ ...valid, completionSha: "def" }).join(" "), /HEAD changed/)
  assert.match(provenanceValidationErrors({ ...valid, startWorktreeFingerprint: "" }).join(" "), /start worktree fingerprint/)
  assert.match(provenanceValidationErrors({ ...valid, completionWorktreeFingerprint: "changed" }).join(" "), /worktree changed/)
})

test("raw Lighthouse artifacts are immutable per retry attempt", () => {
  assert.equal(rawArtifactFileName("/contact/", 1, 1), "contact-run-1-attempt-1.lhr.json")
  assert.notEqual(rawArtifactFileName("/contact/", 1, 1), rawArtifactFileName("/contact/", 1, 2))
})
