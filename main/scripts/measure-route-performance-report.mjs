#!/usr/bin/env node
import { execFile, spawn } from "node:child_process"
import { createRequire } from "node:module"
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { promisify } from "node:util"
import lighthouse from "lighthouse"
import { launch } from "chrome-launcher"
import { routeMetadata } from "../src/data/seo.js"
import {
  PROFILES,
  THROTTLING,
  buildLighthouseConfig,
  measurementValidationErrors,
  startPreviewServer,
  stopPreviewServer,
  summarizeLhr,
  worktreeFingerprint,
} from "./measure-route-performance.mjs"
import {
  ARTIFACT_PREFIX,
  ATTEMPT_CLEANUP_GRACE_MS,
  ATTEMPT_TIMEOUT_MS,
  REPORT_METHOD_VERSION,
  REPORT_SCHEMA_VERSION,
  REPORT_WORKFLOW_PATH,
  SAMPLES_PER_GROUP,
  TOTAL_MEASUREMENT_BUDGET_MS,
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

const execFileAsync = promisify(execFile)
const require = createRequire(import.meta.url)
const scriptPath = fileURLToPath(import.meta.url)
const appRoot = path.resolve(path.dirname(scriptPath), "..")
const repoRoot = path.resolve(appRoot, "..")
const DEFAULT_BASE_URL = "http://127.0.0.1:4173"

export const REPORT_BLOCKED_URL_PATTERNS = [
  "*://www.google-analytics.com/*",
  "*://region1.google-analytics.com/*",
  "*://www.googletagmanager.com/*",
  "*://stats.g.doubleclick.net/*",
  "*://formspree.io/*",
  "*://*.formspree.io/*",
]

export const EXTERNAL_NETWORK_POLICY = {
  proxyServer: "http://127.0.0.1:9",
  proxyBypassList: "127.0.0.1",
  disableQuic: true,
  allowedOrigin: DEFAULT_BASE_URL,
}

function parseArgs(argv) {
  const options = {
    baseUrl: DEFAULT_BASE_URL,
    baselineCandidates: null,
    build: false,
    dryRun: false,
    measurementBudgetMs: TOTAL_MEASUREMENT_BUDGET_MS,
    outputDir: null,
    serve: false,
  }
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index]
    if (argument === "--base-url") options.baseUrl = argv[++index]
    else if (argument === "--baseline-candidates") options.baselineCandidates = argv[++index]
    else if (argument === "--build") options.build = true
    else if (argument === "--dry-run") options.dryRun = true
    else if (argument === "--measurement-budget-ms") options.measurementBudgetMs = Number(argv[++index])
    else if (argument === "--output-dir") options.outputDir = argv[++index]
    else if (argument === "--serve") options.serve = true
    else throw new Error(`Unknown option: ${argument}`)
  }
  if (!Number.isInteger(options.measurementBudgetMs) || options.measurementBudgetMs < 1 || options.measurementBudgetMs > TOTAL_MEASUREMENT_BUDGET_MS) {
    throw new Error(`--measurement-budget-ms must be an integer from 1 to ${TOTAL_MEASUREMENT_BUDGET_MS}`)
  }
  const target = new URL(options.baseUrl)
  if (target.href !== `${DEFAULT_BASE_URL}/`) throw new Error(`Performance reports must use ${DEFAULT_BASE_URL}; received ${options.baseUrl}`)
  return options
}

function reportLighthouseConfig(profile) {
  const config = buildLighthouseConfig(profile)
  config.settings.blockedUrlPatterns = REPORT_BLOCKED_URL_PATTERNS
  return config
}

async function command(commandName, args, { cwd, env }) {
  return new Promise((resolve, reject) => {
    const child = spawn(commandName, args, { cwd, env, stdio: ["ignore", "pipe", "pipe"] })
    let output = ""
    child.stdout.on("data", (chunk) => { output += chunk })
    child.stderr.on("data", (chunk) => { output += chunk })
    child.once("error", reject)
    child.once("exit", (code) => {
      if (code === 0) resolve(output)
      else reject(new Error(`${commandName} ${args.join(" ")} exited ${code}: ${output.slice(-4000)}`))
    })
  })
}

async function gitHeadSha() {
  const { stdout } = await execFileAsync("git", ["rev-parse", "HEAD"], { cwd: repoRoot })
  return stdout.trim()
}

function runnerIdentity() {
  return {
    ci: process.env.CI === "true",
    name: process.env.RUNNER_NAME ?? "local",
    os: process.env.RUNNER_OS ?? os.platform(),
    architecture: process.env.RUNNER_ARCH ?? os.arch(),
    image: process.env.ImageOS ?? null,
  }
}

async function chromeVersion(chromePath) {
  for (const candidate of [
    chromePath,
    "google-chrome",
    "google-chrome-stable",
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  ].filter(Boolean)) {
    try {
      const { stdout } = await execFileAsync(candidate, ["--version"])
      if (stdout.trim()) return stdout.trim()
    } catch {}
  }
  return "unavailable"
}

function createRunIdentity() {
  const localId = new Date().toISOString().replace(/[:.]/g, "-")
  return {
    id: process.env.GITHUB_RUN_ID ? `${process.env.GITHUB_RUN_ID}-${process.env.GITHUB_RUN_ATTEMPT ?? "1"}` : localId,
    githubRunId: process.env.GITHUB_RUN_ID ?? null,
    githubRunAttempt: process.env.GITHUB_RUN_ATTEMPT ?? null,
    githubRunNumber: process.env.GITHUB_RUN_NUMBER ?? null,
    workflowPath: REPORT_WORKFLOW_PATH,
    githubWorkflowRef: process.env.GITHUB_WORKFLOW_REF ?? null,
    artifactName: process.env.GITHUB_RUN_ID
      ? `${ARTIFACT_PREFIX}-${process.env.GITHUB_RUN_ID}-${process.env.GITHUB_RUN_ATTEMPT ?? "1"}`
      : `${ARTIFACT_PREFIX}-local-${localId}`,
  }
}

function routeFileName(route) {
  return route === "/" ? "home" : route.replace(/^\/+|\/+$/g, "").replaceAll("/", "--")
}

function rawArtifactFileName(route, sample, attempt) {
  return `${routeFileName(route)}-sample-${sample}-attempt-${attempt}.lhr.json`
}

async function browserVersionMetadata(port) {
  const response = await fetch(`http://127.0.0.1:${port}/json/version`)
  if (!response.ok) throw new Error(`Chrome version endpoint returned ${response.status}`)
  const payload = await response.json()
  if (typeof payload.Browser !== "string" || payload.Browser.length === 0) throw new Error("Chrome version endpoint omitted Browser product")
  return {
    product: payload.Browser,
    protocolUserAgent: payload["User-Agent"] ?? null,
  }
}

async function runLighthouseAttempt({ baseUrl, outputDir, profile, route, sample, attempt, signal, chromePath, activeChrome }) {
  if (process.env.ROUTE_PERFORMANCE_TEST_FAIL === "1") {
    const error = new Error("simulated measurement failure")
    error.code = "SIMULATED_FAILURE"
    throw error
  }
  const profileDir = await mkdtemp(path.join(os.tmpdir(), "route-performance-report-"))
  let chrome
  const terminate = () => { void chrome?.kill() }
  signal.addEventListener("abort", terminate, { once: true })
  try {
    chrome = await launch({
      chromePath,
      chromeFlags: [
        "--headless=new",
        "--disable-background-networking",
        "--disable-component-update",
        "--disable-default-apps",
        "--disable-extensions",
        "--disable-quic",
        "--disable-sync",
        "--metrics-recording-only",
        "--no-default-browser-check",
        "--no-first-run",
        `--proxy-server=${EXTERNAL_NETWORK_POLICY.proxyServer}`,
        `--proxy-bypass-list=${EXTERNAL_NETWORK_POLICY.proxyBypassList}`,
      ],
      userDataDir: profileDir,
    })
    activeChrome.current = chrome
    if (signal.aborted) throw signal.reason
    const browser = await browserVersionMetadata(chrome.port)
    const expectedFinalUrl = new URL(route, baseUrl).href
    const runnerResult = await lighthouse(expectedFinalUrl, {
      logLevel: "error",
      output: "json",
      port: chrome.port,
    }, reportLighthouseConfig(profile))
    const rawDirectory = path.join(outputDir, "raw", profile.id)
    await mkdir(rawDirectory, { recursive: true })
    const rawAbsolutePath = path.join(rawDirectory, rawArtifactFileName(route, sample, attempt))
    await writeFile(rawAbsolutePath, JSON.stringify(runnerResult.lhr, null, 2))
    const rawArtifact = path.relative(outputDir, rawAbsolutePath).split(path.sep).join("/")
    const rawSha256 = await sha256File(rawAbsolutePath)
    const result = {
      ...summarizeLhr(runnerResult.lhr),
      expectedFinalUrl,
      browser,
      diagnostics: {
        runtimeError: runnerResult.lhr.runtimeError ?? null,
        runWarnings: runnerResult.lhr.runWarnings ?? [],
        auditErrors: Object.fromEntries(
          Object.entries(runnerResult.lhr.audits ?? {})
            .filter(([, audit]) => typeof audit?.errorMessage === "string")
            .map(([auditId, audit]) => [auditId, audit.errorMessage])
        ),
      },
    }
    const validationErrors = measurementValidationErrors(result)
    if (validationErrors.length > 0) {
      const error = new Error(`Incomplete Lighthouse result: ${validationErrors.join("; ")}`)
      error.code = "INVALID_LIGHTHOUSE_RESULT"
      error.rawArtifact = rawArtifact
      error.rawSha256 = rawSha256
      error.diagnostics = result.diagnostics
      throw error
    }
    return { rawArtifact, rawSha256, result }
  } finally {
    signal.removeEventListener("abort", terminate)
    activeChrome.current = null
    await chrome?.kill()
    await rm(profileDir, { force: true, recursive: true })
  }
}

function formatMetric(value, unit) {
  return Number.isFinite(value) ? `${Math.round(value).toLocaleString()} ${unit}` : "n/a"
}

function reportMarkdown(summary) {
  const lines = [
    "# Route performance report",
    "",
    `- Status: **${summary.status}**`,
    `- Commit: \`${summary.provenance.start.sha}\``,
    `- Worktree fingerprint: \`${summary.provenance.start.worktree.sha256}\``,
    `- Tools: ${summary.environment.nodeVersion}; ${summary.environment.chromeVersion}; Lighthouse ${summary.environment.lighthouseVersion}.`,
    `- Runner: ${summary.environment.runner.os}/${summary.environment.runner.architecture}${summary.environment.runner.image ? ` (${summary.environment.runner.image})` : ""}; config \`${summary.configFingerprint}\`.`,
    `- Profiles: ${summary.plan.profiles.map((profile) => `${profile.id} ${profile.width}x${profile.height}, CPU x${profile.cpuSlowdownMultiplier}`).join("; ")}.`,
    `- Samples: ${summary.records.filter((record) => record.status === "success").length}/${summary.plan.primarySamples} successful primary samples; at most one retry per sample.`,
    `- Runtime bounds: ${summary.limits.totalMeasurementBudgetMs / 60000} minute measurement budget, ${summary.limits.attemptTimeoutMs / 1000} second attempt timeout, ${summary.limits.attemptCleanupGraceMs / 1000} second cleanup grace, ${summary.plan.maximumAttempts} maximum attempts.`,
    `- Baseline: ${summary.baseline.status}${summary.baseline.selected ? ` (run ${summary.baseline.selected.runId}, commit ${summary.baseline.selected.commitSha})` : ""}.`,
    "- Timing deltas are advisory. Incomplete measurements, invalid provenance, or corrupt evidence fail the report.",
    "",
    "## Median metrics and advisory deltas",
    "",
    "| Profile | Route | LCP | Delta | FCP | Delta | TBT | Delta | Transfer | Delta |",
    "| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |",
  ]
  const comparisons = new Map((summary.comparison ?? []).map((entry) => [entry.key, entry]))
  for (const aggregate of summary.aggregates) {
    const delta = comparisons.get(aggregate.key)?.delta ?? {}
    lines.push(`| ${aggregate.profile} | ${aggregate.route} | ${formatMetric(aggregate.median.lcpMs, "ms")} | ${formatMetric(delta.lcpMs, "ms")} | ${formatMetric(aggregate.median.fcpMs, "ms")} | ${formatMetric(delta.fcpMs, "ms")} | ${formatMetric(aggregate.median.tbtMs, "ms")} | ${formatMetric(delta.tbtMs, "ms")} | ${formatMetric(aggregate.median.totalTransferredBytes, "B")} | ${formatMetric(delta.totalTransferredBytes, "B")} |`)
  }
  if (summary.validation.errors.length > 0) {
    lines.push("", "## Validation failures", "", ...summary.validation.errors.map((error) => `- ${error}`))
  }
  if (summary.baseline.skipped.length > 0) {
    lines.push("", "## Baseline candidates skipped", "", ...summary.baseline.skipped.map((entry) => {
      const details = entry.errors ?? entry.differences ?? entry.fields ?? (entry.error ? [entry.error] : [])
      const suffix = details.length > 0 ? ` ${details.slice(0, 5).join("; ")}${details.length > 5 ? "; additional details are retained in summary.json" : ""}` : ""
      return `- Run ${entry.runId ?? "unknown"}: ${entry.reason}.${suffix}`
    }))
  }
  lines.push("", "Raw Lighthouse results and their SHA-256 hashes are retained with this report.", "")
  return lines.join("\n")
}

async function loadCandidates(candidatePath) {
  if (!candidatePath) return []
  try {
    const payload = JSON.parse(await readFile(path.resolve(candidatePath), "utf8"))
    return normalizeBaselineCandidates(payload)
  } catch (error) {
    return [{ status: "unavailable", runId: null, acquisitionError: error.message }]
  }
}

async function writeCheckpoint({ outputDir, summary }) {
  await mkdir(outputDir, { recursive: true })
  await writeFile(path.join(outputDir, "summary.json"), JSON.stringify(summary, null, 2))
  await writeFile(path.join(outputDir, "report.md"), reportMarkdown(summary))
  await writeFile(path.join(outputDir, "manifest.json"), JSON.stringify(await buildArtifactManifest(outputDir), null, 2))
}

function createSummary({ run, plan, environment, config, provenance, measurementBudgetMs, records = [], status = "incomplete", failure = null }) {
  const summary = {
    schemaVersion: REPORT_SCHEMA_VERSION,
    methodVersion: REPORT_METHOD_VERSION,
    run,
    status,
    failure,
    environment,
    provenance,
    timestamps: {
      startedAt: new Date().toISOString(),
      completedAt: null,
    },
    limits: {
      totalMeasurementBudgetMs: measurementBudgetMs,
      attemptTimeoutMs: ATTEMPT_TIMEOUT_MS,
      attemptCleanupGraceMs: ATTEMPT_CLEANUP_GRACE_MS,
      wholeSuiteRetries: 0,
    },
    plan,
    config,
    configFingerprint: null,
    records,
    aggregates: aggregateRecords(records, plan),
    validation: { valid: false, errors: [] },
    baseline: { status: "pending", selected: null, skipped: [] },
    comparison: plan.profiles.flatMap((profile) => plan.routes.map((route) => ({
      key: `${profile.id}:${route}`,
      profile: profile.id,
      route,
      baselineMedian: null,
      delta: { lcpMs: null, fcpMs: null, tbtMs: null, totalTransferredBytes: null },
    }))),
  }
  summary.configFingerprint = compatibilityFingerprint(summary)
  return summary
}

async function main() {
  const options = parseArgs(process.argv.slice(2))
  const routes = discoverCanonicalRoutes(routeMetadata)
  const plan = createReportPlan({ routes, profiles: PROFILES, samplesPerGroup: SAMPLES_PER_GROUP })
  const chromePath = process.env.CHROME_PATH ?? undefined
  const run = createRunIdentity()
  const lighthouseConfigs = Object.fromEntries(PROFILES.map((profile) => [profile.id, reportLighthouseConfig(profile)]))
  const config = {
    throttling: THROTTLING,
    lighthouse: lighthouseConfigs,
    coldCachePolicy: "Fresh Chrome process and temporary user-data directory for every attempt; attempts run sequentially.",
    telemetryPolicy: {
      buildEnvironment: { VITE_GA_MEASUREMENT_ID: "", VITE_FORMSPREE_KEY: "" },
      blockedUrlPatterns: REPORT_BLOCKED_URL_PATTERNS,
      externalNetwork: EXTERNAL_NETWORK_POLICY,
      contactFormSubmitted: false,
    },
  }
  if (options.dryRun) {
    process.stdout.write(`${JSON.stringify({
      schemaVersion: REPORT_SCHEMA_VERSION,
      methodVersion: REPORT_METHOD_VERSION,
      run,
      plan,
      limits: { totalMeasurementBudgetMs: options.measurementBudgetMs, attemptTimeoutMs: ATTEMPT_TIMEOUT_MS, attemptCleanupGraceMs: ATTEMPT_CLEANUP_GRACE_MS },
      config,
    }, null, 2)}\n`)
    return
  }

  const outputDir = options.outputDir
    ? path.resolve(repoRoot, options.outputDir)
    : path.join(appRoot, "performance-results", ARTIFACT_PREFIX, run.id)
  const measurementEnv = { ...process.env, VITE_GA_MEASUREMENT_ID: "", VITE_FORMSPREE_KEY: "" }
  const startSha = await gitHeadSha()
  const startWorktree = await worktreeFingerprint()
  const environment = {
    commitSha: startSha,
    nodeVersion: process.version,
    chromeVersion: await chromeVersion(chromePath),
    lighthouseVersion: require("lighthouse/package.json").version,
    platform: os.platform(),
    architecture: os.arch(),
    runner: runnerIdentity(),
    baseUrl: `${DEFAULT_BASE_URL}/`,
  }
  const provenance = {
    start: { sha: startSha, worktree: startWorktree },
    completion: { sha: null, worktree: null },
  }
  let summary = createSummary({ run, plan, environment, config, provenance, measurementBudgetMs: options.measurementBudgetMs })
  await writeCheckpoint({ outputDir, summary })

  let preview
  const activeChrome = { current: null }
  let terminationSignal = null
  const terminate = (signal) => {
    terminationSignal = signal
    void activeChrome.current?.kill()
  }
  const onSigterm = () => terminate("SIGTERM")
  const onSigint = () => terminate("SIGINT")
  process.once("SIGTERM", onSigterm)
  process.once("SIGINT", onSigint)
  const measurementStartedAtMs = Date.now()
  let failure
  try {
    if (options.build) await command("npm", ["run", "build"], { cwd: appRoot, env: measurementEnv })
    if (options.serve) preview = await startPreviewServer({ baseUrl: options.baseUrl, env: measurementEnv })
    const records = await executeMeasurementMatrix({
      plan,
      startedAtMs: measurementStartedAtMs,
      budgetMs: options.measurementBudgetMs,
      attemptTimeoutMs: ATTEMPT_TIMEOUT_MS,
      now: () => terminationSignal ? measurementStartedAtMs + options.measurementBudgetMs : Date.now(),
      measureAttempt: (attempt) => {
        if (terminationSignal) {
          const error = new Error(`received ${terminationSignal}`)
          error.code = "SIGNAL"
          throw error
        }
        return runLighthouseAttempt({
          ...attempt,
          baseUrl: options.baseUrl,
          outputDir,
          chromePath,
          activeChrome,
        })
      },
      checkpoint: async (partialRecords) => {
        summary.records = [...partialRecords]
        summary.aggregates = aggregateRecords(summary.records, plan)
        summary.validation.errors = matrixValidationErrors(summary)
        await writeCheckpoint({ outputDir, summary })
        const latest = partialRecords.at(-1)
        process.stdout.write(`${latest.status.toUpperCase()} ${latest.sequence}/${plan.primarySamples} ${latest.profile.id} ${latest.route} sample ${latest.sample}\n`)
      },
    })
    summary.records = records
  } catch (error) {
    failure = error
    if (Array.isArray(error.records)) summary.records = error.records
  } finally {
    await stopPreviewServer(preview)
    process.removeListener("SIGTERM", onSigterm)
    process.removeListener("SIGINT", onSigint)
  }

  provenance.completion.sha = await gitHeadSha()
  provenance.completion.worktree = await worktreeFingerprint()
  summary.timestamps.completedAt = new Date().toISOString()
  summary.aggregates = aggregateRecords(summary.records, plan)
  const validationErrors = matrixValidationErrors(summary)
  if (provenance.start.sha !== provenance.completion.sha) validationErrors.push("HEAD changed during measurement")
  if (provenance.start.worktree.sha256 !== provenance.completion.worktree.sha256) validationErrors.push("worktree changed during measurement")
  if (terminationSignal) validationErrors.push(`received ${terminationSignal}`)
  if (failure) validationErrors.push(`${failure.code ?? "REPORT_FAILURE"}: ${failure.message}`)
  summary.validation = { valid: validationErrors.length === 0, errors: validationErrors }
  summary.status = summary.validation.valid ? "complete" : "incomplete"
  summary.failure = terminationSignal ? { code: "SIGNAL", message: terminationSignal } : failure ? { code: failure.code ?? "REPORT_FAILURE", message: failure.message } : null
  summary.configFingerprint = compatibilityFingerprint(summary)

  if (summary.status === "complete") {
    const baseline = await selectCompatibleBaseline({
      currentSummary: summary,
      candidates: await loadCandidates(options.baselineCandidates),
    })
    summary.baseline = {
      status: baseline.status,
      selected: baseline.selected ? {
        runId: baseline.selected.runId,
        runAttempt: baseline.selected.runAttempt,
        artifactName: baseline.selected.artifactName,
        commitSha: baseline.selected.commitSha,
        completedAt: baseline.selected.completedAt,
      } : null,
      skipped: baseline.skipped,
    }
    summary.comparison = baseline.selected
      ? compareAggregates(summary, baseline.selected.summary)
      : compareAggregates(summary, null)
  } else {
    summary.baseline = { status: "not-evaluated", selected: null, skipped: [] }
    summary.comparison = compareAggregates(summary, null)
  }
  await writeCheckpoint({ outputDir, summary })
  if (summary.status === "complete") {
    const integrity = await validateArtifactDirectory(outputDir)
    if (!integrity.valid) {
      summary.status = "incomplete"
      summary.validation = { valid: false, errors: integrity.errors.map((error) => `artifact integrity: ${error}`) }
      summary.failure = { code: "ARTIFACT_INTEGRITY_FAILURE", message: "The completed report artifact failed self-validation." }
      summary.baseline = { status: "not-evaluated", selected: null, skipped: summary.baseline.skipped }
      summary.comparison = compareAggregates(summary, null)
      await writeCheckpoint({ outputDir, summary })
    }
  }
  if (summary.status !== "complete") {
    throw new Error(`Route performance report is incomplete. Inspect ${path.join(outputDir, "summary.json")}`)
  }
  process.stdout.write(`Route performance report complete: ${outputDir}\n`)
}

if (process.argv[1] && path.resolve(process.argv[1]) === scriptPath) {
  main().catch((error) => {
    process.stderr.write(`${error.stack ?? error}\n`)
    process.exitCode = 1
  })
}
