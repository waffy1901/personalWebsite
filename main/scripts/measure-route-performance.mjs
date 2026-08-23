import assert from "node:assert/strict"
import { execFile, spawn } from "node:child_process"
import { createHash } from "node:crypto"
import { createServer } from "node:net"
import { fileURLToPath } from "node:url"
import { createRequire } from "node:module"
import { lstat, mkdtemp, mkdir, readFile, readlink, rm, writeFile } from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import { promisify } from "node:util"
import lighthouse from "lighthouse"
import { launch } from "chrome-launcher"

const execFileAsync = promisify(execFile)
const require = createRequire(import.meta.url)
const scriptPath = fileURLToPath(import.meta.url)
const appRoot = path.resolve(path.dirname(scriptPath), "..")
const repoRoot = path.resolve(appRoot, "..")

export const ISSUE_ID = "issue-174"
export const RUNS_PER_ROUTE_PROFILE = 5
export const MAX_RETRIES_PER_RUN = 1
export const ROUTES = [
  "/resume/",
  "/contact/",
  "/case-studies/",
  "/case-studies/kubernetes-autoscaling/",
  "/case-studies/legacy-deployment-recovery/",
  "/case-studies/cdc-data-reconciliation/",
  "/experience/",
  "/projects/",
]

export const PROFILES = [
  {
    id: "mobile",
    width: 390,
    height: 844,
    deviceScaleFactor: 1,
    mobile: true,
    cpuSlowdownMultiplier: 4,
  },
  {
    id: "desktop",
    width: 1440,
    height: 1000,
    deviceScaleFactor: 1,
    mobile: false,
    cpuSlowdownMultiplier: 1,
  },
]

export const THROTTLING = {
  rttMs: 150,
  throughputKbps: 1638,
  requestLatencyMs: 150,
  downloadThroughputKbps: 1638,
  uploadThroughputKbps: 750,
}

export const BLOCKED_URL_PATTERNS = [
  "*://www.google-analytics.com/*",
  "*://region1.google-analytics.com/*",
  "*://www.googletagmanager.com/*",
  "*://stats.g.doubleclick.net/*",
]

const PERFORMANCE_AUDITS = [
  "first-contentful-paint",
  "largest-contentful-paint",
  "total-blocking-time",
  "total-byte-weight",
  "resource-summary",
  "network-dependency-tree-insight",
]

export function buildLighthouseConfig(profile) {
  return {
    extends: "lighthouse:default",
    settings: {
      onlyCategories: ["performance"],
      onlyAudits: PERFORMANCE_AUDITS,
      formFactor: profile.id,
      screenEmulation: {
        mobile: profile.mobile,
        width: profile.width,
        height: profile.height,
        deviceScaleFactor: profile.deviceScaleFactor,
        disabled: false,
      },
      throttlingMethod: "simulate",
      throttling: {
        ...THROTTLING,
        cpuSlowdownMultiplier: profile.cpuSlowdownMultiplier,
      },
      blockedUrlPatterns: BLOCKED_URL_PATTERNS,
      disableStorageReset: false,
      maxWaitForLoad: 45_000,
    },
  }
}

export function validateMeasurementPlan({ routes = ROUTES, profiles = PROFILES, runs = RUNS_PER_ROUTE_PROFILE } = {}) {
  assert.equal(routes.length, 8, "Issue #174 requires exactly eight routes")
  assert.equal(new Set(routes).size, routes.length, "Routes must be unique")
  assert.ok(!routes.includes("/"), "Home must be excluded from this baseline")
  assert.deepEqual(routes, ROUTES, "Routes must use the approved canonical order")
  assert.deepEqual(profiles.map((profile) => profile.id), ["mobile", "desktop"], "Profiles must include mobile then desktop")
  assert.ok(Number.isInteger(runs) && runs >= 5, "At least five runs per route/profile are required")
  return {
    plannedSuccessfulRuns: routes.length * profiles.length * runs,
    profiles: profiles.map((profile) => ({
      ...profile,
      throttling: {
        ...THROTTLING,
        cpuSlowdownMultiplier: profile.cpuSlowdownMultiplier,
      },
    })),
    routes,
    runs,
  }
}

function numericAuditValue(lhr, auditId) {
  const value = lhr.audits?.[auditId]?.numericValue
  return typeof value === "number" ? value : null
}

function resourceBytesByType(lhr) {
  const items = lhr.audits?.["resource-summary"]?.details?.items ?? []
  return Object.fromEntries(
    items
      .filter((item) => item.resourceType && typeof item.transferSize === "number")
      .map((item) => [item.resourceType, item.transferSize])
  )
}

function criticalDependencyEvidence(lhr) {
  for (const auditId of ["network-dependency-tree-insight", "critical-request-chains"]) {
    const audit = lhr.audits?.[auditId]
    if (audit?.details) {
      return {
        auditId,
        score: audit.score ?? null,
        displayValue: audit.displayValue ?? null,
        details: audit.details,
      }
    }
  }
  return null
}

export function summarizeLhr(lhr) {
  return {
    finalUrl: lhr.finalUrl,
    fetchTime: lhr.fetchTime,
    lighthouseVersion: lhr.lighthouseVersion,
    userAgent: lhr.userAgent,
    metrics: {
      lcpMs: numericAuditValue(lhr, "largest-contentful-paint"),
      fcpMs: numericAuditValue(lhr, "first-contentful-paint"),
      tbtMs: numericAuditValue(lhr, "total-blocking-time"),
      totalTransferredBytes: numericAuditValue(lhr, "total-byte-weight"),
      bytesByResourceType: resourceBytesByType(lhr),
    },
    criticalDependencyEvidence: criticalDependencyEvidence(lhr),
  }
}

function isFiniteNonNegative(value) {
  return Number.isFinite(value) && value >= 0
}

function isObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value)
}

function networkTreeValue(criticalDependencyEvidence) {
  const items = criticalDependencyEvidence?.details?.items
  if (!Array.isArray(items) || items.length === 0) return null
  return items.find((item) => item?.value?.type === "network-tree")?.value ?? null
}

function criticalDependencyValidationErrors(criticalDependencyEvidence) {
  if (!criticalDependencyEvidence?.auditId || !isObject(criticalDependencyEvidence.details)) {
    return ["critical dependency audit/details must be present"]
  }
  if (criticalDependencyEvidence.auditId === "network-dependency-tree-insight") {
    const { items } = criticalDependencyEvidence.details
    if (!Array.isArray(items) || items.length === 0) return ["network dependency audit details.items must be nonempty"]
    const networkTree = networkTreeValue(criticalDependencyEvidence)
    if (!networkTree) return ["network dependency audit details must include a network-tree value"]
    if (!isObject(networkTree.chains)) return ["network dependency network-tree chains must be an object"]
    return []
  }
  if (criticalDependencyEvidence.auditId === "critical-request-chains") {
    if (criticalDependencyEvidence.details.type !== "criticalrequestchain" || !isObject(criticalDependencyEvidence.details.chains)) {
      return ["legacy critical-request-chains details must contain a criticalrequestchain chains object"]
    }
    return []
  }
  return [`unsupported critical dependency audit: ${criticalDependencyEvidence.auditId}`]
}

export function measurementValidationErrors(result) {
  const errors = []
  if (typeof result?.expectedFinalUrl !== "string" || result.expectedFinalUrl.length === 0) {
    errors.push("expectedFinalUrl must be present")
  } else if (result.finalUrl !== result.expectedFinalUrl) {
    errors.push(`finalUrl must equal ${result.expectedFinalUrl}; received ${String(result.finalUrl)}`)
  }
  const diagnostics = result?.diagnostics
  if (!diagnostics || typeof diagnostics !== "object") {
    errors.push("Lighthouse diagnostics must be present")
  } else {
    if (diagnostics.runtimeError) errors.push(`Lighthouse runtimeError: ${JSON.stringify(diagnostics.runtimeError)}`)
    if (!Array.isArray(diagnostics.runWarnings)) {
      errors.push("Lighthouse runWarnings must be an array")
    } else if (diagnostics.runWarnings.length > 0) {
      errors.push(`Lighthouse runWarnings: ${diagnostics.runWarnings.join(" | ")}`)
    }
    if (!diagnostics.auditErrors || typeof diagnostics.auditErrors !== "object") {
      errors.push("Lighthouse auditErrors must be present")
    } else if (Object.keys(diagnostics.auditErrors).length > 0) {
      errors.push(`Lighthouse required audit errors: ${JSON.stringify(diagnostics.auditErrors)}`)
    }
  }
  errors.push(...criticalDependencyValidationErrors(result?.criticalDependencyEvidence))
  const metrics = result?.metrics
  for (const metric of ["lcpMs", "fcpMs", "tbtMs", "totalTransferredBytes"]) {
    if (!isFiniteNonNegative(metrics?.[metric])) {
      errors.push(`${metric} must be a finite nonnegative number; received ${String(metrics?.[metric])}`)
    }
  }
  const resourceBytes = metrics?.bytesByResourceType
  if (!resourceBytes || typeof resourceBytes !== "object") {
    errors.push("bytesByResourceType must be present")
  } else {
    if (!isFiniteNonNegative(resourceBytes.total)) {
      errors.push(`bytesByResourceType.total must be a finite nonnegative number; received ${String(resourceBytes.total)}`)
    }
    for (const [resourceType, bytes] of Object.entries(resourceBytes)) {
      if (!isFiniteNonNegative(bytes)) {
        errors.push(`bytesByResourceType.${resourceType} must be a finite nonnegative number; received ${String(bytes)}`)
      }
    }
  }
  return errors
}

export function baselineValidationErrors(records, plan) {
  const errors = []
  if (records.length !== plan.plannedSuccessfulRuns) {
    errors.push(`expected ${plan.plannedSuccessfulRuns} records, found ${records.length}`)
  }
  for (const profile of PROFILES) {
    for (const route of ROUTES) {
      for (let runNumber = 1; runNumber <= plan.runs; runNumber += 1) {
        const record = records.find((candidate) => candidate.profile.id === profile.id && candidate.route === route && candidate.runNumber === runNumber)
        const label = `${profile.id} ${route} run ${runNumber}`
        if (!record) {
          errors.push(`${label} is missing`)
        } else if (record.status !== "success") {
          errors.push(`${label} did not succeed: ${record.attempts.at(-1)?.message ?? "unknown failure"}`)
        } else {
          if (typeof record.rawArtifact !== "string" || record.rawArtifact.length === 0) {
            errors.push(`${label}: successful record is missing rawArtifact`)
          }
          for (const metricError of measurementValidationErrors(record.result)) {
            errors.push(`${label}: ${metricError}`)
          }
        }
      }
    }
  }
  return errors
}

function lighthouseAuditErrors(lhr) {
  return Object.fromEntries(
    PERFORMANCE_AUDITS
      .map((auditId) => [auditId, lhr.audits?.[auditId]?.errorMessage])
      .filter(([, errorMessage]) => typeof errorMessage === "string" && errorMessage.length > 0)
  )
}

function lighthouseDiagnostics(lhr) {
  return {
    runtimeError: lhr.runtimeError ?? null,
    runWarnings: lhr.runWarnings ?? [],
    auditErrors: lighthouseAuditErrors(lhr),
  }
}

export function hasEmptyCriticalDependencyChain(criticalDependencyEvidence) {
  const chains = criticalDependencyEvidence?.auditId === "network-dependency-tree-insight"
    ? networkTreeValue(criticalDependencyEvidence)?.chains
    : criticalDependencyEvidence?.auditId === "critical-request-chains"
      ? criticalDependencyEvidence.details?.chains
      : null
  return isObject(chains) && Object.keys(chains).length === 0
}

export function criticalDependencyCaveats(records) {
  const groups = new Map()
  for (const record of records.filter((record) => record.status === "success" && hasEmptyCriticalDependencyChain(record.result.criticalDependencyEvidence))) {
    const key = `${record.profile.id}:${record.route}`
    if (!groups.has(key)) {
      groups.set(key, { type: "empty-critical-dependency-chain", profile: record.profile.id, route: record.route, runNumbers: [], rawArtifacts: [] })
    }
    const caveat = groups.get(key)
    caveat.runNumbers.push(record.runNumber)
    caveat.rawArtifacts.push(record.rawArtifact)
  }
  return [...groups.values()]
}

export function median(values) {
  const sorted = values.filter((value) => typeof value === "number").sort((a, b) => a - b)
  if (!sorted.length) return null
  const middle = Math.floor(sorted.length / 2)
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2
}

export function aggregateSuccessfulRuns(runs) {
  const groups = new Map()
  for (const run of runs.filter((run) => run.status === "success")) {
    const key = `${run.profile.id}:${run.route}`
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key).push(run)
  }

  return [...groups.entries()].map(([key, group]) => {
    const bytesByType = new Set(group.flatMap((run) => Object.keys(run.result.metrics.bytesByResourceType)))
    const metricMedian = (name) => median(group.map((run) => run.result.metrics[name]))
    return {
      key,
      profile: group[0].profile.id,
      route: group[0].route,
      successfulRuns: group.length,
      median: {
        lcpMs: metricMedian("lcpMs"),
        fcpMs: metricMedian("fcpMs"),
        tbtMs: metricMedian("tbtMs"),
        totalTransferredBytes: metricMedian("totalTransferredBytes"),
        bytesByResourceType: Object.fromEntries(
          [...bytesByType].sort().map((type) => [
            type,
            median(group.map((run) => run.result.metrics.bytesByResourceType[type] ?? 0)),
          ])
        ),
      },
      rawArtifacts: group.map((run) => run.rawArtifact),
      criticalDependencyAudits: group.map((run) => run.result.criticalDependencyEvidence?.auditId ?? null),
    }
  })
}

function parseArgs(argv) {
  const options = { build: false, dryRun: false, outputDir: null, serve: false, baseUrl: null, runs: RUNS_PER_ROUTE_PROFILE }
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index]
    if (argument === "--build") options.build = true
    else if (argument === "--serve") options.serve = true
    else if (argument === "--dry-run") options.dryRun = true
    else if (argument === "--base-url") options.baseUrl = argv[++index]
    else if (argument === "--output-dir") options.outputDir = argv[++index]
    else if (argument === "--runs") options.runs = Number(argv[++index])
    else throw new Error(`Unknown option: ${argument}`)
  }
  return options
}

async function command(commandName, args, { cwd, env }) {
  return new Promise((resolve, reject) => {
    const child = spawn(commandName, args, { cwd, env, stdio: ["ignore", "pipe", "pipe"] })
    let output = ""
    child.stdout.on("data", (chunk) => { output += chunk })
    child.stderr.on("data", (chunk) => { output += chunk })
    child.on("error", reject)
    child.on("close", (code) => {
      if (code === 0) resolve(output)
      else reject(new Error(`${commandName} ${args.join(" ")} exited ${code}: ${output.slice(-4000)}`))
    })
  })
}

async function waitForServer(baseUrl) {
  let lastError
  for (let attempt = 0; attempt < 60; attempt += 1) {
    try {
      const response = await fetch(baseUrl, { redirect: "manual" })
      if (response.ok) return
      lastError = new Error(`HTTP ${response.status}`)
    } catch (error) {
      lastError = error
    }
    await new Promise((resolve) => setTimeout(resolve, 250))
  }
  throw new Error(`Preview server did not become ready: ${lastError?.message ?? "unknown error"}`)
}

export function previewTargetFromBaseUrl(baseUrl) {
  const url = new URL(baseUrl)
  if (url.protocol !== "http:" || url.hostname !== "127.0.0.1" || url.port !== "4173") {
    throw new Error(`Issue #174 preview must use http://127.0.0.1:4173; received ${baseUrl}`)
  }
  return { host: url.hostname, port: Number(url.port) }
}

export async function assertPortAvailable({ host, port }) {
  const server = createServer()
  await new Promise((resolve, reject) => {
    server.once("error", (error) => reject(new Error(`Preview target ${host}:${port} is unavailable: ${error.code ?? error.message}`)))
    server.listen({ host, port, exclusive: true }, () => {
      server.close((error) => {
        if (error) reject(error)
        else resolve()
      })
    })
  })
}

function childOutput(child) {
  let output = ""
  child.stdout?.on("data", (chunk) => { output += chunk })
  child.stderr?.on("data", (chunk) => { output += chunk })
  return () => output.slice(-4000)
}

function childHasExited(child) {
  return child.exitCode !== null || child.signalCode !== null
}

async function waitForChildExit(child, timeoutMs) {
  if (childHasExited(child)) return
  await Promise.race([
    new Promise((resolve) => child.once("exit", resolve)),
    new Promise((resolve) => setTimeout(resolve, timeoutMs)),
  ])
}

export async function stopPreviewServer(preview) {
  const child = preview?.child ?? preview
  if (!child || childHasExited(child)) return
  child.kill("SIGTERM")
  await waitForChildExit(child, 5_000)
  if (childHasExited(child)) return
  child.kill("SIGKILL")
  await waitForChildExit(child, 2_000)
  if (!childHasExited(child)) throw new Error("Issue #174 preview process did not exit after bounded shutdown")
}

export async function startPreviewServer({ baseUrl, env }) {
  const target = previewTargetFromBaseUrl(baseUrl)
  await assertPortAvailable(target)
  const vite = path.join(appRoot, "node_modules", ".bin", "vite")
  const child = spawn(vite, ["preview", "--host", target.host, "--port", String(target.port), "--strictPort"], {
    cwd: appRoot,
    env,
    stdio: ["ignore", "pipe", "pipe"],
  })
  const diagnostics = childOutput(child)
  const prematureExit = new Promise((_, reject) => {
    child.once("error", (error) => reject(new Error(`Preview process failed to start: ${error.message}; diagnostics: ${diagnostics()}`)))
    child.once("exit", (code, signal) => reject(new Error(`Preview process exited before readiness (code ${code}, signal ${signal ?? "none"}): ${diagnostics()}`)))
  })
  try {
    await Promise.race([waitForServer(baseUrl), prematureExit])
    return { child, diagnostics }
  } catch (error) {
    await stopPreviewServer({ child })
    throw error
  }
}

function createRunId() {
  return new Date().toISOString().replace(/[:.]/g, "-")
}

function routeFileName(route) {
  return route === "/" ? "home" : route.replace(/^\/+|\/+$/g, "").replaceAll("/", "--")
}

export function rawArtifactFileName(route, runNumber, attempt) {
  return `${routeFileName(route)}-run-${runNumber}-attempt-${attempt}.lhr.json`
}

async function gitHeadSha() {
  const { stdout } = await execFileAsync("git", ["rev-parse", "HEAD"], { cwd: repoRoot })
  return stdout.trim()
}

function nullDelimitedStrings(value) {
  return value.toString("utf8").split("\0").filter(Boolean)
}

function compareStrings(left, right) {
  return left < right ? -1 : left > right ? 1 : 0
}

function updateHashPart(hash, label, value) {
  const content = Buffer.isBuffer(value) ? value : Buffer.from(String(value))
  hash.update(label)
  hash.update("\0")
  hash.update(String(content.length))
  hash.update("\0")
  hash.update(content)
  hash.update("\0")
}

function trackedChangedFileManifest(nameStatus) {
  const fields = nullDelimitedStrings(nameStatus)
  const files = []
  for (let index = 0; index < fields.length; index += 2) {
    files.push({ scope: "tracked", status: fields[index], path: fields[index + 1] })
  }
  return files
}

async function untrackedFileFingerprintEntry(relativePath) {
  const absolutePath = path.resolve(repoRoot, relativePath)
  const stats = await lstat(absolutePath)
  if (stats.isSymbolicLink()) {
    return { path: relativePath, entryType: "symlink", content: Buffer.from(await readlink(absolutePath)) }
  }
  if (!stats.isFile()) throw new Error(`Untracked worktree entry is not a file or symlink: ${relativePath}`)
  return { path: relativePath, entryType: "file", content: await readFile(absolutePath) }
}

export async function worktreeFingerprint() {
  const [trackedDiff, trackedNameStatus, untrackedPaths] = await Promise.all([
    execFileAsync("git", ["diff", "--no-ext-diff", "--binary", "HEAD", "--"], { cwd: repoRoot, encoding: "buffer", maxBuffer: 32 * 1024 * 1024 }),
    execFileAsync("git", ["diff", "--no-ext-diff", "--name-status", "--no-renames", "-z", "HEAD", "--"], { cwd: repoRoot, encoding: "buffer", maxBuffer: 4 * 1024 * 1024 }),
    execFileAsync("git", ["ls-files", "--others", "--exclude-standard", "-z"], { cwd: repoRoot, encoding: "buffer", maxBuffer: 4 * 1024 * 1024 }),
  ])
  const untrackedEntries = await Promise.all(
    nullDelimitedStrings(untrackedPaths.stdout)
      .sort(compareStrings)
      .map((relativePath) => untrackedFileFingerprintEntry(relativePath))
  )
  const changedFiles = [
    ...trackedChangedFileManifest(trackedNameStatus.stdout),
    ...untrackedEntries.map(({ path: filePath, entryType }) => ({ scope: "untracked", status: entryType, path: filePath })),
  ].sort((left, right) => compareStrings(`${left.scope}:${left.status}:${left.path}`, `${right.scope}:${right.status}:${right.path}`))
  const hash = createHash("sha256")
  updateHashPart(hash, "issue-174-worktree-fingerprint-v1")
  updateHashPart(hash, "tracked-diff", trackedDiff.stdout)
  for (const entry of untrackedEntries) {
    updateHashPart(hash, "untracked-path", entry.path)
    updateHashPart(hash, "untracked-type", entry.entryType)
    updateHashPart(hash, "untracked-content", entry.content)
  }
  return { sha256: hash.digest("hex"), changedFiles }
}

export function provenanceValidationErrors({ startSha, completionSha, startWorktreeFingerprint, completionWorktreeFingerprint }) {
  const errors = []
  if (typeof startSha !== "string" || startSha.length === 0) errors.push("measurement start SHA must be present")
  if (typeof completionSha !== "string" || completionSha.length === 0) errors.push("measurement completion SHA must be present")
  if (typeof startWorktreeFingerprint !== "string" || startWorktreeFingerprint.length === 0) errors.push("measurement start worktree fingerprint must be present")
  if (typeof completionWorktreeFingerprint !== "string" || completionWorktreeFingerprint.length === 0) errors.push("measurement completion worktree fingerprint must be present")
  if (startSha && completionSha && startSha !== completionSha) {
    errors.push(`HEAD changed during measurement: started at ${startSha}, completed at ${completionSha}`)
  }
  if (startWorktreeFingerprint && completionWorktreeFingerprint && startWorktreeFingerprint !== completionWorktreeFingerprint) {
    errors.push(`worktree changed during measurement: started at ${startWorktreeFingerprint}, completed at ${completionWorktreeFingerprint}`)
  }
  return errors
}

async function chromeVersion() {
  try {
    const { stdout } = await execFileAsync("google-chrome", ["--version"])
    return stdout.trim()
  } catch {
    return "reported in each Lighthouse LHR userAgent"
  }
}

async function runLighthouse({ baseUrl, profile, route, runNumber, attempt, outputDir }) {
  const profileDir = await mkdtemp(path.join(os.tmpdir(), "issue-174-lighthouse-profile-"))
  let chrome
  try {
    chrome = await launch({
      chromeFlags: [
        "--headless=new",
        "--disable-background-networking",
        "--disable-component-update",
        "--disable-default-apps",
        "--disable-extensions",
        "--disable-sync",
        "--metrics-recording-only",
        "--no-default-browser-check",
        "--no-first-run",
      ],
      userDataDir: profileDir,
    })
    const expectedFinalUrl = new URL(route, baseUrl).href
    const runnerResult = await lighthouse(expectedFinalUrl, {
      logLevel: "error",
      output: "json",
      port: chrome.port,
    }, buildLighthouseConfig(profile))
    const artifactDirectory = path.join(outputDir, "raw", profile.id)
    await mkdir(artifactDirectory, { recursive: true })
    const rawArtifact = path.join(artifactDirectory, rawArtifactFileName(route, runNumber, attempt))
    await writeFile(rawArtifact, JSON.stringify(runnerResult.lhr, null, 2))
    const result = {
      ...summarizeLhr(runnerResult.lhr),
      expectedFinalUrl,
      diagnostics: lighthouseDiagnostics(runnerResult.lhr),
    }
    const validationErrors = measurementValidationErrors(result)
    if (validationErrors.length > 0) {
      const error = new Error(`Incomplete Lighthouse metrics: ${validationErrors.join("; ")}`)
      error.rawArtifact = rawArtifact
      error.diagnostics = {
        finalUrl: runnerResult.lhr.finalUrl,
        fetchTime: runnerResult.lhr.fetchTime,
        ...result.diagnostics,
      }
      throw error
    }
    return { rawArtifact, result }
  } finally {
    await chrome?.kill()
    await rm(profileDir, { force: true, recursive: true })
  }
}

function formatMs(value) {
  return value === null ? "n/a" : `${Math.round(value)} ms`
}

function formatBytes(value) {
  return value === null ? "n/a" : `${Math.round(value).toLocaleString()} B`
}

function formatChangedFileManifest(changedFiles) {
  if (changedFiles.length === 0) return "clean"
  return changedFiles.map((file) => `${file.scope}:${file.status}:${file.path}`).join(", ")
}

function reportMarkdown(summary) {
  const slowest = [...summary.aggregates].sort((left, right) => (right.median.lcpMs ?? -1) - (left.median.lcpMs ?? -1))[0]
  const lines = [
    "# Issue #174 local cold-load baseline",
    "",
    `- Base SHA: \`${summary.environment.baseSha}\``,
    `- Completion SHA: \`${summary.environment.completionSha}\` (${summary.provenance.valid ? "verified unchanged from the measurement start SHA" : "changed during measurement; baseline is invalid"}).`,
    `- Start worktree fingerprint: \`${summary.provenance.start.worktree.sha256}\`.`,
    `- Completion worktree fingerprint: \`${summary.provenance.completion.worktree.sha256}\`.`,
    `- Start changed-file manifest: ${formatChangedFileManifest(summary.provenance.start.worktree.changedFiles)}.`,
    `- Completion changed-file manifest: ${formatChangedFileManifest(summary.provenance.completion.worktree.changedFiles)}.`,
    `- Timestamp: ${summary.timestamps.completedAt}`,
    `- Primary method: Lighthouse ${summary.environment.lighthouseVersion} with simulated throttling.`,
    `- Cold isolation: fresh Chrome process and temporary user-data directory for every measured run; serialized in the recorded order.`,
    `- Telemetry boundary: build forced \`VITE_GA_MEASUREMENT_ID\` blank and Lighthouse blocked common GA4/GTM hosts. This run does not validate analytics behavior and did not submit the contact form.`,
    `- Successful primary runs: ${summary.successfulRuns}/${summary.plan.plannedSuccessfulRuns}; failures/retries are in \`summary.json\`.`,
    "",
    "## Median metrics by route/profile",
    "",
    "| Profile | Route | LCP | FCP | TBT | Total transferred |",
    "| --- | --- | ---: | ---: | ---: | ---: |",
    ...summary.aggregates.map((entry) => `| ${entry.profile} | ${entry.route} | ${formatMs(entry.median.lcpMs)} | ${formatMs(entry.median.fcpMs)} | ${formatMs(entry.median.tbtMs)} | ${formatBytes(entry.median.totalTransferredBytes)} |`),
    "",
    "## Observed bottleneck evidence",
    "",
  ]
  if (slowest) {
    lines.push(`- Slowest median LCP: ${slowest.profile} ${slowest.route} at ${formatMs(slowest.median.lcpMs)}.`)
    lines.push(`- Its median transferred bytes by resource type: ${Object.entries(slowest.median.bytesByResourceType).map(([type, bytes]) => `${type} ${formatBytes(bytes)}`).join(", ") || "n/a"}.`)
    lines.push(`- Critical dependency evidence is retained in every raw LHR; observed audit IDs: ${[...new Set(slowest.criticalDependencyAudits.filter(Boolean))].join(", ") || "not reported"}.`)
  } else {
    lines.push("- No successful runs were available for aggregation.")
  }
  if (summary.caveats.criticalDependencyEvidence.length > 0) {
    lines.push("", "## Measurement caveats", "")
    for (const caveat of summary.caveats.criticalDependencyEvidence) {
      lines.push(`- Critical-chain evidence is incomplete for ${caveat.profile} ${caveat.route} runs ${caveat.runNumbers.join(", ")} (aggregate ${caveat.profile}:${caveat.route}); the dependency audit/details were present but reported an empty chain. Numeric baseline metrics remain valid.`)
    }
  }
  lines.push("", "This evidence identifies bottlenecks only; it does not select or implement an optimization.", "")
  return lines.join("\n")
}

async function main() {
  const options = parseArgs(process.argv.slice(2))
  const plan = validateMeasurementPlan({ runs: options.runs })
  const dryRun = {
    issue: ISSUE_ID,
    plan,
    lighthouseConfigs: Object.fromEntries(PROFILES.map((profile) => [profile.id, buildLighthouseConfig(profile)])),
    blockedUrlPatterns: BLOCKED_URL_PATTERNS,
    telemetry: "Build clears VITE_GA_MEASUREMENT_ID and Lighthouse blocks GA4/GTM URLs; analytics behavior is out of scope.",
  }
  if (options.dryRun) {
    process.stdout.write(`${JSON.stringify(dryRun, null, 2)}\n`)
    return
  }

  const runId = createRunId()
  const outputDir = path.resolve(options.outputDir ?? path.join(appRoot, "performance-results", ISSUE_ID, runId))
  const measurementEnv = { ...process.env, VITE_GA_MEASUREMENT_ID: "" }
  const measurementStartSha = await gitHeadSha()
  const measurementStartWorktree = await worktreeFingerprint()
  if (options.build) await command("npm", ["run", "build"], { cwd: appRoot, env: measurementEnv })

  let preview
  let completedOutput = null
  const baseUrl = options.baseUrl ?? "http://127.0.0.1:4173"
  try {
    if (options.serve) {
      preview = await startPreviewServer({ baseUrl, env: measurementEnv })
    }
    await mkdir(outputDir, { recursive: true })
    const startedAt = new Date().toISOString()
    const records = []
    let sequence = 0
    for (const profile of PROFILES) {
      for (const route of ROUTES) {
        for (let runNumber = 1; runNumber <= options.runs; runNumber += 1) {
          sequence += 1
          const record = { sequence, profile, route, runNumber, status: "failed", attempts: [] }
          for (let attempt = 1; attempt <= MAX_RETRIES_PER_RUN + 1; attempt += 1) {
            try {
              const measurement = await runLighthouse({ baseUrl, profile, route, runNumber, attempt, outputDir })
              record.status = "success"
              record.rawArtifact = path.relative(outputDir, measurement.rawArtifact)
              record.result = measurement.result
              record.attempts.push({ attempt, status: "success" })
              break
            } catch (error) {
              record.attempts.push({
                attempt,
                status: "failed",
                message: error.message,
                rawArtifact: error.rawArtifact ? path.relative(outputDir, error.rawArtifact) : null,
                diagnostics: error.diagnostics ?? null,
              })
            }
          }
          records.push(record)
          process.stdout.write(`${record.status.toUpperCase()} ${sequence}/${plan.plannedSuccessfulRuns} ${profile.id} ${route} run ${runNumber}\n`)
        }
      }
    }
    const successfulRuns = records.filter((record) => record.status === "success").length
    const completionSha = await gitHeadSha()
    const completionWorktree = await worktreeFingerprint()
    const provenanceErrors = provenanceValidationErrors({
      startSha: measurementStartSha,
      completionSha,
      startWorktreeFingerprint: measurementStartWorktree.sha256,
      completionWorktreeFingerprint: completionWorktree.sha256,
    })
    const validationErrors = [
      ...baselineValidationErrors(records, plan),
      ...provenanceErrors,
    ]
    const summary = {
      issue: ISSUE_ID,
      method: "Lighthouse simulated throttling cold-cache baseline",
      environment: {
        baseSha: measurementStartSha,
        completionSha,
        nodeVersion: process.version,
        lighthouseVersion: require("lighthouse/package.json").version,
        chromeVersion: await chromeVersion(),
        baseUrl,
        previewDiagnostics: preview?.diagnostics() ?? null,
      },
      provenance: {
        start: {
          sha: measurementStartSha,
          worktree: measurementStartWorktree,
        },
        completion: {
          sha: completionSha,
          worktree: completionWorktree,
        },
        valid: provenanceErrors.length === 0,
      },
      timestamps: { startedAt, completedAt: new Date().toISOString() },
      plan,
      effectiveLighthouseConfig: Object.fromEntries(PROFILES.map((profile) => [profile.id, buildLighthouseConfig(profile)])),
      coldIsolation: "Fresh Chrome process and temporary user-data directory for every measured attempt; sequential execution.",
      telemetryBoundary: {
        buildEnvironment: { VITE_GA_MEASUREMENT_ID: "" },
        blockedUrlPatterns: BLOCKED_URL_PATTERNS,
        analyticsValidated: false,
        contactFormSubmitted: false,
      },
      successfulRuns,
      failedRuns: records.length - successfulRuns,
      metricCompleteness: {
        required: ["lcpMs", "fcpMs", "tbtMs", "totalTransferredBytes", "bytesByResourceType.total", "all bytesByResourceType values"],
        valid: validationErrors.length === 0,
        errors: validationErrors,
      },
      records,
      aggregates: aggregateSuccessfulRuns(records),
      caveats: {
        criticalDependencyEvidence: criticalDependencyCaveats(records),
      },
    }
    await writeFile(path.join(outputDir, "summary.json"), JSON.stringify(summary, null, 2))
    await writeFile(path.join(outputDir, "report.md"), reportMarkdown(summary))
    if (validationErrors.length > 0) {
      throw new Error(`Baseline incomplete or metric-invalid: ${validationErrors.join(" | ")}. See ${path.join(outputDir, "summary.json")}`)
    }
    completedOutput = `Baseline complete: ${outputDir}\n`
  } finally {
    await stopPreviewServer(preview)
  }
  if (completedOutput) process.stdout.write(completedOutput)
}

if (process.argv[1] && path.resolve(process.argv[1]) === scriptPath) {
  main().catch((error) => {
    process.stderr.write(`${error.stack ?? error}\n`)
    process.exitCode = 1
  })
}
