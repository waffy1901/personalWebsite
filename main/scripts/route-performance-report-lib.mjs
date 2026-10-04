import assert from "node:assert/strict"
import { createHash } from "node:crypto"
import { readFile, readdir, stat } from "node:fs/promises"
import path from "node:path"
import {
  measurementValidationErrors,
  summarizeLhr,
} from "./measure-route-performance.mjs"

export const REPORT_SCHEMA_VERSION = "route-performance-report-v1"
export const REPORT_METHOD_VERSION = "lighthouse-cold-route-v1"
export const ARTIFACT_PREFIX = "route-performance-v1"
export const REPORT_WORKFLOW_PATH = ".github/workflows/route-performance-report.yml"
export const SAMPLES_PER_GROUP = 5
export const MAX_RETRIES_PER_SAMPLE = 1
export const TOTAL_MEASUREMENT_BUDGET_MS = 40 * 60 * 1000
export const ATTEMPT_TIMEOUT_MS = 90 * 1000
export const ATTEMPT_CLEANUP_GRACE_MS = 10 * 1000
export const BASELINE_WINDOW_RUNS = 20
export const BASELINE_MAX_AGE_DAYS = 90
export const REQUIRED_METRICS = ["lcpMs", "fcpMs", "cls", "tbtMs", "totalTransferredBytes"]

export function stableJson(value) {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`
  if (value && typeof value === "object") {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableJson(value[key])}`).join(",")}}`
  }
  return JSON.stringify(value)
}

export function sha256(value) {
  return createHash("sha256").update(value).digest("hex")
}

export async function sha256File(filePath) {
  return sha256(await readFile(filePath))
}

export function discoverCanonicalRoutes(metadata) {
  assert.ok(Array.isArray(metadata) && metadata.length > 0, "Canonical route metadata must be a nonempty array")
  const routes = metadata.map((entry) => entry?.canonicalPath)
  assert.ok(routes.every((route) => typeof route === "string" && route.startsWith("/") && (route === "/" || route.endsWith("/"))), "Every canonical route must be absolute and slash-normalized")
  assert.equal(new Set(routes).size, routes.length, "Canonical routes must be unique")
  assert.ok(routes.includes("/"), "Full-route reporting must include home")
  return routes
}

export function createReportPlan({ routes, profiles, samplesPerGroup = SAMPLES_PER_GROUP } = {}) {
  assert.ok(Array.isArray(routes) && routes.length > 0, "At least one route is required")
  assert.equal(new Set(routes).size, routes.length, "Routes must be unique")
  assert.ok(routes.includes("/"), "Home must be included")
  assert.deepEqual(profiles.map((profile) => profile.id), ["mobile", "desktop"], "Profiles must include mobile then desktop")
  assert.ok(Number.isInteger(samplesPerGroup) && samplesPerGroup >= 5, "At least five samples per route/profile are required")
  const primarySamples = routes.length * profiles.length * samplesPerGroup
  return {
    routes,
    profiles,
    samplesPerGroup,
    maxRetriesPerSample: MAX_RETRIES_PER_SAMPLE,
    primarySamples,
    maximumAttempts: primarySamples * (MAX_RETRIES_PER_SAMPLE + 1),
  }
}

export function median(values) {
  const sorted = values.filter(Number.isFinite).sort((left, right) => left - right)
  if (sorted.length === 0) return null
  const middle = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 1 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2
}

export function aggregateRecords(records, plan) {
  const successful = records.filter((record) => record.status === "success")
  return plan.profiles.flatMap((profile) => plan.routes.map((route) => {
    const group = successful.filter((record) => record.profile.id === profile.id && record.route === route)
    const metricMedian = (metric) => median(group.map((record) => record.result.metrics[metric]))
    return {
      key: `${profile.id}:${route}`,
      profile: profile.id,
      route,
      successfulSamples: group.length,
      complete: group.length === plan.samplesPerGroup,
      median: Object.fromEntries(REQUIRED_METRICS.map((metric) => [metric, metricMedian(metric)])),
      rawArtifacts: group.map((record) => record.rawArtifact),
    }
  }))
}

export function compatibilityProjection(summary) {
  const runner = summary.environment?.runner
  return {
    schemaVersion: summary.schemaVersion,
    methodVersion: summary.methodVersion,
    nodeVersion: summary.environment?.nodeVersion,
    chromeVersion: summary.environment?.chromeVersion,
    lighthouseVersion: summary.environment?.lighthouseVersion,
    platform: summary.environment?.platform,
    architecture: summary.environment?.architecture,
    runner: runner ? {
      ci: runner.ci,
      os: runner.os,
      architecture: runner.architecture,
      image: runner.image,
    } : runner,
    routes: summary.plan?.routes,
    profiles: summary.plan?.profiles,
    samplesPerGroup: summary.plan?.samplesPerGroup,
    throttling: summary.config?.throttling,
    lighthouse: summary.config?.lighthouse,
    coldCachePolicy: summary.config?.coldCachePolicy,
    telemetryPolicy: summary.config?.telemetryPolicy,
  }
}

export function compatibilityFingerprint(summary) {
  return sha256(stableJson(compatibilityProjection(summary)))
}

export function compatibilityDifferences(current, candidate) {
  const left = compatibilityProjection(current)
  const right = compatibilityProjection(candidate)
  return Object.keys(left).filter((key) => stableJson(left[key]) !== stableJson(right[key]))
}

function isFiniteNonNegative(value) {
  return Number.isFinite(value) && value >= 0
}

function isRecordObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value)
}

export function matrixValidationErrors(summary) {
  const errors = []
  const plan = summary?.plan
  const records = summary?.records
  if (!isRecordObject(plan) || !Array.isArray(records) || !Array.isArray(plan.profiles) || !Array.isArray(plan.routes) || !Number.isInteger(plan.samplesPerGroup) || plan.samplesPerGroup < 1) {
    return ["plan and records must be present and well formed"]
  }
  if (!plan.profiles.every((profile) => isRecordObject(profile) && typeof profile.id === "string" && profile.id.length > 0)) {
    return ["plan profiles must be objects with nonempty string ids"]
  }
  if (new Set(plan.profiles.map((profile) => profile.id)).size !== plan.profiles.length) {
    return ["plan profile ids must be unique"]
  }
  if (!plan.routes.every((route) => typeof route === "string" && route.startsWith("/"))) {
    return ["plan routes must be absolute path strings"]
  }
  let baseUrl
  try {
    baseUrl = new URL(summary?.environment?.baseUrl)
  } catch {
    return ["environment baseUrl must be a valid absolute URL"]
  }
  const expected = new Set()
  for (const profile of plan.profiles ?? []) {
    for (const route of plan.routes ?? []) {
      for (let sample = 1; sample <= plan.samplesPerGroup; sample += 1) expected.add(`${profile.id}:${route}:${sample}`)
    }
  }
  const seen = new Set()
  for (const record of records) {
    if (!isRecordObject(record)) {
      errors.push("record entries must be objects")
      continue
    }
    const key = `${record.profile?.id}:${record.route}:${record.sample}`
    if (seen.has(key)) errors.push(`duplicate sample ${key}`)
    seen.add(key)
    if (!expected.has(key)) errors.push(`unexpected sample ${key}`)
    if (record?.status !== "success") {
      errors.push(`${key} did not succeed`)
      continue
    }
    if (typeof record.rawArtifact !== "string" || record.rawArtifact.length === 0) errors.push(`${key} is missing rawArtifact`)
    if (!/^[A-Za-z0-9._/-]+$/.test(record.rawArtifact ?? "") || path.isAbsolute(record.rawArtifact ?? "") || (record.rawArtifact ?? "").split("/").includes("..")) {
      errors.push(`${key} has an unsafe rawArtifact path`)
    }
    let expectedUrl
    try {
      if (typeof record.route !== "string") throw new Error("route is not a string")
      expectedUrl = new URL(record.route, baseUrl).href
    } catch {
      errors.push(`${key} has an invalid route URL`)
    }
    if (expectedUrl && (record.result?.expectedFinalUrl !== expectedUrl || record.result?.finalUrl !== expectedUrl)) errors.push(`${key} has the wrong final URL`)
    for (const metric of REQUIRED_METRICS) {
      if (!isFiniteNonNegative(record.result?.metrics?.[metric])) errors.push(`${key} has invalid ${metric}`)
    }
    if (!/^[a-f0-9]{64}$/.test(record.rawSha256 ?? "")) errors.push(`${key} has an invalid rawSha256`)
  }
  for (const key of expected) if (!seen.has(key)) errors.push(`missing sample ${key}`)
  if (records.length !== expected.size) errors.push(`expected ${expected.size} records, found ${records.length}`)
  return errors
}

export function aggregateValidationErrors(summary) {
  if (!Array.isArray(summary?.records) || !Array.isArray(summary?.plan?.profiles) || !Array.isArray(summary?.plan?.routes)
    || !summary.plan.profiles.every((profile) => isRecordObject(profile) && typeof profile.id === "string")
    || !summary.plan.routes.every((route) => typeof route === "string")
    || !summary.records.every((record) => isRecordObject(record)
      && (record.status !== "success" || (isRecordObject(record.profile) && isRecordObject(record.result) && isRecordObject(record.result.metrics))))) {
    return ["aggregates cannot be validated without a well-formed plan and records"]
  }
  const expected = aggregateRecords(summary.records ?? [], summary.plan)
  return stableJson(expected) === stableJson(summary.aggregates)
    ? []
    : ["aggregates are stale or do not match validated records"]
}

function provenanceValidationErrors(summary) {
  const errors = []
  const provenance = summary?.provenance
  if (!provenance?.start?.sha || !provenance?.completion?.sha) errors.push("start and completion SHAs must be present")
  if (provenance?.start?.sha !== provenance?.completion?.sha) errors.push("HEAD changed during measurement")
  if (summary?.environment?.commitSha !== provenance?.start?.sha) errors.push("environment commitSha does not match measurement provenance")
  if (!provenance?.start?.worktree?.sha256 || !provenance?.completion?.worktree?.sha256) errors.push("start and completion worktree fingerprints must be present")
  if (provenance?.start?.worktree?.sha256 !== provenance?.completion?.worktree?.sha256) errors.push("worktree changed during measurement")
  return errors
}

export function summaryValidationErrors(summary) {
  if (!isRecordObject(summary)) return ["summary must be a JSON object"]
  const errors = []
  if (summary?.schemaVersion !== REPORT_SCHEMA_VERSION) errors.push(`unsupported schemaVersion ${String(summary?.schemaVersion)}`)
  if (summary?.methodVersion !== REPORT_METHOD_VERSION) errors.push(`unsupported methodVersion ${String(summary?.methodVersion)}`)
  if (summary?.status !== "complete") errors.push(`summary status is ${String(summary?.status)}`)
  errors.push(...matrixValidationErrors(summary))
  errors.push(...aggregateValidationErrors(summary))
  errors.push(...provenanceValidationErrors(summary))
  if (summary?.configFingerprint !== compatibilityFingerprint(summary)) errors.push("configFingerprint does not match the compatibility projection")
  return errors
}

async function listFilesRecursively(root) {
  const results = []
  for (const entry of await readdir(root, { withFileTypes: true })) {
    const entryPath = path.join(root, entry.name)
    if (entry.isDirectory()) results.push(...await listFilesRecursively(entryPath))
    else if (entry.isFile()) results.push(entryPath)
  }
  return results
}

function safeArtifactPath(root, relativePath) {
  if (typeof relativePath !== "string" || path.isAbsolute(relativePath) || relativePath.split(/[\\/]/).includes("..")) return null
  const resolved = path.resolve(root, relativePath)
  return resolved.startsWith(`${path.resolve(root)}${path.sep}`) ? resolved : null
}

function chromeVersionFromText(value) {
  const match = String(value ?? "").match(/(?:HeadlessChrome|Chrome|Chromium)[ /](\d+(?:\.\d+){0,3})/i)
  return match?.[1] ?? null
}

function rawConfigurationErrors(raw, record, summary) {
  const errors = []
  const expected = summary.config?.lighthouse?.[record.profile.id]?.settings
  const actual = raw.configSettings
  if (!expected || !actual) return ["recorded and raw Lighthouse settings must be present"]
  for (const field of ["formFactor", "screenEmulation", "throttlingMethod", "throttling", "disableStorageReset", "blockedUrlPatterns"]) {
    if (stableJson(actual[field]) !== stableJson(expected[field])) errors.push(`configSettings.${field}`)
  }
  if (raw.lighthouseVersion !== summary.environment?.lighthouseVersion) errors.push("lighthouseVersion")
  const expectedChrome = chromeVersionFromText(summary.environment?.chromeVersion)
  const browserProduct = chromeVersionFromText(record.result?.browser?.product)
  if (expectedChrome && browserProduct !== expectedChrome) errors.push("Browser.getVersion product")
  const hostChrome = chromeVersionFromText(raw.environment?.hostUserAgent)
  if (expectedChrome && hostChrome && expectedChrome.split(".")[0] !== hostChrome.split(".")[0]) errors.push("host user agent Chrome major")
  if (expectedChrome && !hostChrome) errors.push("host user agent Chrome major")
  return errors
}

export async function validateArtifactDirectory(artifactDir) {
  const errors = []
  let manifest
  let summary
  try {
    manifest = JSON.parse(await readFile(path.join(artifactDir, "manifest.json"), "utf8"))
  } catch (error) {
    return { valid: false, errors: [`manifest.json is missing or invalid: ${error.message}`], summary: null }
  }
  if (!isRecordObject(manifest)) return { valid: false, errors: ["manifest must be a JSON object"], summary: null, manifest }
  if (manifest.schemaVersion !== REPORT_SCHEMA_VERSION) errors.push("manifest schemaVersion is unsupported")
  const manifestFiles = Array.isArray(manifest.files) ? manifest.files : []
  if (manifestFiles.length === 0) errors.push("manifest files must be a nonempty array")
  const manifestPaths = new Set()
  for (const entry of manifestFiles) {
    if (!entry || typeof entry !== "object" || typeof entry.path !== "string" || typeof entry.sha256 !== "string") {
      errors.push("manifest file entries must contain string path and sha256 values")
      continue
    }
    const absolutePath = safeArtifactPath(artifactDir, entry.path)
    if (!absolutePath) {
      errors.push(`unsafe manifest path ${String(entry.path)}`)
      continue
    }
    if (manifestPaths.has(entry.path)) errors.push(`duplicate manifest path ${entry.path}`)
    manifestPaths.add(entry.path)
    try {
      const info = await stat(absolutePath)
      if (!info.isFile()) throw new Error("not a file")
      const actualHash = await sha256File(absolutePath)
      if (actualHash !== entry.sha256) errors.push(`hash mismatch for ${entry.path}`)
    } catch (error) {
      errors.push(`missing manifest file ${entry.path}: ${error.message}`)
    }
  }
  try {
    const actualPaths = (await listFilesRecursively(artifactDir))
      .filter((filePath) => path.basename(filePath) !== "manifest.json")
      .map((filePath) => path.relative(artifactDir, filePath).split(path.sep).join("/"))
      .sort()
    const listedPaths = [...manifestPaths].sort()
    if (stableJson(actualPaths) !== stableJson(listedPaths)) errors.push("manifest does not list exactly every artifact file")
  } catch (error) {
    errors.push(`artifact directory cannot be enumerated: ${error.message}`)
  }
  if (!manifestPaths.has("summary.json") || !manifestPaths.has("report.md")) errors.push("manifest must include summary.json and report.md")
  try {
    summary = JSON.parse(await readFile(path.join(artifactDir, "summary.json"), "utf8"))
    errors.push(...summaryValidationErrors(summary))
  } catch (error) {
    errors.push(`summary.json is missing or invalid: ${error.message}`)
  }
  const summaryRecords = Array.isArray(summary?.records) ? summary.records : []
  if (summary && !Array.isArray(summary.records)) errors.push("summary records must be an array")
  for (const record of summaryRecords) {
    if (!isRecordObject(record)) continue
    if (record.status !== "success") continue
    if (!manifestPaths.has(record.rawArtifact)) errors.push(`raw artifact is absent from manifest: ${record.rawArtifact}`)
    const absolutePath = safeArtifactPath(artifactDir, record.rawArtifact)
    if (!absolutePath) continue
    try {
      const rawBytes = await readFile(absolutePath)
      const raw = JSON.parse(rawBytes.toString("utf8"))
      if (sha256(rawBytes) !== record.rawSha256) errors.push(`record hash mismatch for ${record.rawArtifact}`)
      const recomputed = {
        ...summarizeLhr(raw),
        expectedFinalUrl: new URL(record.route, summary.environment.baseUrl).href,
        browser: record.result?.browser,
        diagnostics: {
          runtimeError: raw.runtimeError ?? null,
          runWarnings: raw.runWarnings ?? [],
          auditErrors: Object.fromEntries(
            Object.entries(raw.audits ?? {})
              .filter(([, audit]) => typeof audit?.errorMessage === "string")
              .map(([auditId, audit]) => [auditId, audit.errorMessage])
          ),
        },
      }
      const diagnosticErrors = measurementValidationErrors(recomputed)
      if (diagnosticErrors.length > 0) {
        errors.push(`raw LHR diagnostics are invalid for ${record.rawArtifact}: ${diagnosticErrors.join("; ")}`)
      }
      if (stableJson(recomputed) !== stableJson(record.result)) {
        errors.push(`raw LHR metrics or diagnostics do not match the record for ${record.rawArtifact}`)
      }
      const configurationErrors = rawConfigurationErrors(raw, record, summary)
      if (configurationErrors.length > 0) {
        errors.push(`raw LHR configuration does not match the report for ${record.rawArtifact}: ${configurationErrors.join(", ")}`)
      }
    } catch (error) {
      errors.push(`raw LHR is corrupt for ${record.rawArtifact}: ${error.message}`)
    }
  }
  for (const record of summaryRecords) {
    if (!isRecordObject(record)) continue
    if (record.attempts != null && !Array.isArray(record.attempts)) errors.push("record attempts must be an array")
    for (const attempt of Array.isArray(record.attempts) ? record.attempts : []) {
      if (!isRecordObject(attempt)) {
        errors.push("attempt entries must be objects")
        continue
      }
      if (attempt.status === "success" || !attempt.rawArtifact) continue
      if (!manifestPaths.has(attempt.rawArtifact)) errors.push(`failed-attempt raw artifact is absent from manifest: ${attempt.rawArtifact}`)
      const absolutePath = safeArtifactPath(artifactDir, attempt.rawArtifact)
      if (!absolutePath) continue
      try {
        const rawBytes = await readFile(absolutePath)
        JSON.parse(rawBytes.toString("utf8"))
        if (sha256(rawBytes) !== attempt.rawSha256) errors.push(`failed-attempt hash mismatch for ${attempt.rawArtifact}`)
      } catch (error) {
        errors.push(`failed-attempt raw LHR is corrupt for ${attempt.rawArtifact}: ${error.message}`)
      }
    }
  }
  return { valid: errors.length === 0, errors, summary, manifest }
}

export function compareAggregates(current, baseline) {
  const baselineGroups = new Map((baseline?.aggregates ?? []).map((entry) => [entry.key, entry]))
  return (current?.aggregates ?? []).map((entry) => {
    const prior = baselineGroups.get(entry.key)
    const delta = Object.fromEntries(REQUIRED_METRICS.map((metric) => [metric,
      Number.isFinite(entry.median?.[metric]) && Number.isFinite(prior?.median?.[metric])
        ? entry.median[metric] - prior.median[metric]
        : null,
    ]))
    return { key: entry.key, profile: entry.profile, route: entry.route, baselineMedian: prior?.median ?? null, delta }
  })
}

function candidateTimestamp(candidate) {
  const value = Date.parse(candidate.completedAt ?? candidate.createdAt ?? "")
  return Number.isFinite(value) ? value : 0
}

export function normalizeBaselineCandidates(payload) {
  if (Array.isArray(payload)) return payload
  if (isRecordObject(payload) && Array.isArray(payload.candidates)) return payload.candidates
  return [{ status: "unavailable", runId: null, acquisitionError: "baseline candidate data must be an array or contain a candidates array" }]
}

export async function selectCompatibleBaseline({ currentSummary, candidates = [], now = new Date(), maxAgeDays = BASELINE_MAX_AGE_DAYS } = {}) {
  if (!Array.isArray(candidates)) {
    return { status: "unavailable", selected: null, skipped: [{ runId: null, reason: "malformed-candidate-collection" }] }
  }
  const malformedCandidates = candidates.filter((candidate) => !isRecordObject(candidate))
  const skipped = malformedCandidates.map(() => ({ runId: null, reason: "malformed-candidate-entry" }))
  const ordered = candidates
    .filter(isRecordObject)
    .sort((left, right) => candidateTimestamp(right) - candidateTimestamp(left) || Number(right.runId ?? 0) - Number(left.runId ?? 0))
  if (ordered.length === 0 && malformedCandidates.length === 0) return { status: "first-run", selected: null, skipped }
  if (ordered.length === 0) return { status: "corrupt", selected: null, skipped }
  let sawArtifact = false
  let sawExpired = false
  let sawMissing = false
  let sawUnavailable = false
  let sawCorrupt = malformedCandidates.length > 0
  let sawIncompatible = false
  const cutoff = now.getTime() - maxAgeDays * 24 * 60 * 60 * 1000
  for (const candidate of ordered) {
    if (candidate.runId != null && currentSummary.run?.githubRunId != null && String(candidate.runId) === String(currentSummary.run.githubRunId)) {
      skipped.push({ runId: candidate.runId, reason: "current-run" })
      continue
    }
    if (candidateTimestamp(candidate) > now.getTime()) {
      skipped.push({ runId: candidate.runId, reason: "future-run" })
      continue
    }
    if (candidate.status === "expired") {
      sawExpired = true
      skipped.push({ runId: candidate.runId, reason: "expired" })
      continue
    }
    if (candidate.status === "unavailable") {
      sawUnavailable = true
      skipped.push({ runId: candidate.runId, reason: "unavailable", error: candidate.acquisitionError ?? null })
      continue
    }
    if (candidate.status === "missing" || !candidate.artifactDir) {
      sawMissing = true
      skipped.push({ runId: candidate.runId, reason: candidate.status ?? "missing" })
      continue
    }
    if (candidateTimestamp(candidate) < cutoff) {
      sawExpired = true
      skipped.push({ runId: candidate.runId, reason: "older-than-retention-window" })
      continue
    }
    sawArtifact = true
    const validation = await validateArtifactDirectory(candidate.artifactDir)
    if (!validation.valid) {
      sawCorrupt = true
      skipped.push({ runId: candidate.runId, reason: "corrupt-or-incomplete", errors: validation.errors })
      continue
    }
    const provenanceErrors = []
    if (String(validation.summary.run?.githubRunId ?? "") !== String(candidate.runId ?? "")) provenanceErrors.push("run id")
    if (String(validation.summary.run?.githubRunAttempt ?? "") !== String(candidate.runAttempt ?? "")) provenanceErrors.push("run attempt")
    if (validation.summary.run?.artifactName !== candidate.artifactName) provenanceErrors.push("artifact name")
    if (validation.summary.run?.workflowPath !== REPORT_WORKFLOW_PATH || candidate.workflowPath !== REPORT_WORKFLOW_PATH) provenanceErrors.push("workflow path")
    if (validation.summary.provenance?.start?.sha !== candidate.commitSha) provenanceErrors.push("commit SHA")
    if (provenanceErrors.length > 0) {
      sawCorrupt = true
      skipped.push({ runId: candidate.runId, reason: "candidate-provenance-mismatch", fields: provenanceErrors })
      continue
    }
    const differences = compatibilityDifferences(currentSummary, validation.summary)
    if (differences.length > 0) {
      sawIncompatible = true
      skipped.push({ runId: candidate.runId, reason: "incompatible", differences })
      continue
    }
    return {
      status: "selected",
      selected: {
        runId: candidate.runId,
        runAttempt: candidate.runAttempt ?? null,
        artifactName: candidate.artifactName ?? null,
        commitSha: validation.summary.provenance.start.sha,
        completedAt: validation.summary.timestamps.completedAt,
        summary: validation.summary,
      },
      skipped,
    }
  }
  const status = sawIncompatible ? "incompatible" : sawCorrupt ? "corrupt" : sawExpired ? "expired" : sawMissing ? "missing" : sawUnavailable || sawArtifact ? "unavailable" : "unavailable"
  return { status, selected: null, skipped }
}

export async function buildArtifactManifest(outputDir) {
  const files = (await listFilesRecursively(outputDir))
    .filter((filePath) => path.basename(filePath) !== "manifest.json")
    .sort()
  return {
    schemaVersion: REPORT_SCHEMA_VERSION,
    generatedAt: new Date().toISOString(),
    files: await Promise.all(files.map(async (filePath) => ({
      path: path.relative(outputDir, filePath).split(path.sep).join("/"),
      sha256: await sha256File(filePath),
      bytes: (await stat(filePath)).size,
    }))),
  }
}

export async function withTimeout(task, timeoutMs, label = "operation", cleanupGraceMs = ATTEMPT_CLEANUP_GRACE_MS) {
  const controller = new AbortController()
  let timer
  const taskPromise = Promise.resolve().then(() => task(controller.signal))
  const outcome = await Promise.race([
    taskPromise.then((value) => ({ status: "fulfilled", value }), (error) => ({ status: "rejected", error })),
    new Promise((resolve) => {
      timer = setTimeout(() => resolve({ status: "timeout" }), timeoutMs)
    }),
  ])
  clearTimeout(timer)
  if (outcome.status === "fulfilled") return outcome.value
  if (outcome.status === "rejected") throw outcome.error

  const timeoutError = new Error(`${label} timed out after ${timeoutMs} ms`)
  timeoutError.code = "ATTEMPT_TIMEOUT"
  controller.abort(timeoutError)
  let cleanupTimer
  const cleanup = await Promise.race([
    taskPromise.then(() => "settled", () => "settled"),
    new Promise((resolve) => {
      cleanupTimer = setTimeout(() => resolve("expired"), cleanupGraceMs)
    }),
  ])
  clearTimeout(cleanupTimer)
  if (cleanup === "expired") {
    const cleanupError = new Error(`${label} did not finish cleanup within ${cleanupGraceMs} ms after timeout`)
    cleanupError.code = "ATTEMPT_CLEANUP_TIMEOUT"
    cleanupError.fatal = true
    throw cleanupError
  }
  throw timeoutError
}

export async function executeMeasurementMatrix({
  plan,
  measureAttempt,
  checkpoint,
  startedAtMs = Date.now(),
  budgetMs = TOTAL_MEASUREMENT_BUDGET_MS,
  attemptTimeoutMs = ATTEMPT_TIMEOUT_MS,
  cleanupGraceMs = ATTEMPT_CLEANUP_GRACE_MS,
  now = () => Date.now(),
} = {}) {
  const records = []
  let sequence = 0
  for (const profile of plan.profiles) {
    for (const route of plan.routes) {
      for (let sample = 1; sample <= plan.samplesPerGroup; sample += 1) {
        if (now() - startedAtMs >= budgetMs) {
          const error = new Error(`total measurement budget of ${budgetMs} ms was exhausted`)
          error.code = "MEASUREMENT_BUDGET_EXHAUSTED"
          error.records = records
          throw error
        }
        sequence += 1
        const record = { sequence, profile, route, sample, status: "failed", attempts: [] }
        for (let attempt = 1; attempt <= plan.maxRetriesPerSample + 1; attempt += 1) {
          if (now() - startedAtMs >= budgetMs) break
          try {
            const result = await withTimeout(
              (signal) => measureAttempt({ profile, route, sample, attempt, signal }),
              Math.min(attemptTimeoutMs, Math.max(1, budgetMs - (now() - startedAtMs))),
              `${profile.id} ${route} sample ${sample} attempt ${attempt}`,
              cleanupGraceMs
            )
            record.status = "success"
            Object.assign(record, result)
            record.attempts.push({ attempt, status: "success" })
            break
          } catch (error) {
            record.attempts.push({
              attempt,
              status: "failed",
              code: error.code ?? null,
              message: error.message,
              rawArtifact: error.rawArtifact ?? null,
              rawSha256: error.rawSha256 ?? null,
              diagnostics: error.diagnostics ?? null,
            })
            if (error.fatal) {
              records.push(record)
              await checkpoint?.(records)
              error.records = records
              throw error
            }
            if (now() - startedAtMs >= budgetMs) break
          }
        }
        records.push(record)
        await checkpoint?.(records)
      }
    }
  }
  return records
}
