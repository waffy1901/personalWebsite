import assert from "node:assert/strict"
import { createClient } from "@formspree/core"
import test from "node:test"
import { mkdtemp, mkdir, writeFile, readFile, rm } from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import { buildArtifactManifest, sha256File, validateArtifactDirectory } from "./route-performance-report-lib.mjs"
import {
  CONTACT_SCHEMA, CONTACT_METHOD, CONTACT_ORIGIN, CONTACT_CONFIG, CONTACT_PROFILES, CONTACT_MODES,
  SYNTHETIC_FORM_URL, SYNTHETIC_FORM_KEY, CONTACT_MOCK_RESPONSES, contactPlan, contactConfigFingerprint, contactMetrics, contactAggregates,
} from "./configured-contact-performance-lib.mjs"
import { executeContactSuite, launchContactBrowser, runConfiguredContactReport } from "./configured-contact-performance.mjs"

async function fixture(t) {
  const dir = await mkdtemp(path.join(os.tmpdir(), "configured-contact-contract-"))
  t.after(() => rm(dir, { recursive: true, force: true }))
  await mkdir(path.join(dir, "raw"))
  const source = { sha: "a".repeat(40), worktree: { sha256: "b".repeat(64) } }
  const summary = {
    schemaVersion: CONTACT_SCHEMA, methodVersion: CONTACT_METHOD, scenario: "configured-contact", status: "complete", failure: null, fieldInp: null,
    config: CONTACT_CONFIG, configFingerprint: contactConfigFingerprint(), plan: contactPlan(),
    limits: { totalMeasurementBudgetMs: 600000, attemptTimeoutMs: 90000, wholeSuiteRetries: 0 },
    timestamps: { startedAt: "2026-10-11T00:00:00Z", completedAt: "2026-10-11T00:02:00Z" },
    provenance: { start: source, completion: source },
    environment: { commitSha: source.sha, nodeVersion: "v22.22.3", browserVersion: "154.0.0.0", playwrightVersion: "1.62.1", platform: "fixture", osRelease: "fixture", architecture: "fixture", hostname: "fixture", cpuModel: "fixture", cpuCount: 1, totalMemoryBytes: 1000000, baseUrl: `${CONTACT_ORIGIN}/` },
    validation: { valid: true, errors: [] }, records: [], aggregates: [],
  }
  for (const profile of CONTACT_PROFILES) for (const mode of CONTACT_MODES) for (let sample = 1; sample <= 5; sample++) {
    const startMs = mode === "cold" ? 0 : 1000
    const endMs = startMs + 3200
    const mockedRequests = [500, 200].map((status, index) => ({ url: SYNTHETIC_FORM_URL, method: "POST", atMs: endMs + 20 + index * 100, nodeMs: endMs + 20 + index * 100 + 10000, status, fulfilled: true }))
    const resources = [{ name: `${CONTACT_ORIGIN}/assets/Contact-fixture.js`, initiatorType: "script", startTime: startMs + 10, responseEnd: startMs + 30, duration: 20, transferSize: 12000, encodedBodySize: 11700, decodedBodySize: 20000 }]
    const raw = {
      schemaVersion: CONTACT_SCHEMA, methodVersion: CONTACT_METHOD, configFingerprint: contactConfigFingerprint(),
      profile: profile.id, viewport: profile, contextSettings: { viewport: { width: profile.width, height: profile.height }, deviceScaleFactor: profile.deviceScaleFactor, isMobile: profile.isMobile, hasTouch: profile.hasTouch, reducedMotion: profile.reducedMotion, serviceWorkers: "block", acceptDownloads: false }, mode, sample, browserVersion: summary.environment.browserVersion, sourceSha: source.sha, worktreeSha256: source.worktree.sha256,
      runtime: summary.environment,
      url: `${CONTACT_ORIGIN}/contact/`, documentUrl: mode === "cold" ? `${CONTACT_ORIGIN}/contact/` : `${CONTACT_ORIGIN}/`,
      navigation: mode === "cold" ? { kind: "document-navigation" } : { kind: "link-click", homeReady: true, timeOriginBefore: 1000000, timeOriginAfter: 1000000 },
      controls: { firstName: true, lastName: true, email: true, message: true, submit: true, fallbackAbsent: true },
      observation: { startMs, readyMs: startMs + 100, endMs }, trafficControls: CONTACT_CONFIG.trafficPolicy,
      requestClock: { nodeBeforeMs: 10000 + endMs + 200, nodeAfterMs: 10000 + endMs + 200, documentNowMs: endMs + 200, timeOrigin: 1000000 },
      resources, paints: [{ name: "first-contentful-paint", startTime: 20 }], lcp: [{ startTime: 30 }], layoutShifts: [{ startTime: startMs + 40, value: 0.01, hadRecentInput: false }],
      mockedRequests, blockedRequests: [], requests: [
        { url: resources[0].name, method: "GET", atMs: startMs + 10, nodeMs: startMs + 10 + 10000, disposition: "allowed" },
        ...mockedRequests.map(({ url, method, atMs, nodeMs }) => ({ url, method, atMs, nodeMs, disposition: "mocked" })),
      ],
      consoleErrors: [], unexpectedSurface: false,
      task: { failureSubmitMs: endMs + 10, failureVisibleMs: endMs + 50, successSubmitMs: endMs + 100, successVisibleMs: endMs + 150, errorVisible: true, recoveryVisible: true, successVisible: true, successFocused: true },
    }
    const rawArtifact = `raw/${profile.id}-${mode}-${sample}.json`
    await writeFile(path.join(dir, rawArtifact), JSON.stringify(raw))
    summary.records.push({ profile: profile.id, mode, sample, status: "success", rawArtifact, rawSha256: await sha256File(path.join(dir, rawArtifact)), metrics: contactMetrics(raw) })
  }
  await writeFile(path.join(dir, "report.md"), "# Deterministic configured contact fixture\n")
  const result = { dir, summary }
  await rewrite(result)
  return result
}
async function rewrite({ dir, summary }) {
  summary.aggregates = contactAggregates(summary.records)
  await writeFile(path.join(dir, "summary.json"), JSON.stringify(summary))
  await writeFile(path.join(dir, "manifest.json"), JSON.stringify(await buildArtifactManifest(dir)))
}
async function mutateRaw(f, mutation) {
  const record = f.summary.records[0]
  const filename = path.join(f.dir, record.rawArtifact)
  const raw = JSON.parse(await readFile(filename))
  mutation(raw)
  await writeFile(filename, JSON.stringify(raw))
  record.rawSha256 = await sha256File(filename)
  await rewrite(f)
}

test("configured contact artifact validates 20 samples and independently recomputed medians", async (t) => {
  const f = await fixture(t)
  const result = await validateArtifactDirectory(f.dir)
  assert.equal(result.valid, true, result.errors.join("\n"))
  assert.equal(f.summary.aggregates[1].median.lcpMs, null)
  assert.equal(f.summary.aggregates[0].median.failureRecoveryMs, 40)
  f.summary.aggregates[0].median.contactReadyMs = 999
  await writeFile(path.join(f.dir, "summary.json"), JSON.stringify(f.summary))
  await writeFile(path.join(f.dir, "manifest.json"), JSON.stringify(await buildArtifactManifest(f.dir)))
  assert.match((await validateArtifactDirectory(f.dir)).errors.join("\n"), /medians/)
})

const rawRejections = [
  ["missing context settings", (raw) => { delete raw.contextSettings }, /context settings/],
  ["forged context motion", (raw) => { raw.contextSettings.reducedMotion = "no-preference" }, /context settings/],
  ["changed motion preference", (raw) => { raw.viewport = { ...raw.viewport, reducedMotion: "no-preference" } }, /viewport mismatch/],
  ["missing runtime identity", (raw) => { delete raw.runtime }, /runtime\/machine/],
  ["invalid request clock", (raw) => { raw.requestClock.nodeAfterMs += 500 }, /clock calibration/],
  ["forged request time", (raw) => { raw.requests[0].atMs += 100 }, /request evidence\/clock/],
  ["missing form", (raw) => { raw.controls.firstName = false }, /real form/],
  ["fallback", (raw) => { raw.controls.fallbackAbsent = false }, /real form/],
  ["mismatched endpoint", (raw) => { raw.mockedRequests[0].url = "https://formspree.io/f/wrong-key" }, /synthetic POST/],
  ["missing mock completion", (raw) => { raw.mockedRequests[0].fulfilled = false }, /synthetic POST/],
  ["missing recovery", (raw) => { raw.task.recoveryVisible = false }, /task completion/],
  ["missing success", (raw) => { raw.task.successFocused = false }, /task completion/],
  ["missing traffic controls", (raw) => { delete raw.trafficControls }, /traffic controls/],
  ["external request allowed", (raw) => { raw.requests.push({ url: "https://www.google-analytics.com/g/collect", method: "POST", atMs: 50, nodeMs: 10050, disposition: "allowed" }) }, /external request/],
  ["missing blocked evidence", (raw) => { raw.requests.push({ url: "https://unknown.invalid/", method: "GET", atMs: 50, nodeMs: 10050, disposition: "blocked" }) }, /blocked request/],
  ["missing contact chunk", (raw) => { raw.resources = [] }, /contact chunk/],
  ["negative waterfall", (raw) => { raw.resources[0].transferSize = -1 }, /waterfall/],
  ["short window", (raw) => { raw.observation.endMs = 100 }, /observation window/],
  ["missing paint", (raw) => { raw.lcp = [] }, /raw metric lcpMs/],
  ["forged metric", (raw) => { raw.lcp[0].startTime = 900 }, /raw metrics/],
  ["changed source", (raw) => { raw.sourceSha = "c".repeat(40) }, /identity mismatch/],
  ["different browser", (raw) => { raw.browserVersion = "wrong" }, /identity mismatch/],
  ["different method", (raw) => { raw.methodVersion = "lighthouse" }, /method\/config/],
  ["malformed task", (raw) => { raw.task = null }, /task completion/],
  ["malformed resources", (raw) => { raw.resources = {} }, /must be an array/],
]
for (const [name, mutation, expected] of rawRejections) test(`configured contact rejects rehashed ${name} evidence`, async (t) => {
  const f = await fixture(t)
  await mutateRaw(f, mutation)
  const validation = await validateArtifactDirectory(f.dir)
  assert.equal(validation.valid, false)
  assert.match(validation.errors.join("\n"), expected)
})

test("configured contact rejects incomplete, duplicate, unsafe and malformed samples", async (t) => {
  for (const mutation of [
    (f) => f.summary.records.pop(),
    (f) => { f.summary.records[1] = f.summary.records[0] },
    (f) => { f.summary.records[0].rawArtifact = "../outside.json" },
    (f) => { f.summary.records[0] = null },
    (f) => { f.summary.provenance.completion = { sha: "c".repeat(40), worktree: { sha256: "d".repeat(64) } } },
    (f) => { f.summary.fieldInp = 12 },
    (f) => { f.summary.environment.cpuModel = null },
    (f) => { f.summary.environment.nodeVersion = "v26.0.0" },
    (f) => { f.summary.config = { ...CONTACT_CONFIG, throttling: "simulated" } },
  ]) {
    const f = await fixture(t)
    mutation(f)
    await rewrite(f)
    assert.equal((await validateArtifactDirectory(f.dir)).valid, false)
  }
})

test("configured client navigation rejects a document reload and document paint claims", async (t) => {
  const f = await fixture(t)
  const client = f.summary.records.find((record) => record.mode === "client-navigation")
  const filename = path.join(f.dir, client.rawArtifact)
  const raw = JSON.parse(await readFile(filename))
  raw.navigation.timeOriginAfter += 1
  await writeFile(filename, JSON.stringify(raw))
  client.rawSha256 = await sha256File(filename)
  client.metrics.lcpMs = 30
  await rewrite(f)
  const validation = await validateArtifactDirectory(f.dir)
  assert.equal(validation.valid, false)
  assert.match(validation.errors.join("\n"), /preserve the ready home document/)
})

test("configured contact requires an owned synthetic rebuild and rejects Lighthouse baselines", async () => {
  await assert.rejects(runConfiguredContactReport({ build: false, serve: true, measurementBudgetMs: 600000 }), /requires --build --serve/)
  await assert.rejects(runConfiguredContactReport({ build: true, serve: false, measurementBudgetMs: 600000 }), /requires --build --serve/)
  await assert.rejects(runConfiguredContactReport({ dryRun: true, baselineCandidates: "fallback.json" }), /does not accept Lighthouse baseline/)
})


test("configured mock payloads produce installed Formspree client error then success", async (t) => {
  let calls = 0
  t.mock.method(globalThis, "fetch", async (url, options) => {
    assert.equal(url, SYNTHETIC_FORM_URL)
    assert.equal(options.method, "POST")
    const response = CONTACT_MOCK_RESPONSES[calls++]
    assert.ok(response, "no extra synthetic submission")
    return new Response(JSON.stringify(response.body), { status: response.status, headers: { "Content-Type": "application/json" } })
  })
  const client = createClient()
  const failure = await client.submitForm(SYNTHETIC_FORM_KEY, { email: "diagnostic@example.invalid" })
  assert.equal(failure.kind, "error")
  assert.equal(failure.getFormErrors()[0].message, "Synthetic diagnostic failure")
  const success = await client.submitForm(SYNTHETIC_FORM_KEY, { email: "diagnostic@example.invalid" })
  assert.equal(success.kind, "success")
  assert.equal(success.next, "/synthetic-success")
  assert.equal(calls, 2)
})


function untilAborted(signal) {
  if (signal.aborted) return Promise.reject(signal.reason)
  return new Promise((_, reject) => signal.addEventListener("abort", () => reject(signal.reason), { once: true }))
}
function deferred() {
  let resolve
  const promise = new Promise((done) => { resolve = done })
  return { promise, resolve }
}

test("configured orchestration covers all 20 samples without a separate version launch", async () => {
  const steps = []
  let clock = 0
  await executeContactSuite({
    budgetMs: 1000, now: () => clock,
    buildStep: async (signal, timeoutMs) => { signal.throwIfAborted(); assert.equal(timeoutMs, 1000); steps.push("build"); clock = 100 },
    previewStep: async (signal) => { signal.throwIfAborted(); steps.push("preview"); clock = 200 },
    sampleStep: async ({ profile, mode, index, timeoutMs, signal }) => {
      signal.throwIfAborted()
      assert.equal(timeoutMs, 1000 - clock)
      steps.push(`${profile.id}/${mode}/${index}`)
      clock += 1
    },
    cleanupStep: async () => steps.push("cleanup"),
  })
  assert.deepEqual(steps, ["build", "preview", ...CONTACT_PROFILES.flatMap((profile) => CONTACT_MODES.flatMap((mode) => Array.from({ length: 5 }, (_, index) => `${profile.id}/${mode}/${index + 1}`))), "cleanup"])
})

test("configured orchestration rejects exhausted build before preview or browser startup", async () => {
  const steps = []
  let clock = 0
  await assert.rejects(executeContactSuite({
    budgetMs: 25, now: () => clock,
    buildStep: async () => { steps.push("build"); clock = 25 },
    previewStep: async () => steps.push("preview"),
    sampleStep: async () => steps.push("sample"),
    cleanupStep: async () => steps.push("cleanup"),
  }), /budget exhausted/)
  assert.deepEqual(steps, ["build", "cleanup"])
})

for (const blockedStep of ["build", "preview", "sample"]) test(`configured suite deadline cancels blocked ${blockedStep} and owns cleanup`, async () => {
  const steps = []
  const started = performance.now()
  const step = async (name, signal) => {
    steps.push(name)
    if (name === blockedStep) await untilAborted(signal)
  }
  await assert.rejects(executeContactSuite({
    budgetMs: 25, cleanupGraceMs: 50,
    buildStep: (signal) => step("build", signal),
    previewStep: (signal) => step("preview", signal),
    sampleStep: ({ signal }) => step("sample", signal),
    cleanupStep: async () => steps.push("cleanup"),
  }), /timed out/)
  assert.equal(steps.at(-1), "cleanup")
  assert.equal(steps.filter((name) => name === "cleanup").length, 1)
  assert.equal(steps.filter((name) => name === "sample").length, blockedStep === "sample" ? 1 : 0)
  assert.ok(performance.now() - started < 1000, "must not wait for unbounded startup")
})

test("configured first browser launch receives remaining budget, cancels promptly and closes late handle", async () => {
  const browserReady = deferred()
  const browserClosed = deferred()
  const activeBrowser = { current: null }
  const steps = []
  let launchTimeout
  await assert.rejects(executeContactSuite({
    budgetMs: 25, cleanupGraceMs: 50,
    buildStep: async () => steps.push("build"),
    previewStep: async () => steps.push("preview"),
    sampleStep: ({ signal, timeoutMs }) => launchContactBrowser({
      signal, timeoutMs, activeBrowser, options: { headless: true },
      launch: async (options) => { steps.push("launch"); launchTimeout = options.timeout; return browserReady.promise },
    }),
    cleanupStep: async () => { steps.push("cleanup"); assert.equal(activeBrowser.current, null) },
  }), /timed out/)
  assert.ok(launchTimeout > 0 && launchTimeout <= 25)
  assert.deepEqual(steps, ["build", "preview", "launch", "cleanup"])
  browserReady.resolve({ close: async () => browserClosed.resolve() })
  await browserClosed.promise
  assert.equal(activeBrowser.current, null, "late browser must never become a sample resource")
})

test("configured interruption cancels pending startup and closes owned preview once", async () => {
  const interruption = new AbortController()
  let cleanupCount = 0
  let sampleCount = 0
  let previewOwned = false
  await assert.rejects(executeContactSuite({
    budgetMs: 1000, signal: interruption.signal,
    buildStep: async () => {},
    previewStep: async (signal) => {
      previewOwned = true
      interruption.abort(new Error("SIGTERM fixture"))
      await untilAborted(signal)
    },
    sampleStep: async () => { sampleCount += 1 },
    cleanupStep: async () => { cleanupCount += 1; previewOwned = false },
  }), /SIGTERM fixture/)
  assert.equal(cleanupCount, 1)
  assert.equal(sampleCount, 0)
  assert.equal(previewOwned, false)
})

test("configured interruption cancels a pending browser launch without waiting for suite budget", async () => {
  const interruption = new AbortController()
  const browserReady = deferred()
  const browserClosed = deferred()
  const activeBrowser = { current: null }
  let cleanupCount = 0
  await assert.rejects(executeContactSuite({
    budgetMs: 1000, signal: interruption.signal,
    buildStep: async () => {}, previewStep: async () => {},
    sampleStep: ({ signal, timeoutMs }) => launchContactBrowser({
      signal, timeoutMs, activeBrowser,
      launch: async () => { interruption.abort(new Error("SIGINT fixture")); return browserReady.promise },
    }),
    cleanupStep: async () => { cleanupCount += 1 },
  }), /SIGINT fixture/)
  assert.equal(cleanupCount, 1)
  browserReady.resolve({ close: async () => browserClosed.resolve() })
  await browserClosed.promise
  assert.equal(activeBrowser.current, null)
})

test("configured cleanup itself cannot escape suite deadline plus cleanup grace", async () => {
  const cleanup = deferred()
  let cleanupCount = 0
  const started = performance.now()
  try {
    await assert.rejects(executeContactSuite({
      budgetMs: 25, cleanupGraceMs: 25,
      buildStep: async () => {}, previewStep: async () => {}, sampleStep: async () => {},
      cleanupStep: async () => { cleanupCount += 1; await cleanup.promise },
    }), (error) => ["ATTEMPT_TIMEOUT", "ATTEMPT_CLEANUP_TIMEOUT"].includes(error.code))
    assert.equal(cleanupCount, 1)
    assert.ok(performance.now() - started < 1000, "unsettled cleanup must stop the suite within a bounded grace")
  } finally { cleanup.resolve() }
})


test("configured interruption cleanup has its own bounded grace", async () => {
  const interruption = new AbortController()
  const cleanup = deferred()
  let cleanupCount = 0
  const started = performance.now()
  try {
    await assert.rejects(executeContactSuite({
      budgetMs: 1000, cleanupGraceMs: 25, signal: interruption.signal,
      buildStep: async () => {},
      previewStep: async (signal) => { interruption.abort(new Error("SIGTERM fixture")); await untilAborted(signal) },
      sampleStep: async () => assert.fail("must not sample after interruption"),
      cleanupStep: async () => { cleanupCount += 1; await cleanup.promise },
    }), (error) => error.code === "ATTEMPT_CLEANUP_TIMEOUT" && error.fatal === true)
    assert.equal(cleanupCount, 1)
    assert.ok(performance.now() - started < 500, "interruption cleanup must not wait for the remaining suite budget")
  } finally { cleanup.resolve() }
})
