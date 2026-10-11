import { execFile, spawn } from "node:child_process"
import { createRequire } from "node:module"
import { mkdir, writeFile } from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { promisify } from "node:util"
import { setTimeout as delay } from "node:timers/promises"
import { chromium } from "@playwright/test"
import { assertPortAvailable, previewTargetFromBaseUrl, stopPreviewServer, worktreeFingerprint } from "./measure-route-performance.mjs"
import { buildArtifactManifest, REPORT_WORKFLOW_PATH, sha256File, validateArtifactDirectory, withTimeout } from "./route-performance-report-lib.mjs"
import {
  CONTACT_SCHEMA, CONTACT_METHOD, CONTACT_ORIGIN, CONTACT_CONFIG, CONTACT_PROFILES, CONTACT_MODES,
  CONTACT_SAMPLES, CONTACT_WINDOW_MS, CONTACT_BUDGET_MS, SYNTHETIC_FORM_URL, CONTACT_MOCK_RESPONSES,
  contactPlan, contactConfigFingerprint, contactMetrics, contactAggregates, contactRawErrors, contactRequestTime,
} from "./configured-contact-performance-lib.mjs"

const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const repoRoot = path.resolve(appRoot, "..")
const require = createRequire(import.meta.url)
const execFileAsync = promisify(execFile)
async function sourceIdentity() {
  const { stdout } = await execFileAsync("git", ["rev-parse", "HEAD"], { cwd: repoRoot })
  return { sha: stdout.trim(), worktree: await worktreeFingerprint() }
}
function launchOptions() {
  return {
    headless: true,
    ...(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : { channel: "chrome" }),
    args: [
      "--disable-background-networking", "--disable-component-update", "--disable-default-apps",
      "--disable-extensions", "--disable-sync", "--disable-quic", "--metrics-recording-only",
      "--no-default-browser-check", "--no-first-run",
      `--proxy-server=${CONTACT_CONFIG.trafficPolicy.proxyServer}`,
      `--proxy-bypass-list=${CONTACT_CONFIG.trafficPolicy.proxyBypassList}`,
    ],
  }
}
async function build(env, timeoutMs, signal) {
  signal.throwIfAborted()
  await new Promise((resolve, reject) => {
    const child = spawn("npm", ["run", "build"], { cwd: repoRoot, env, stdio: ["ignore", "pipe", "pipe"], detached: process.platform !== "win32" })
    let output = ""
    let timer
    const kill = () => {
      try { process.platform === "win32" ? child.kill("SIGKILL") : process.kill(-child.pid, "SIGKILL") } catch {}
    }
    signal.addEventListener("abort", kill, { once: true })
    const finish = () => { clearTimeout(timer); signal.removeEventListener("abort", kill) }
    timer = setTimeout(kill, timeoutMs)
    child.stdout.on("data", (chunk) => { output = (output + chunk).slice(-5000) })
    child.stderr.on("data", (chunk) => { output = (output + chunk).slice(-5000) })
    child.once("error", (error) => { finish(); reject(error) })
    child.once("exit", (code) => { finish(); code === 0 ? resolve() : reject(new Error(`Synthetic build failed (${code}): ${output}`)) })
  })
}
// Configured-only startup: own the child before polling so every cancellation can stop it.
async function startContactPreview({ env, signal, activePreview }) {
  signal.throwIfAborted()
  const target = previewTargetFromBaseUrl(CONTACT_ORIGIN)
  await assertPortAvailable(target)
  signal.throwIfAborted()
  const child = spawn(path.join(appRoot, "node_modules", ".bin", "vite"), ["preview", "--host", target.host, "--port", String(target.port), "--strictPort"], { cwd: appRoot, env, stdio: ["ignore", "pipe", "pipe"] })
  activePreview.current = { child }
  let output = ""
  let spawnError
  child.stdout.on("data", (chunk) => { output = (output + chunk).slice(-4000) })
  child.stderr.on("data", (chunk) => { output = (output + chunk).slice(-4000) })
  child.on("error", (error) => { spawnError = error })
  for (let attempt = 0; attempt < 60; attempt++) {
    signal.throwIfAborted()
    if (spawnError || child.exitCode !== null || child.signalCode !== null) throw new Error(`Configured preview failed: ${spawnError?.message ?? output}`)
    try {
      const response = await fetch(CONTACT_ORIGIN, { redirect: "manual", signal: AbortSignal.any([signal, AbortSignal.timeout(1000)]) })
      const ready = response.ok
      await response.body?.cancel()
      if (ready) return
    } catch (error) { if (signal.aborted) throw signal.reason }
    await delay(250, undefined, { signal })
  }
  throw new Error(`Configured preview did not become ready: ${output}`)
}

// The real runner and deterministic fixtures share this deadline/cleanup orchestration.
export async function executeContactSuite({ budgetMs, signal: interruptionSignal, buildStep, previewStep, sampleStep, cleanupStep, cleanupGraceMs = 10000, now = () => Date.now() }) {
  const startedAtMs = now()
  await withTimeout(async (deadlineSignal) => {
    const signal = interruptionSignal ? AbortSignal.any([deadlineSignal, interruptionSignal]) : deadlineSignal
    const remaining = () => {
      signal.throwIfAborted()
      const value = budgetMs - (now() - startedAtMs)
      if (value <= 0) throw new Error("Configured contact suite budget exhausted")
      return value
    }
    try {
      await buildStep(signal, Math.min(120000, remaining()))
      remaining()
      await previewStep(signal)
      for (const profile of CONTACT_PROFILES) for (const mode of CONTACT_MODES) for (let index = 1; index <= CONTACT_SAMPLES; index++) {
        const timeoutMs = Math.min(90000, remaining())
        await withTimeout((sampleSignal) => sampleStep({ profile, mode, index, timeoutMs, signal: AbortSignal.any([signal, sampleSignal]) }), timeoutMs, "configured contact sample", cleanupGraceMs)
      }
      remaining()
    } finally {
      await withTimeout(() => cleanupStep(), cleanupGraceMs, "configured contact cleanup", 0)
    }
  }, budgetMs, "configured contact suite", cleanupGraceMs)
}

// Playwright owns a pending launch until its timeout. On cancellation stop waiting;
// if it nevertheless returns a handle later, close it before it can be sampled.
export async function launchContactBrowser({ launch, options, timeoutMs, signal, activeBrowser }) {
  signal.throwIfAborted()
  let abort
  const cancelled = new Promise((_, reject) => {
    abort = () => reject(signal.reason)
    signal.addEventListener("abort", abort, { once: true })
  })
  const pending = Promise.resolve().then(() => {
    signal.throwIfAborted()
    return launch({ ...options, timeout: timeoutMs })
  }).then(async (browser) => {
    if (signal.aborted) {
      await browser.close()
      throw signal.reason
    }
    activeBrowser.current = browser
    return browser
  })
  try { return await Promise.race([pending, cancelled]) }
  finally { signal.removeEventListener("abort", abort) }
}

async function assertVisible(locator) {
  await locator.waitFor({ state: "visible", timeout: 15000 })
  if (!await locator.isVisible()) throw new Error("Required form/task control is not visible")
}
async function sample({ profile, mode, sample, provenance, environment, timeoutMs, signal, activeBrowser }) {
  signal.throwIfAborted()
  const browser = await launchContactBrowser({ launch: (options) => chromium.launch(options), options: launchOptions(), timeoutMs, signal, activeBrowser })
  const abort = () => { void browser.close() }
  signal.addEventListener("abort", abort, { once: true })
  try {
    if (signal.aborted) throw signal.reason
    const browserVersion = browser.version()
    if (environment.browserVersion === "pending") environment.browserVersion = browserVersion
    if (browserVersion !== environment.browserVersion) throw new Error("Browser version changed between samples")
    const { id, width, height, ...device } = profile
    const contextSettings = { viewport: { width, height }, ...device, serviceWorkers: "block", acceptDownloads: false }
    const context = await browser.newContext(contextSettings)
    const requests = []
    const mockedRequests = []
    const consoleErrors = []
    let unexpectedSurface = false
    let postCount = 0
    const page = await context.newPage()
    context.on("page", (popup) => { if (popup !== page) { unexpectedSurface = true; void popup.close() } })
    page.on("download", (download) => { unexpectedSurface = true; void download.cancel() })
    page.on("pageerror", (error) => consoleErrors.push(error.message))
    await context.routeWebSocket("**/*", async (socket) => {
      unexpectedSurface = true
      const entry = { url: socket.url(), method: "WEBSOCKET", nodeMs: performance.now(), disposition: "blocked" }
      requests.push(entry)
      await socket.close()
    })
    // Failed mocked responses produce an expected browser console network error. JS exceptions above remain fatal.
    await context.route("**/*", async (route) => {
      const request = route.request()
      const url = request.url()
      const method = request.method()
      // Do not evaluate the page while its document request is paused by routing.
      const nodeMs = performance.now()
      if (new URL(url).origin === CONTACT_ORIGIN) {
        requests.push({ url, method, nodeMs, disposition: "allowed" })
        return route.continue()
      }
      if (url === SYNTHETIC_FORM_URL && method === "POST" && postCount < 2) {
        const response = CONTACT_MOCK_RESPONSES[postCount++]
        const { status } = response
        requests.push({ url, method, nodeMs, disposition: "mocked" })
        await route.fulfill({
          status, contentType: "application/json",
          headers: { "access-control-allow-origin": CONTACT_ORIGIN },
          body: JSON.stringify(response.body),
        })
        mockedRequests.push({ url, method, nodeMs, status, fulfilled: true })
        return
      }
      requests.push({ url, method, nodeMs, disposition: "blocked" })
      return route.abort("blockedbyclient")
    })
    await page.addInitScript(() => {
      window.__contactDiagnostic = { lcp: [], layoutShifts: [] }
      new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) window.__contactDiagnostic.lcp.push({ startTime: entry.startTime })
      }).observe({ type: "largest-contentful-paint", buffered: true })
      new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) window.__contactDiagnostic.layoutShifts.push({ startTime: entry.startTime, value: entry.value, hadRecentInput: entry.hadRecentInput })
      }).observe({ type: "layout-shift", buffered: true })
    })
    let startMs = 0
    let navigation = { kind: "document-navigation" }
    if (mode === "cold") {
      await page.goto(`${CONTACT_ORIGIN}/contact/`, { waitUntil: "domcontentloaded", timeout: 15000 })
    } else {
      await page.goto(`${CONTACT_ORIGIN}/`, { waitUntil: "domcontentloaded", timeout: 15000 })
      await assertVisible(page.getByRole("heading", { level: 1 }).first())
      const homeOrigin = await page.evaluate(() => performance.timeOrigin)
      const link = page.getByRole("link", { name: "Contact", exact: true }).filter({ visible: true }).first()
      await assertVisible(link)
      startMs = await page.evaluate(() => performance.now())
      await link.click()
      await page.waitForURL(`${CONTACT_ORIGIN}/contact/`)
      navigation = { kind: "link-click", homeReady: true, timeOriginBefore: homeOrigin, timeOriginAfter: await page.evaluate(() => performance.timeOrigin) }
    }
    const controls = {}
    for (const name of ["firstName", "lastName", "email", "message"]) {
      const field = page.locator(`[name="${name}"]`)
      await assertVisible(field)
      controls[name] = await field.isEnabled()
    }
    await assertVisible(page.getByRole("button", { name: "Send Message", exact: true }))
    controls.submit = await page.getByRole("button", { name: "Send Message", exact: true }).isEnabled()
    controls.fallbackAbsent = await page.getByText("The contact form is unavailable right now.", { exact: false }).count() === 0
    const readyMs = await page.evaluate(() => performance.now())
    await page.waitForTimeout(CONTACT_WINDOW_MS)
    const endMs = await page.evaluate(() => performance.now())
    const snapshot = await page.evaluate(() => ({
      ...window.__contactDiagnostic,
      paints: performance.getEntriesByType("paint").map((entry) => ({ name: entry.name, startTime: entry.startTime })),
      resources: performance.getEntriesByType("resource").map((entry) => entry.toJSON()),
      documentUrl: performance.getEntriesByType("navigation")[0].name,
    }))
    await page.locator('[name="firstName"]').fill("Synthetic")
    await page.locator('[name="lastName"]').fill("Diagnostic")
    await page.locator('[name="email"]').fill("contact-diagnostic@example.invalid")
    await page.locator('[name="message"]').fill("Synthetic local diagnostic; this request must never reach a provider.")
    const failureSubmitMs = await page.evaluate(() => performance.now())
    await page.getByRole("button", { name: "Send Message", exact: true }).click()
    await assertVisible(page.getByRole("alert"))
    const failureVisibleMs = await page.evaluate(() => performance.now())
    const recovery = page.getByRole("link", { name: "Open an email draft", exact: true })
    await assertVisible(recovery)
    const recoveryVisible = await recovery.isVisible()
    const successSubmitMs = await page.evaluate(() => performance.now())
    await page.getByRole("button", { name: "Send Message", exact: true }).click()
    const status = page.getByRole("status").filter({ hasText: "Thank you for your message!" })
    await assertVisible(status)
    const successVisibleMs = await page.evaluate(() => performance.now())
    const nodeBeforeMs = performance.now()
    const documentClock = await page.evaluate(() => ({ documentNowMs: performance.now(), timeOrigin: performance.timeOrigin }))
    const requestClock = { nodeBeforeMs, nodeAfterMs: performance.now(), ...documentClock }
    const normalizeRequests = (entries) => entries.map((entry) => ({ ...entry, atMs: contactRequestTime(entry.nodeMs, requestClock) }))
    const normalizedRequests = normalizeRequests(requests)
    const raw = {
      schemaVersion: CONTACT_SCHEMA, methodVersion: CONTACT_METHOD, configFingerprint: contactConfigFingerprint(),
      profile: id, viewport: profile, contextSettings, mode, sample, browserVersion,
      runtime: environment,
      sourceSha: provenance.sha, worktreeSha256: provenance.worktree.sha256,
      url: page.url(), documentUrl: snapshot.documentUrl, navigation,
      observation: { startMs, readyMs, endMs }, controls,
      trafficControls: CONTACT_CONFIG.trafficPolicy,
      ...snapshot,
      requestClock, requests: normalizedRequests, blockedRequests: normalizedRequests.filter((entry) => entry.disposition === "blocked"), mockedRequests: normalizeRequests(mockedRequests),
      consoleErrors, unexpectedSurface,
      task: {
        failureSubmitMs, failureVisibleMs, successSubmitMs, successVisibleMs,
        errorVisible: true, recoveryVisible,
        successVisible: true, successFocused: await status.evaluate((element) => element === document.activeElement),
      },
    }
    return raw
  } finally {
    signal.removeEventListener("abort", abort)
    await browser.close()
    activeBrowser.current = null
  }
}
function markdown(summary) {
  const lines = [
    "# Configured contact browser diagnostic", "",
    `- Status: **${summary.status}**; local/CI browser evidence, method \`${CONTACT_METHOD}\`.`,
    `- Source: \`${summary.provenance.start.sha}\`; worktree \`${summary.provenance.start.worktree.sha256}\`.`,
    `- Runtime: ${summary.environment.nodeVersion}; Chromium ${summary.environment.browserVersion}; Playwright ${summary.environment.playwrightVersion}.`,
    `- Machine: ${summary.environment.hostname}; ${summary.environment.platform} ${summary.environment.osRelease}/${summary.environment.architecture}; ${summary.environment.cpuCount} x ${summary.environment.cpuModel}; ${summary.environment.totalMemoryBytes} bytes RAM.`,
    `- ${CONTACT_CONFIG.throttling}; ${CONTACT_CONFIG.cachePolicy}`,
    `- prefers-reduced-motion: ${CONTACT_CONFIG.reducedMotion}. ${CONTACT_CONFIG.motionPolicy}`,
    `- ${CONTACT_CONFIG.windowPolicy} Maximum 20 sequential attempts, no retries; ${summary.limits.totalMeasurementBudgetMs} ms suite budget and 90000 ms sample deadline.`,
    "- GA disabled. Only loopback traffic allowed; exact synthetic Formspree POST mocked locally. No real provider submission or analytics delivery.",
    "- Field INP: unavailable (null). Task times describe mocked failure/retry completion, not INP. Client-navigation LCP/FCP are null because document paint entries describe home.",
    "- Incomparable with fallback Lighthouse simulated throttling; no baseline deltas or regression thresholds.", "",
    "| Viewport | Mode | Samples | Form ready ms | LCP ms | FCP ms | Observed CLS | Transfer B | Failure recovery ms | Submit completion ms |",
    "| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |",
  ]
  for (const group of summary.aggregates) lines.push(`| ${group.profile} | ${group.mode} | ${group.samples} | ${Object.values(group.median).map((value) => value === null ? "n/a" : value.toFixed(3)).join(" | ")} |`)
  if (summary.validation.errors.length) lines.push("", "Validation failures:", ...summary.validation.errors.map((error) => `- ${error}`))
  return `${lines.join("\n")}\n`
}
async function checkpoint(outputDir, summary) {
  summary.aggregates = contactAggregates(summary.records)
  await mkdir(path.join(outputDir, "raw"), { recursive: true })
  await writeFile(path.join(outputDir, "summary.json"), JSON.stringify(summary, null, 2))
  await writeFile(path.join(outputDir, "report.md"), markdown(summary))
  await writeFile(path.join(outputDir, "manifest.json"), JSON.stringify(await buildArtifactManifest(outputDir), null, 2))
}
export async function runConfiguredContactReport(options) {
  if (options.baselineCandidates) throw new Error("Configured contact diagnostic does not accept Lighthouse baseline candidates")
  const budgetMs = Math.min(options.measurementBudgetMs, CONTACT_BUDGET_MS)
  if (options.dryRun) {
    process.stdout.write(`${JSON.stringify({ schemaVersion: CONTACT_SCHEMA, methodVersion: CONTACT_METHOD, scenario: "configured-contact", plan: contactPlan(), config: CONTACT_CONFIG, limits: { totalMeasurementBudgetMs: budgetMs, attemptTimeoutMs: 90000, wholeSuiteRetries: 0 }, requires: ["--build", "--serve"] }, null, 2)}\n`)
    return
  }
  if (!options.build || !options.serve) throw new Error("Configured contact requires --build --serve to prove exact synthetic build configuration and own the preview")
  const runId = process.env.GITHUB_RUN_ID ? `${process.env.GITHUB_RUN_ID}-${process.env.GITHUB_RUN_ATTEMPT ?? "1"}` : new Date().toISOString().replace(/[:.]/g, "-")
  const outputDir = options.outputDir ? path.resolve(repoRoot, options.outputDir) : path.join(appRoot, "performance-results", "configured-contact-v1", runId)
  const start = await sourceIdentity()
  const summary = {
    schemaVersion: CONTACT_SCHEMA, methodVersion: CONTACT_METHOD, scenario: "configured-contact", status: "incomplete", failure: null, fieldInp: null,
    run: { id: runId, githubRunId: process.env.GITHUB_RUN_ID ?? null, githubRunAttempt: process.env.GITHUB_RUN_ATTEMPT ?? null, workflowPath: REPORT_WORKFLOW_PATH, artifactName: `configured-contact-v1-${runId}` },
    config: CONTACT_CONFIG, configFingerprint: contactConfigFingerprint(), plan: contactPlan(),
    limits: { totalMeasurementBudgetMs: budgetMs, attemptTimeoutMs: 90000, wholeSuiteRetries: 0 },
    timestamps: { startedAt: new Date().toISOString(), completedAt: null },
    provenance: { start, completion: null },
    environment: { commitSha: start.sha, nodeVersion: process.version, browserVersion: "pending", playwrightVersion: require("@playwright/test/package.json").version, platform: os.platform(), osRelease: os.release(), architecture: os.arch(), hostname: os.hostname(), cpuModel: os.cpus()[0]?.model ?? "unavailable", cpuCount: os.cpus().length, totalMemoryBytes: os.totalmem(), runnerName: process.env.RUNNER_NAME ?? "local", runnerImage: process.env.ImageOS ?? null, baseUrl: `${CONTACT_ORIGIN}/` },
    records: [], aggregates: [], validation: { valid: false, errors: [] },
  }
  await checkpoint(outputDir, summary)
  const env = { ...process.env, ...CONTACT_CONFIG.buildEnvironment }
  const activeBrowser = { current: null }
  const activePreview = { current: null }
  const interruption = new AbortController()
  const terminate = (name) => { interruption.abort(new Error(name)); void activeBrowser.current?.close() }
  const sigint = () => terminate("SIGINT")
  const sigterm = () => terminate("SIGTERM")
  process.once("SIGINT", sigint)
  process.once("SIGTERM", sigterm)
  try {
    await executeContactSuite({
      budgetMs, signal: interruption.signal,
      buildStep: (signal, timeoutMs) => build(env, timeoutMs, signal),
      previewStep: (signal) => startContactPreview({ env, signal, activePreview }),
      sampleStep: async ({ profile, mode, index, timeoutMs, signal }) => {
        const raw = await sample({ profile, mode, sample: index, provenance: start, environment: summary.environment, timeoutMs, signal, activeBrowser })
        const rawArtifact = `raw/${profile.id}-${mode}-${index}.json`
        const record = { profile: profile.id, mode, sample: index, status: "success", rawArtifact, rawSha256: null, metrics: contactMetrics(raw) }
        await writeFile(path.join(outputDir, rawArtifact), JSON.stringify(raw, null, 2))
        record.rawSha256 = await sha256File(path.join(outputDir, rawArtifact))
        const errors = contactRawErrors(raw, summary, record)
        if (errors.length) throw new Error(errors.join("; "))
        summary.records.push(record)
        await checkpoint(outputDir, summary)
        process.stdout.write(`CONTACT ${summary.records.length}/20 ${profile.id} ${mode} sample ${index}\n`)
      },
      cleanupStep: async () => {
        const results = await Promise.allSettled([activeBrowser.current?.close(), stopPreviewServer(activePreview.current)])
        const failed = results.find((result) => result.status === "rejected")
        if (failed) throw failed.reason
      },
    })
    summary.status = "complete"
    summary.validation = { valid: true, errors: [] }
  } catch (error) {
    summary.failure = { code: error.code ?? "CONTACT_DIAGNOSTIC_FAILURE", message: error.message }
    summary.validation = { valid: false, errors: [error.message] }
  } finally {
    process.removeListener("SIGINT", sigint)
    process.removeListener("SIGTERM", sigterm)
  }
  summary.provenance.completion = await sourceIdentity()
  summary.timestamps.completedAt = new Date().toISOString()
  if (start.sha !== summary.provenance.completion.sha || start.worktree.sha256 !== summary.provenance.completion.worktree.sha256) {
    summary.status = "incomplete"
    summary.validation = { valid: false, errors: [...summary.validation.errors, "Source changed during configured contact measurement"] }
  }
  await checkpoint(outputDir, summary)
  if (summary.status === "complete") {
    const integrity = await validateArtifactDirectory(outputDir)
    if (!integrity.valid) {
      summary.status = "incomplete"
      summary.validation = { valid: false, errors: integrity.errors }
      summary.failure = { code: "ARTIFACT_INTEGRITY_FAILURE", message: "Configured contact artifact failed self-validation" }
      await checkpoint(outputDir, summary)
    }
  }
  if (summary.status !== "complete") throw new Error(`Configured contact diagnostic incomplete; inspect ${path.join(outputDir, "summary.json")}`)
  process.stdout.write(`Configured contact diagnostic complete: ${outputDir}\n`)
}
