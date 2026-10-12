import { createHash } from "node:crypto"
import { readFile } from "node:fs/promises"
import path from "node:path"

export const CONTACT_SCHEMA = "configured-contact-performance-v1"
export const CONTACT_METHOD = "playwright-contact-native-v1"
export const CONTACT_ORIGIN = "http://127.0.0.1:4173"
export const SYNTHETIC_FORM_KEY = "synthetic-webkit-smoke-key"
export const SYNTHETIC_FORM_URL = `https://formspree.io/f/${SYNTHETIC_FORM_KEY}`
export const CONTACT_MOCK_RESPONSES = [
  { status: 500, body: { errors: [{ code: "UNEXPECTED_ERROR", message: "Synthetic diagnostic failure" }] } },
  { status: 200, body: { next: "/synthetic-success" } },
]
export const CONTACT_SAMPLES = 5
export const CONTACT_WINDOW_MS = 3000
export const CONTACT_BUDGET_MS = 10 * 60 * 1000
export const CONTACT_PROFILES = [
  { id: "desktop", width: 1440, height: 900, deviceScaleFactor: 1, isMobile: false, hasTouch: false, reducedMotion: "reduce" },
  { id: "mobile", width: 390, height: 844, deviceScaleFactor: 1, isMobile: true, hasTouch: true, reducedMotion: "reduce" },
]
export const CONTACT_MODES = ["cold", "client-navigation"]
export const CONTACT_CONFIG = {
  buildEnvironment: { VITE_GA_MEASUREMENT_ID: "", VITE_FORMSPREE_KEY: SYNTHETIC_FORM_KEY },
  throttling: "native; no artificial CPU or network throttling",
  reducedMotion: "reduce",
  motionPolicy: "Reduced-motion lab samples; avoid narrow Navbar smooth scrolling terminating native LCP observation; paint timing does not describe default motion.",
  cachePolicy: "Fresh Chromium process and context per sample; routing disables HTTP cache; client navigation retains home document and loaded modules.",
  observationWindowMs: CONTACT_WINDOW_MS,
  windowPolicy: "Observe through 3000 ms after form controls become visible; contact timing starts at navigation action.",
  requestClockPolicy: "Capture Node monotonic request timestamps without page evaluation; normalize using a document-clock midpoint anchor after task completion; clamp pre-document requests to zero.",
  trafficPolicy: {
    allowedOrigin: CONTACT_ORIGIN,
    external: "deny all except exact synthetic POST fulfilled locally",
    proxyServer: "http://127.0.0.1:9",
    proxyBypassList: "127.0.0.1",
    serviceWorkers: "block",
    backgroundNetworking: "disabled; external proxy unreachable; QUIC disabled",
    popups: "close and fail sample",
    downloads: "cancel and fail sample",
    websockets: "close and fail sample; no server connection",
  },
  task: "Synthetic POST failure (500), visible recovery, retry success (200); no provider delivery.",
  fieldInp: null,
  baseline: "incomparable with Lighthouse simulated-throttling fallback; no deltas",
}
export const CONTACT_METRICS = ["contactReadyMs", "lcpMs", "fcpMs", "observedCls", "totalTransferredBytes", "failureRecoveryMs", "submitCompletionMs"]
const object = (value) => value !== null && typeof value === "object" && !Array.isArray(value)
const finite = (value) => Number.isFinite(value) && value >= 0
const hash = (value) => createHash("sha256").update(value).digest("hex")
export function canonicalJson(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`
  if (object(value)) return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(",")}}`
  return JSON.stringify(value)
}
export const contactConfigFingerprint = () => hash(canonicalJson(CONTACT_CONFIG))
export function contactRequestTime(nodeMs, clock) {
  return Math.max(0, nodeMs - (clock.nodeBeforeMs + clock.nodeAfterMs) / 2 + clock.documentNowMs)
}
export function contactPlan() {
  return { profiles: CONTACT_PROFILES, modes: CONTACT_MODES, samplesPerGroup: CONTACT_SAMPLES, primarySamples: 20, maximumAttempts: 20, retries: 0 }
}
export function contactMetrics(raw) {
  const { startMs, readyMs, endMs } = raw.observation
  const resources = raw.resources.filter((entry) => entry.startTime >= startMs && entry.responseEnd <= endMs && new URL(entry.name).origin === CONTACT_ORIGIN)
  const paints = raw.paints.filter((entry) => entry.startTime <= endMs)
  const lcp = raw.lcp.filter((entry) => entry.startTime <= endMs).at(-1)
  return {
    contactReadyMs: readyMs - startMs,
    lcpMs: raw.mode === "cold" ? lcp?.startTime ?? null : null,
    fcpMs: raw.mode === "cold" ? paints.find((entry) => entry.name === "first-contentful-paint")?.startTime ?? null : null,
    observedCls: raw.layoutShifts.filter((entry) => !entry.hadRecentInput && entry.startTime >= startMs && entry.startTime <= endMs).reduce((sum, entry) => sum + entry.value, 0),
    totalTransferredBytes: resources.reduce((sum, entry) => sum + entry.transferSize, 0),
    failureRecoveryMs: raw.task.failureVisibleMs - raw.task.failureSubmitMs,
    submitCompletionMs: raw.task.successVisibleMs - raw.task.successSubmitMs,
  }
}
function median(values) {
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2
}
export function contactAggregates(records) {
  return CONTACT_PROFILES.flatMap((profile) => CONTACT_MODES.map((mode) => {
    const rows = records.filter((record) => object(record) && record.profile === profile.id && record.mode === mode)
    return {
      profile: profile.id, mode, samples: rows.length,
      median: Object.fromEntries(CONTACT_METRICS.map((key) => [key, rows.length === CONTACT_SAMPLES && rows.every((row) => finite(row.metrics?.[key])) ? median(rows.map((row) => row.metrics[key])) : null])),
    }
  }))
}

export function contactRawErrors(raw, summary, record) {
  const errors = []
  if (!object(raw)) return ["raw sample must be an object"]
  if (raw.schemaVersion !== CONTACT_SCHEMA || raw.methodVersion !== CONTACT_METHOD || raw.configFingerprint !== contactConfigFingerprint()) errors.push("raw method/config identity is invalid")
  if (raw.profile !== record.profile || raw.mode !== record.mode || raw.sample !== record.sample || raw.browserVersion !== summary.environment?.browserVersion || raw.sourceSha !== summary.provenance?.start?.sha || raw.worktreeSha256 !== summary.provenance?.start?.worktree?.sha256) errors.push("raw source/browser/sample identity mismatch")
  if (canonicalJson(raw.runtime) !== canonicalJson(summary.environment)) errors.push("raw runtime/machine identity mismatch")
  const profile = CONTACT_PROFILES.find((entry) => entry.id === record.profile)
  if (canonicalJson(raw.viewport) !== canonicalJson(profile)) errors.push("raw viewport mismatch")
  const { id: _id, width, height, ...device } = profile ?? {}
  const expectedContext = { viewport: { width, height }, ...device, serviceWorkers: "block", acceptDownloads: false }
  if (canonicalJson(raw.contextSettings) !== canonicalJson(expectedContext)) errors.push("raw context settings mismatch")
  if (raw.url !== `${CONTACT_ORIGIN}/contact/` || raw.documentUrl !== (raw.mode === "cold" ? `${CONTACT_ORIGIN}/contact/` : `${CONTACT_ORIGIN}/`)) errors.push("raw route/document URL mismatch")
  if (raw.mode === "client-navigation" && (raw.navigation?.kind !== "link-click" || raw.navigation?.homeReady !== true || raw.navigation?.timeOriginBefore !== raw.navigation?.timeOriginAfter || !finite(raw.navigation?.timeOriginBefore))) errors.push("client navigation did not preserve the ready home document")
  if (raw.mode === "cold" && raw.navigation?.kind !== "document-navigation") errors.push("cold sample must navigate a fresh document")
  if (canonicalJson(raw.controls) !== canonicalJson({ firstName: true, lastName: true, email: true, message: true, submit: true, fallbackAbsent: true })) errors.push("real form controls are not verified")
  if (canonicalJson(raw.trafficControls) !== canonicalJson(CONTACT_CONFIG.trafficPolicy)) errors.push("raw telemetry/traffic controls mismatch")
  const clock = raw.requestClock
  if (!object(clock) || ![clock.nodeBeforeMs, clock.nodeAfterMs, clock.documentNowMs, clock.timeOrigin].every(finite) || clock.nodeAfterMs < clock.nodeBeforeMs || clock.nodeAfterMs - clock.nodeBeforeMs > 100 || clock.documentNowMs < raw.observation?.endMs) errors.push("raw request clock calibration is invalid")
  if (!object(raw.observation) || ![raw.observation?.startMs, raw.observation?.readyMs, raw.observation?.endMs].every(finite) || raw.observation.readyMs < raw.observation.startMs || raw.observation.endMs - raw.observation.readyMs < CONTACT_WINDOW_MS || (raw.mode === "cold" && raw.observation.startMs !== 0)) errors.push("raw observation window is invalid")
  for (const name of ["resources", "paints", "lcp", "layoutShifts", "requests", "blockedRequests", "mockedRequests", "consoleErrors"]) if (!Array.isArray(raw[name])) errors.push(`raw ${name} must be an array`)
  if (errors.length) return errors
  for (const resource of raw.resources) {
    if (!object(resource) || typeof resource.name !== "string" || ![resource.startTime, resource.responseEnd, resource.duration, resource.transferSize, resource.encodedBodySize, resource.decodedBodySize].every(finite)) errors.push("invalid raw resource waterfall entry")
    else { try { new URL(resource.name) } catch { errors.push("invalid raw resource URL") } }
  }
  if (!raw.resources.some((entry) => typeof entry.name === "string" && /^http:\/\/127\.0\.0\.1:4173\/assets\/Contact-[^/]+\.js$/.test(entry.name) && entry.startTime >= raw.observation.startMs && entry.responseEnd <= raw.observation.endMs && entry.encodedBodySize > 0)) errors.push("contact chunk waterfall is missing from the measured action")
  if (raw.paints.some((entry) => !object(entry) || typeof entry.name !== "string" || !finite(entry.startTime)) || raw.lcp.some((entry) => !object(entry) || !finite(entry.startTime)) || raw.layoutShifts.some((entry) => !object(entry) || !finite(entry.startTime) || !finite(entry.value) || typeof entry.hadRecentInput !== "boolean")) errors.push("invalid raw paint/layout timing")
  if (raw.consoleErrors.length || raw.unexpectedSurface !== false) errors.push("sample had console errors or an unexpected browser surface")
  const task = raw.task
  if (!object(task) || task.errorVisible !== true || task.recoveryVisible !== true || task.successVisible !== true || task.successFocused !== true || ![task.failureSubmitMs, task.failureVisibleMs, task.successSubmitMs, task.successVisibleMs].every(finite) || task.failureSubmitMs < raw.observation.endMs || task.failureVisibleMs < task.failureSubmitMs || task.successSubmitMs < task.failureVisibleMs || task.successVisibleMs < task.successSubmitMs) errors.push("raw mocked task completion/recovery is unverified")
  const expectedMocks = [500, 200]
  if (raw.mockedRequests.length !== 2 || raw.mockedRequests.some((entry, index) => !object(entry) || entry.url !== SYNTHETIC_FORM_URL || entry.method !== "POST" || entry.status !== expectedMocks[index] || entry.fulfilled !== true || !finite(entry.atMs) || !finite(entry.nodeMs) || entry.atMs !== contactRequestTime(entry.nodeMs, clock))) errors.push("expected synthetic POST interception is unverified")
  for (const entry of raw.requests) {
    if (!object(entry) || typeof entry.url !== "string" || typeof entry.method !== "string" || !finite(entry.atMs) || !finite(entry.nodeMs) || entry.atMs !== contactRequestTime(entry.nodeMs, clock) || !["allowed", "blocked", "mocked"].includes(entry.disposition)) { errors.push("invalid request evidence/clock"); continue }
    try {
      const origin = new URL(entry.url).origin
      if (entry.disposition === "allowed" && origin !== CONTACT_ORIGIN) errors.push("external request was allowed")
      if (entry.disposition === "mocked" && (entry.url !== SYNTHETIC_FORM_URL || entry.method !== "POST")) errors.push("unexpected endpoint was mocked")
      if (origin === "https://formspree.io" && entry.disposition !== "mocked") errors.push("mismatched form endpoint was attempted")
    } catch { errors.push("invalid request URL") }
  }
  if (canonicalJson(raw.blockedRequests) !== canonicalJson(raw.requests.filter((entry) => entry.disposition === "blocked"))) errors.push("blocked request evidence mismatch")
  const mockRequests = raw.requests.filter((entry) => entry.disposition === "mocked")
  if (mockRequests.length !== 2 || raw.mockedRequests.some((entry, i) => entry.atMs !== mockRequests[i]?.atMs || entry.url !== mockRequests[i]?.url || entry.method !== mockRequests[i]?.method)) errors.push("mocked request evidence mismatch")
  const uncertaintyMs = (clock.nodeAfterMs - clock.nodeBeforeMs) / 2
  if (raw.mockedRequests[0]?.atMs < task?.failureSubmitMs - uncertaintyMs || raw.mockedRequests[0]?.atMs > task?.failureVisibleMs + uncertaintyMs || raw.mockedRequests[1]?.atMs < task?.successSubmitMs - uncertaintyMs || raw.mockedRequests[1]?.atMs > task?.successVisibleMs + uncertaintyMs) errors.push("mock timing does not match task completion")
  if (!errors.length) {
    const recomputed = contactMetrics(raw)
    for (const key of CONTACT_METRICS) if (!(raw.mode === "client-navigation" && ["lcpMs", "fcpMs"].includes(key)) && !finite(recomputed[key])) errors.push(`missing/invalid raw metric ${key}`)
    if (canonicalJson(recomputed) !== canonicalJson(record.metrics)) errors.push("raw metrics do not match summary record")
  }
  return errors
}

export async function validateConfiguredContactArtifact({ summary, artifactDir, manifestPaths }) {
  const errors = []
  if (summary.methodVersion !== CONTACT_METHOD || summary.scenario !== "configured-contact" || summary.status !== "complete" || summary.fieldInp !== null) errors.push("configured-contact method/status/field INP is invalid")
  if (canonicalJson(summary.config) !== canonicalJson(CONTACT_CONFIG) || summary.configFingerprint !== contactConfigFingerprint() || canonicalJson(summary.plan) !== canonicalJson(contactPlan())) errors.push("configured-contact config/plan mismatch")
  if (summary.validation?.valid !== true || !Array.isArray(summary.validation?.errors) || summary.validation.errors.length || summary.failure !== null) errors.push("configured-contact validation/failure state is invalid")
  const start = summary.provenance?.start
  const end = summary.provenance?.completion
  if (!/^[a-f0-9]{40}$/.test(start?.sha ?? "") || start.sha !== end?.sha || summary.environment?.commitSha !== start.sha || !/^[a-f0-9]{64}$/.test(start?.worktree?.sha256 ?? "") || start.worktree.sha256 !== end?.worktree?.sha256) errors.push("configured-contact source provenance is invalid or changed")
  const environment = summary.environment
  if (!object(environment) || ["nodeVersion", "browserVersion", "playwrightVersion", "platform", "osRelease", "architecture", "hostname", "cpuModel"].some((key) => typeof environment[key] !== "string" || !environment[key]) || !Number.isInteger(environment.cpuCount) || environment.cpuCount < 1 || !finite(environment.totalMemoryBytes) || environment.baseUrl !== `${CONTACT_ORIGIN}/`) errors.push("configured-contact runtime/machine identity is incomplete")
  const started = Date.parse(summary.timestamps?.startedAt)
  const completed = Date.parse(summary.timestamps?.completedAt)
  if (!finite(started) || !finite(completed) || completed < started || !Number.isInteger(summary.limits?.totalMeasurementBudgetMs) || summary.limits.totalMeasurementBudgetMs < 1 || summary.limits.totalMeasurementBudgetMs > CONTACT_BUDGET_MS || completed - started > summary.limits.totalMeasurementBudgetMs + 10000 || summary.limits?.attemptTimeoutMs !== 90000 || summary.limits?.wholeSuiteRetries !== 0) errors.push("configured-contact timestamps/deadlines are invalid")
  const records = Array.isArray(summary.records) ? summary.records : []
  if (records.length !== 20) errors.push("configured-contact requires exactly 20 repeated samples")
  const keys = new Set()
  const rawPaths = new Set()
  for (const record of records) {
    if (!object(record) || !CONTACT_PROFILES.some((p) => p.id === record.profile) || !CONTACT_MODES.includes(record.mode) || !Number.isInteger(record.sample) || record.sample < 1 || record.sample > CONTACT_SAMPLES || record.status !== "success") { errors.push("invalid configured-contact sample identity/status"); continue }
    const key = `${record.profile}:${record.mode}:${record.sample}`
    if (keys.has(key)) errors.push("duplicate configured-contact sample")
    keys.add(key)
    if (typeof record.rawArtifact !== "string" || !/^raw\/(desktop|mobile)-(cold|client-navigation)-[1-5]\.json$/.test(record.rawArtifact) || !manifestPaths.has(record.rawArtifact) || rawPaths.has(record.rawArtifact)) { errors.push("configured-contact raw sample path is unsafe, duplicate or absent"); continue }
    rawPaths.add(record.rawArtifact)
    try {
      const bytes = await readFile(path.join(artifactDir, record.rawArtifact))
      if (hash(bytes) !== record.rawSha256) errors.push("configured-contact raw sample hash mismatch")
      errors.push(...contactRawErrors(JSON.parse(bytes), summary, record).map((message) => `${key}: ${message}`))
    } catch (error) { errors.push(`configured-contact corrupt raw sample: ${error.message}`) }
  }
  if (canonicalJson([...manifestPaths].filter((entry) => entry.startsWith("raw/")).sort()) !== canonicalJson([...rawPaths].sort())) errors.push("configured-contact manifest contains unreferenced raw samples")
  if (canonicalJson(summary.aggregates) !== canonicalJson(contactAggregates(records))) errors.push("configured-contact medians do not match repeated raw samples")
  return errors
}
