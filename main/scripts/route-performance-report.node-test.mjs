import assert from "node:assert/strict"
import { spawn } from "node:child_process"
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import test from "node:test"
import { fileURLToPath } from "node:url"
import { routeMetadata } from "../src/data/seo.js"
import {
  PROFILES,
  ROUTES as HISTORICAL_ROUTES,
  buildLighthouseConfig,
  summarizeLhr,
  validateMeasurementPlan,
} from "./measure-route-performance.mjs"
import { REPORT_BLOCKED_URL_PATTERNS } from "./measure-route-performance-report.mjs"
import { acquireCandidates } from "./acquire-route-performance-baselines.mjs"
import {
  REPORT_METHOD_VERSION,
  REPORT_SCHEMA_VERSION,
  REPORT_WORKFLOW_PATH,
  aggregateValidationErrors,
  aggregateRecords,
  buildArtifactManifest,
  compareAggregates,
  compatibilityFingerprint,
  createReportPlan,
  discoverCanonicalRoutes,
  executeMeasurementMatrix,
  matrixValidationErrors,
  normalizeBaselineCandidates,
  selectCompatibleBaseline,
  sha256File,
  validateArtifactDirectory,
} from "./route-performance-report-lib.mjs"

const BASE_URL = "http://127.0.0.1:4173/"
const testScriptPath = fileURLToPath(import.meta.url)
const repoRoot = path.resolve(path.dirname(testScriptPath), "../..")

async function runCommand(command, args, options) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { ...options, stdio: ["ignore", "pipe", "pipe"] })
    let output = ""
    child.stdout.on("data", (chunk) => { output += chunk })
    child.stderr.on("data", (chunk) => { output += chunk })
    child.once("error", reject)
    child.once("exit", (code) => resolve({ code, output }))
  })
}

function reportConfig() {
  return {
    throttling: {
      rttMs: 150,
      throughputKbps: 1638,
      requestLatencyMs: 150,
      downloadThroughputKbps: 1638,
      uploadThroughputKbps: 750,
    },
    lighthouse: Object.fromEntries(PROFILES.map((profile) => {
      const config = buildLighthouseConfig(profile)
      config.settings.blockedUrlPatterns = REPORT_BLOCKED_URL_PATTERNS
      return [profile.id, config]
    })),
    coldCachePolicy: "fresh browser",
    telemetryPolicy: { externalNetwork: "blocked" },
  }
}

function lhrFor({ route = "/", profile = PROFILES[0], value = 1000, lighthouseVersion = "13.5.0" } = {}) {
  const settings = structuredClone(reportConfig().lighthouse[profile.id].settings)
  return {
    finalUrl: new URL(route, BASE_URL).href,
    fetchTime: "2026-09-30T12:00:00.000Z",
    lighthouseVersion,
    userAgent: "Mozilla/5.0 Chrome/136.0.0.0 Mobile Safari/537.36",
    environment: { hostUserAgent: "Mozilla/5.0 HeadlessChrome/154.0.0.0 Safari/537.36" },
    configSettings: settings,
    runWarnings: [],
    audits: {
      "largest-contentful-paint": { numericValue: value },
      "first-contentful-paint": { numericValue: value / 2 },
      "cumulative-layout-shift": { numericValue: value / 10000 },
      "total-blocking-time": { numericValue: value / 10 },
      "total-byte-weight": { numericValue: value * 10 },
      "resource-summary": { details: { items: [{ resourceType: "total", transferSize: value * 10 }] } },
      "network-dependency-tree-insight": {
        score: 1,
        details: { items: [{ value: { type: "network-tree", chains: {} } }] },
      },
    },
  }
}

function summarized(lhr, route) {
  return {
    ...summarizeLhr(lhr),
    expectedFinalUrl: new URL(route, BASE_URL).href,
    browser: {
      product: "Chrome/154.0.8037.58",
      protocolUserAgent: "Mozilla/5.0 HeadlessChrome/154.0.0.0 Safari/537.36",
    },
    diagnostics: { runtimeError: null, runWarnings: [], auditErrors: {} },
  }
}

async function makeArtifact({
  runId = "100",
  runAttempt = "1",
  commitSha = "a".repeat(40),
  completedAt = "2026-09-29T12:00:00.000Z",
  lighthouseVersion = "13.5.0",
} = {}) {
  const dir = await mkdtemp(path.join(os.tmpdir(), "route-report-test-"))
  const profile = PROFILES[0]
  const route = "/"
  const raw = lhrFor({ route, profile, lighthouseVersion })
  const rawArtifact = "raw/mobile/home-sample-1-attempt-1.lhr.json"
  await mkdir(path.join(dir, "raw", "mobile"), { recursive: true })
  await writeFile(path.join(dir, rawArtifact), JSON.stringify(raw, null, 2))
  const plan = {
    routes: [route],
    profiles: [profile],
    samplesPerGroup: 1,
    maxRetriesPerSample: 1,
    primarySamples: 1,
    maximumAttempts: 2,
  }
  const record = {
    sequence: 1,
    profile,
    route,
    sample: 1,
    status: "success",
    attempts: [{ attempt: 1, status: "success" }],
    rawArtifact,
    rawSha256: await sha256File(path.join(dir, rawArtifact)),
    result: summarized(raw, route),
  }
  const artifactName = `route-performance-v1-${runId}-${runAttempt}`
  const summary = {
    schemaVersion: REPORT_SCHEMA_VERSION,
    methodVersion: REPORT_METHOD_VERSION,
    run: { githubRunId: runId, githubRunAttempt: runAttempt, artifactName, workflowPath: REPORT_WORKFLOW_PATH },
    status: "complete",
    environment: {
      commitSha,
      nodeVersion: "v22.22.3",
      chromeVersion: "Google Chrome 154.0.8037.58",
      lighthouseVersion,
      platform: "linux",
      architecture: "x64",
      runner: { ci: true, name: "Hosted Agent 1", os: "Linux", architecture: "X64", image: "ubuntu24" },
      baseUrl: BASE_URL,
    },
    provenance: {
      start: { sha: commitSha, worktree: { sha256: "b".repeat(64) } },
      completion: { sha: commitSha, worktree: { sha256: "b".repeat(64) } },
    },
    timestamps: { startedAt: "2026-09-29T11:55:00.000Z", completedAt },
    plan,
    config: reportConfig(),
    records: [record],
    aggregates: aggregateRecords([record], plan),
  }
  summary.configFingerprint = compatibilityFingerprint(summary)
  await writeFile(path.join(dir, "summary.json"), JSON.stringify(summary, null, 2))
  await writeFile(path.join(dir, "report.md"), "# fixture\n")
  await writeFile(path.join(dir, "manifest.json"), JSON.stringify(await buildArtifactManifest(dir), null, 2))
  return { dir, summary, rawArtifact, raw, artifactName, runId, runAttempt, commitSha, completedAt }
}

async function rewriteArtifact(fixture, raw) {
  await writeFile(path.join(fixture.dir, fixture.rawArtifact), JSON.stringify(raw, null, 2))
  await writeFile(path.join(fixture.dir, "manifest.json"), JSON.stringify(await buildArtifactManifest(fixture.dir), null, 2))
}

async function rewriteSummary(fixture) {
  await writeFile(path.join(fixture.dir, "summary.json"), JSON.stringify(fixture.summary, null, 2))
  await writeFile(path.join(fixture.dir, "manifest.json"), JSON.stringify(await buildArtifactManifest(fixture.dir), null, 2))
}

function candidateFor(fixture, overrides = {}) {
  return {
    status: "downloaded",
    runId: fixture.runId,
    runAttempt: fixture.runAttempt,
    artifactName: fixture.artifactName,
    artifactDir: fixture.dir,
    workflowPath: REPORT_WORKFLOW_PATH,
    commitSha: fixture.commitSha,
    completedAt: fixture.completedAt,
    ...overrides,
  }
}

test("discovers every canonical route while preserving Issue #174's fixed 80-run plan", () => {
  const routes = discoverCanonicalRoutes(routeMetadata)
  assert.deepEqual(routes, routeMetadata.map((entry) => entry.canonicalPath))
  assert.equal(routes.length, 9)
  const reportPlan = createReportPlan({ routes, profiles: PROFILES })
  assert.equal(reportPlan.primarySamples, 90)
  assert.equal(reportPlan.maximumAttempts, 180)
  assert.equal(HISTORICAL_ROUTES.length, 8)
  assert.equal(validateMeasurementPlan().plannedSuccessfulRuns, 80)
  const addedRoute = "/case-studies/new-platform/"
  const expanded = discoverCanonicalRoutes([...routeMetadata, { canonicalPath: addedRoute }])
  assert.equal(expanded.length, routeMetadata.length + 1)
  assert.equal(expanded.at(-1), addedRoute)
})

test("root npm invocation resolves a relative output directory from the repository root", async (t) => {
  const tempRoot = await mkdtemp(path.join(os.tmpdir(), "route-report-root-output-"))
  t.after(() => rm(tempRoot, { recursive: true, force: true }))
  const outputDir = path.join(tempRoot, "checkpoint")
  const relativeOutputDir = path.relative(repoRoot, outputDir)
  const result = await runCommand("npm", [
    "run",
    "performance:report",
    "--",
    "--measurement-budget-ms",
    "1",
    "--output-dir",
    relativeOutputDir,
  ], {
    cwd: repoRoot,
    env: { ...process.env, ROUTE_PERFORMANCE_TEST_FAIL: "1" },
  })
  assert.notEqual(result.code, 0, result.output)
  const checkpoint = JSON.parse(await readFile(path.join(outputDir, "summary.json"), "utf8"))
  assert.equal(checkpoint.limits.totalMeasurementBudgetMs, 1)
  assert.equal(checkpoint.status, "incomplete")
})

test("computes medians and compatible baseline deltas", () => {
  const plan = { routes: ["/"], profiles: [PROFILES[0]], samplesPerGroup: 5 }
  const records = [500, 100, 400, 300, 200].map((value, index) => ({
    status: "success", profile: PROFILES[0], route: "/", sample: index + 1,
    result: { metrics: { lcpMs: value, fcpMs: value, cls: value / 10000, tbtMs: value, totalTransferredBytes: value } },
    rawArtifact: `raw/${index}.json`,
  }))
  const current = { aggregates: aggregateRecords(records, plan) }
  assert.equal(current.aggregates[0].median.lcpMs, 300)
  assert.equal(current.aggregates[0].median.cls, 0.03)
  const baseline = structuredClone(current)
  baseline.aggregates[0].median.lcpMs = 250
  baseline.aggregates[0].median.cls = 0.02
  assert.equal(compareAggregates(current, baseline)[0].delta.lcpMs, 50)
  assert.ok(Math.abs(compareAggregates(current, baseline)[0].delta.cls - 0.01) < Number.EPSILON)
  assert.deepEqual(compareAggregates(current, { aggregates: [] })[0].delta, {
    lcpMs: null,
    fcpMs: null,
    cls: null,
    tbtMs: null,
    totalTransferredBytes: null,
  })
})

test("a timed-out attempt finishes cleanup before its one retry starts", async () => {
  const events = []
  const plan = { routes: ["/"], profiles: [{ id: "mobile" }], samplesPerGroup: 1, maxRetriesPerSample: 1 }
  const records = await executeMeasurementMatrix({
    plan,
    attemptTimeoutMs: 5,
    budgetMs: 200,
    measureAttempt: async ({ attempt, signal }) => {
      events.push(`start-${attempt}`)
      if (attempt === 1) {
        await new Promise((resolve) => signal.addEventListener("abort", () => setTimeout(resolve, 15), { once: true }))
        events.push("cleanup-1")
        throw signal.reason
      }
      events.push("success-2")
      return { result: { metrics: {} } }
    },
  })
  assert.equal(records[0].status, "success")
  assert.deepEqual(events, ["start-1", "cleanup-1", "start-2", "success-2"])
})

test("an exhausted measurement budget does not launch a retry", async () => {
  let attempts = 0
  let clockMs = 0
  const plan = { routes: ["/"], profiles: [{ id: "mobile" }], samplesPerGroup: 1, maxRetriesPerSample: 1 }
  const records = await executeMeasurementMatrix({
    plan,
    attemptTimeoutMs: 5,
    budgetMs: 5,
    startedAtMs: 0,
    now: () => clockMs,
    measureAttempt: async ({ signal }) => {
      attempts += 1
      await new Promise((resolve) => signal.addEventListener("abort", resolve, { once: true }))
      clockMs = 5
      throw signal.reason
    },
  })
  assert.equal(attempts, 1)
  assert.equal(records[0].attempts.length, 1)
  assert.equal(records[0].attempts[0].code, "ATTEMPT_TIMEOUT")
})

test("an uncooperative timed-out attempt stops after bounded cleanup grace", async () => {
  let attempts = 0
  const plan = { routes: ["/"], profiles: [{ id: "mobile" }], samplesPerGroup: 1, maxRetriesPerSample: 1 }
  await assert.rejects(
    executeMeasurementMatrix({
      plan,
      attemptTimeoutMs: 5,
      cleanupGraceMs: 5,
      budgetMs: 200,
      measureAttempt: async () => {
        attempts += 1
        await new Promise(() => {})
      },
    }),
    (error) => {
      assert.equal(error.code, "ATTEMPT_CLEANUP_TIMEOUT")
      assert.equal(error.records.length, 1)
      assert.equal(error.records[0].attempts[0].code, "ATTEMPT_CLEANUP_TIMEOUT")
      return true
    }
  )
  assert.equal(attempts, 1)
})

test("matrix and aggregate validation reject incomplete, duplicate, invalid, and stale data", async (t) => {
  const fixture = await makeArtifact()
  t.after(() => rm(fixture.dir, { recursive: true, force: true }))
  const base = fixture.summary

  const missing = structuredClone(base)
  missing.records = []
  assert.match(matrixValidationErrors(missing).join("\n"), /missing sample/)

  const duplicate = structuredClone(base)
  duplicate.records.push(structuredClone(duplicate.records[0]))
  assert.match(matrixValidationErrors(duplicate).join("\n"), /duplicate sample/)

  const nonfinite = structuredClone(base)
  nonfinite.records[0].result.metrics.lcpMs = Number.NaN
  assert.match(matrixValidationErrors(nonfinite).join("\n"), /invalid lcpMs/)

  const missingCls = structuredClone(base)
  delete missingCls.records[0].result.metrics.cls
  assert.match(matrixValidationErrors(missingCls).join("\n"), /invalid cls/)

  const negativeCls = structuredClone(base)
  negativeCls.records[0].result.metrics.cls = -0.01
  assert.match(matrixValidationErrors(negativeCls).join("\n"), /invalid cls/)

  const wrongUrl = structuredClone(base)
  wrongUrl.records[0].result.finalUrl = `${BASE_URL}wrong/`
  assert.match(matrixValidationErrors(wrongUrl).join("\n"), /wrong final URL/)

  const unsafePath = structuredClone(base)
  unsafePath.records[0].rawArtifact = "../outside.json"
  assert.match(matrixValidationErrors(unsafePath).join("\n"), /unsafe rawArtifact path/)

  const staleAggregate = structuredClone(base)
  staleAggregate.aggregates[0].median.lcpMs += 1
  assert.match(aggregateValidationErrors(staleAggregate).join("\n"), /aggregates are stale/)
})

test("baseline status distinguishes first-run, unavailable, missing, and expired", async () => {
  const current = { run: {}, environment: {}, plan: {}, config: {} }
  assert.equal((await selectCompatibleBaseline({ currentSummary: current, candidates: [] })).status, "first-run")
  assert.equal((await selectCompatibleBaseline({ currentSummary: current, candidates: [{ status: "unavailable" }] })).status, "unavailable")
  assert.equal((await selectCompatibleBaseline({ currentSummary: current, candidates: [{ status: "missing" }] })).status, "missing")
  assert.equal((await selectCompatibleBaseline({ currentSummary: current, candidates: [{ status: "expired" }] })).status, "expired")
})

test("malformed baseline candidate collections remain unavailable evidence", async () => {
  const normalized = normalizeBaselineCandidates({ candidates: {} })
  assert.equal(normalized.length, 1)
  assert.equal(normalized[0].status, "unavailable")
  assert.match(normalized[0].acquisitionError, /candidates array/)

  const current = { run: {}, environment: {}, plan: {}, config: {} }
  const malformedCollection = await selectCompatibleBaseline({ currentSummary: current, candidates: {} })
  assert.equal(malformedCollection.status, "unavailable")
  assert.equal(malformedCollection.selected, null)
  assert.equal(malformedCollection.skipped[0].reason, "malformed-candidate-collection")

  const malformedEntry = await selectCompatibleBaseline({ currentSummary: current, candidates: [null] })
  assert.equal(malformedEntry.status, "corrupt")
  assert.equal(malformedEntry.selected, null)
  assert.equal(malformedEntry.skipped[0].reason, "malformed-candidate-entry")
})

test("baseline selection skips corrupt and provenance-mismatched candidates but preserves their reasons", async (t) => {
  const good = await makeArtifact({ runId: "100", completedAt: "2026-09-28T12:00:00.000Z" })
  const bad = await makeArtifact({ runId: "101", completedAt: "2026-09-29T12:00:00.000Z" })
  t.after(() => Promise.all([rm(good.dir, { recursive: true, force: true }), rm(bad.dir, { recursive: true, force: true })]))
  const tampered = structuredClone(bad.raw)
  tampered.audits["largest-contentful-paint"].numericValue += 1
  await rewriteArtifact(bad, tampered)
  const current = structuredClone(good.summary)
  current.run.githubRunId = "current"
  const selected = await selectCompatibleBaseline({ currentSummary: current, candidates: [candidateFor(bad), candidateFor(good)], now: new Date("2026-09-30T00:00:00Z") })
  assert.equal(selected.status, "selected")
  assert.equal(selected.selected.runId, "100")
  assert.equal(selected.skipped[0].reason, "corrupt-or-incomplete")

  const mismatch = await selectCompatibleBaseline({ currentSummary: current, candidates: [candidateFor(good, { commitSha: "c".repeat(40) })], now: new Date("2026-09-30T00:00:00Z") })
  assert.equal(mismatch.status, "corrupt")
  assert.equal(mismatch.skipped[0].reason, "candidate-provenance-mismatch")

  const workflowMismatch = await selectCompatibleBaseline({ currentSummary: current, candidates: [candidateFor(good, { workflowPath: ".github/workflows/other.yml" })], now: new Date("2026-09-30T00:00:00Z") })
  assert.equal(workflowMismatch.status, "corrupt")
  assert.deepEqual(workflowMismatch.skipped[0].fields, ["workflow path"])
})

test("historical artifacts without CLS cannot become complete comparable baselines", async (t) => {
  const currentFixture = await makeArtifact({ runId: "current" })
  const historicalFixture = await makeArtifact({ runId: "99" })
  t.after(() => Promise.all([
    rm(currentFixture.dir, { recursive: true, force: true }),
    rm(historicalFixture.dir, { recursive: true, force: true }),
  ]))

  delete historicalFixture.summary.records[0].result.metrics.cls
  delete historicalFixture.summary.aggregates[0].median.cls
  await rewriteSummary(historicalFixture)

  const current = structuredClone(currentFixture.summary)
  const selected = await selectCompatibleBaseline({
    currentSummary: current,
    candidates: [candidateFor(historicalFixture)],
    now: new Date("2026-09-30T00:00:00Z"),
  })

  assert.equal(selected.status, "corrupt")
  assert.equal(selected.selected, null)
  assert.equal(selected.skipped[0].reason, "corrupt-or-incomplete")
  assert.match(selected.skipped[0].errors.join("\n"), /invalid cls/)
})

test("baseline selection skips a null-record artifact and malformed entry before a compatible fallback", async (t) => {
  const good = await makeArtifact({ runId: "100", completedAt: "2026-09-28T12:00:00.000Z" })
  const corrupt = await makeArtifact({ runId: "101", completedAt: "2026-09-29T12:00:00.000Z" })
  t.after(() => Promise.all([rm(good.dir, { recursive: true, force: true }), rm(corrupt.dir, { recursive: true, force: true })]))
  corrupt.summary.records = [null]
  await rewriteSummary(corrupt)

  const current = structuredClone(good.summary)
  current.run.githubRunId = "current"
  const selected = await selectCompatibleBaseline({
    currentSummary: current,
    candidates: [null, candidateFor(corrupt), candidateFor(good)],
    now: new Date("2026-09-30T00:00:00Z"),
  })
  assert.equal(selected.status, "selected")
  assert.equal(selected.selected.runId, "100")
  assert.deepEqual(selected.skipped.map(({ reason }) => reason), ["malformed-candidate-entry", "corrupt-or-incomplete"])
  assert.match(selected.skipped[1].errors.join("\n"), /record entries must be objects/)
})

test("baseline compatibility ignores volatile runner names but rejects tool drift", async (t) => {
  const fixture = await makeArtifact()
  t.after(() => rm(fixture.dir, { recursive: true, force: true }))
  const current = structuredClone(fixture.summary)
  current.run.githubRunId = "current"
  current.environment.runner.name = "Hosted Agent 99"
  current.configFingerprint = compatibilityFingerprint(current)
  assert.equal((await selectCompatibleBaseline({ currentSummary: current, candidates: [candidateFor(fixture)], now: new Date("2026-09-30T00:00:00Z") })).status, "selected")
  current.environment.lighthouseVersion = "13.6.0"
  current.configFingerprint = compatibilityFingerprint(current)
  assert.equal((await selectCompatibleBaseline({ currentSummary: current, candidates: [candidateFor(fixture)], now: new Date("2026-09-30T00:00:00Z") })).status, "incompatible")
})

test("artifact validation recomputes raw metrics, diagnostics, and profile configuration", async (t) => {
  const fixture = await makeArtifact()
  t.after(() => rm(fixture.dir, { recursive: true, force: true }))
  const initialValidation = await validateArtifactDirectory(fixture.dir)
  assert.equal(initialValidation.valid, true, initialValidation.errors.join("\n"))

  const metricTamper = structuredClone(fixture.raw)
  metricTamper.audits["largest-contentful-paint"].numericValue += 25
  await rewriteArtifact(fixture, metricTamper)
  assert.match((await validateArtifactDirectory(fixture.dir)).errors.join("\n"), /metrics or diagnostics/)

  const diagnosticTamper = structuredClone(fixture.raw)
  diagnosticTamper.runWarnings = ["synthetic warning"]
  await rewriteArtifact(fixture, diagnosticTamper)
  assert.match((await validateArtifactDirectory(fixture.dir)).errors.join("\n"), /diagnostics are invalid/)

  const configTamper = structuredClone(fixture.raw)
  configTamper.configSettings.formFactor = "desktop"
  await rewriteArtifact(fixture, configTamper)
  assert.match((await validateArtifactDirectory(fixture.dir)).errors.join("\n"), /configSettings.formFactor/)
})

test("artifact validation binds retained failed-attempt raw evidence", async (t) => {
  const fixture = await makeArtifact()
  t.after(() => rm(fixture.dir, { recursive: true, force: true }))
  fixture.summary.records[0].attempts = [
    { attempt: 1, status: "failed", rawArtifact: fixture.rawArtifact, rawSha256: "0".repeat(64) },
    { attempt: 2, status: "success" },
  ]
  await writeFile(path.join(fixture.dir, "summary.json"), JSON.stringify(fixture.summary, null, 2))
  await writeFile(path.join(fixture.dir, "manifest.json"), JSON.stringify(await buildArtifactManifest(fixture.dir), null, 2))
  assert.match((await validateArtifactDirectory(fixture.dir)).errors.join("\n"), /failed-attempt hash mismatch/)
})

test("malformed manifest file collections return corruption errors", async (t) => {
  const objectDir = await mkdtemp(path.join(os.tmpdir(), "route-report-manifest-object-"))
  const nullDir = await mkdtemp(path.join(os.tmpdir(), "route-report-manifest-null-"))
  const summaryFixture = await makeArtifact()
  t.after(() => Promise.all([
    rm(objectDir, { recursive: true, force: true }),
    rm(nullDir, { recursive: true, force: true }),
    rm(summaryFixture.dir, { recursive: true, force: true }),
  ]))
  await writeFile(path.join(objectDir, "manifest.json"), JSON.stringify({ schemaVersion: REPORT_SCHEMA_VERSION, files: {} }))
  await writeFile(path.join(nullDir, "manifest.json"), JSON.stringify({ schemaVersion: REPORT_SCHEMA_VERSION, files: [null] }))
  const objectValidation = await validateArtifactDirectory(objectDir)
  const nullValidation = await validateArtifactDirectory(nullDir)
  assert.equal(objectValidation.valid, false)
  assert.match(objectValidation.errors.join("\n"), /nonempty array/)
  assert.equal(nullValidation.valid, false)
  assert.match(nullValidation.errors.join("\n"), /entries must contain/)

  summaryFixture.summary.records = {}
  await writeFile(path.join(summaryFixture.dir, "summary.json"), JSON.stringify(summaryFixture.summary, null, 2))
  await writeFile(path.join(summaryFixture.dir, "manifest.json"), JSON.stringify(await buildArtifactManifest(summaryFixture.dir), null, 2))
  const summaryValidation = await validateArtifactDirectory(summaryFixture.dir)
  assert.equal(summaryValidation.valid, false)
  assert.match(summaryValidation.errors.join("\n"), /records must be an array/)
})

test("malformed summary records, profiles, and attempts return corruption errors", async (t) => {
  const nullRecord = await makeArtifact()
  const nullProfile = await makeArtifact()
  const nullAttempt = await makeArtifact()
  t.after(() => Promise.all([
    rm(nullRecord.dir, { recursive: true, force: true }),
    rm(nullProfile.dir, { recursive: true, force: true }),
    rm(nullAttempt.dir, { recursive: true, force: true }),
  ]))

  nullRecord.summary.records = [null]
  await rewriteSummary(nullRecord)
  const recordValidation = await validateArtifactDirectory(nullRecord.dir)
  assert.equal(recordValidation.valid, false)
  assert.match(recordValidation.errors.join("\n"), /record entries must be objects/)

  nullProfile.summary.plan.profiles = [null]
  await rewriteSummary(nullProfile)
  const profileValidation = await validateArtifactDirectory(nullProfile.dir)
  assert.equal(profileValidation.valid, false)
  assert.match(profileValidation.errors.join("\n"), /profiles must be objects/)

  nullAttempt.summary.records[0].attempts = [null]
  await rewriteSummary(nullAttempt)
  const attemptValidation = await validateArtifactDirectory(nullAttempt.dir)
  assert.equal(attemptValidation.valid, false)
  assert.match(attemptValidation.errors.join("\n"), /attempt entries must be objects/)
})

test("baseline acquisition reports missing credentials as unavailable evidence", async () => {
  const result = await acquireCandidates({ repository: null, token: null })
  assert.equal(result.status, "unavailable")
  assert.equal(result.candidates[0].status, "unavailable")
})
