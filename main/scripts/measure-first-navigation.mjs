import assert from "node:assert/strict"
import { execFile, spawn } from "node:child_process"
import { createHash } from "node:crypto"
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { promisify } from "node:util"
import { chromium } from "@playwright/test"

const execFileAsync = promisify(execFile)
const scriptPath = fileURLToPath(import.meta.url)
const appRoot = path.resolve(path.dirname(scriptPath), "..")
const repoRoot = path.resolve(appRoot, "..")

export const ISSUE_ID = "issue-174"
export const RUNS_PER_TARGET_PROFILE = 5
export const FIRST_NAVIGATION_TARGETS = [
  { id: "home-projects", initialPath: "/", targetPath: "/projects/", selector: 'nav[aria-label="Primary navigation"] a[href="/projects/"]' },
  { id: "home-experience", initialPath: "/", targetPath: "/experience/", selector: 'nav[aria-label="Primary navigation"] a[href="/experience/"]' },
  { id: "home-case-studies", initialPath: "/", targetPath: "/case-studies/", selector: 'nav[aria-label="Primary navigation"] a[href="/case-studies/"]' },
  { id: "home-contact", initialPath: "/", targetPath: "/contact/", selector: 'nav[aria-label="Primary navigation"] a[href="/contact/"]' },
  { id: "case-studies-autoscaling", initialPath: "/case-studies/", targetPath: "/case-studies/kubernetes-autoscaling/", selector: 'a[href="/case-studies/kubernetes-autoscaling/"]' },
]

export const NAVIGATION_PROFILES = [
  { id: "mobile", width: 390, height: 844, mobile: true, cpuSlowdownMultiplier: 4 },
  { id: "desktop", width: 1440, height: 1000, mobile: false, cpuSlowdownMultiplier: 1 },
]

export const THROTTLING = {
  rttMs: 150,
  throughputKbps: 1638,
  uploadKbps: 750,
}

export const ANALYTICS_HOSTS = [
  "www.google-analytics.com",
  "region1.google-analytics.com",
  "www.googletagmanager.com",
  "stats.g.doubleclick.net",
]

function median(values) {
  const sorted = values.filter(Number.isFinite).sort((left, right) => left - right)
  if (sorted.length === 0) return null
  const middle = Math.floor(sorted.length / 2)
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2
}

export function validateNavigationPlan({
  targets = FIRST_NAVIGATION_TARGETS,
  profiles = NAVIGATION_PROFILES,
  runs = RUNS_PER_TARGET_PROFILE,
} = {}) {
  assert.equal(targets.length, 5, "Issue #174 requires five first-navigation targets")
  assert.equal(new Set(targets.map((target) => target.id)).size, targets.length, "First-navigation target IDs must be unique")
  assert.deepEqual(targets, FIRST_NAVIGATION_TARGETS, "First-navigation targets must use the approved canonical order")
  assert.deepEqual(profiles.map((profile) => profile.id), ["mobile", "desktop"], "Profiles must include mobile then desktop")
  assert.ok(Number.isInteger(runs) && runs >= 5, "At least five runs per target/profile are required")
  return { targets, profiles, runs, plannedSuccessfulRuns: targets.length * profiles.length * runs }
}

export function navigationRecordValidationErrors(record) {
  const errors = []
  if (record?.status !== "success") errors.push("record did not succeed")
  if (!Number.isFinite(record?.activationToReadyMs) || record.activationToReadyMs < 0) errors.push("activationToReadyMs must be a finite nonnegative number")
  if (!Number.isFinite(record?.fullPageFallbackExposureMs) || record.fullPageFallbackExposureMs < 0) errors.push("fullPageFallbackExposureMs must be a finite nonnegative number")
  if (record?.fullPageFallbackExposureMs !== 0) errors.push("full-page route fallback was exposed during an in-app navigation")
  if (!Number.isFinite(record?.routeChunkBytes) || record.routeChunkBytes < 0) errors.push("routeChunkBytes must be a finite nonnegative number")
  if (!record?.analyticsBlocking?.enabled || record.analyticsBlocking.measurementId !== "") errors.push("analytics-disabled build and request blocking must be recorded")
  if ((record?.analyticsBlocking?.observedRequests ?? []).length !== 0) errors.push("analytics request was observed despite blocking")
  if (!Number.isInteger(record?.pendingAnnouncementCount) || record.pendingAnnouncementCount < 0 || record.pendingAnnouncementCount > 1) errors.push("pending announcement count must be between zero and one")
  return errors
}

export function aggregateNavigationRuns(records) {
  const groups = new Map()
  for (const record of records.filter((record) => record.status === "success")) {
    const key = `${record.profile}:${record.target.id}`
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key).push(record)
  }
  return [...groups.entries()].map(([key, group]) => ({
    key,
    profile: group[0].profile,
    target: group[0].target,
    successfulRuns: group.length,
    median: {
      activationToReadyMs: median(group.map((record) => record.activationToReadyMs)),
      fullPageFallbackExposureMs: median(group.map((record) => record.fullPageFallbackExposureMs)),
      routeChunkBytes: median(group.map((record) => record.routeChunkBytes)),
    },
    maximum: {
      fullPageFallbackExposureMs: Math.max(...group.map((record) => record.fullPageFallbackExposureMs)),
      pendingAnnouncementCount: Math.max(...group.map((record) => record.pendingAnnouncementCount)),
    },
  }))
}

function parseArgs(argv) {
  const options = { build: false, serve: false, dryRun: false, outputDir: null, baseUrl: "http://127.0.0.1:4173", runs: RUNS_PER_TARGET_PROFILE }
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index]
    if (argument === "--build") options.build = true
    else if (argument === "--serve") options.serve = true
    else if (argument === "--dry-run") options.dryRun = true
    else if (argument === "--output-dir") options.outputDir = argv[++index]
    else if (argument === "--base-url") options.baseUrl = argv[++index]
    else if (argument === "--runs") options.runs = Number(argv[++index])
    else throw new Error(`Unknown option: ${argument}`)
  }
  return options
}

async function command(commandName, args, { cwd, env }) {
  await new Promise((resolve, reject) => {
    const child = spawn(commandName, args, { cwd, env, stdio: "inherit" })
    child.once("error", reject)
    child.once("exit", (code) => code === 0 ? resolve() : reject(new Error(`${commandName} ${args.join(" ")} exited ${code}`)))
  })
}

async function gitState() {
  const [head, diff, untracked] = await Promise.all([
    execFileAsync("git", ["rev-parse", "HEAD"], { cwd: repoRoot }),
    execFileAsync("git", ["diff", "--binary", "HEAD", "--"], { cwd: repoRoot }),
    execFileAsync("git", ["ls-files", "--others", "--exclude-standard", "-z"], { cwd: repoRoot }),
  ])
  const untrackedFiles = untracked.stdout.split("\0").filter(Boolean).sort()
  const untrackedContent = await Promise.all(untrackedFiles.map(async (relativePath) => {
    const content = await readFile(path.join(repoRoot, relativePath))
    return `${relativePath}\0${createHash("sha256").update(content).digest("hex")}`
  }))
  const fingerprint = createHash("sha256")
    .update(diff.stdout)
    .update(untrackedContent.join("\n"))
    .digest("hex")
  return { headSha: head.stdout.trim(), worktreeFingerprint: fingerprint }
}

async function digestDirectory(directory) {
  const entries = await readdir(directory, { recursive: true, withFileTypes: true })
  const files = entries.filter((entry) => entry.isFile()).sort((left, right) => left.parentPath === right.parentPath
    ? left.name.localeCompare(right.name)
    : left.parentPath.localeCompare(right.parentPath))
  const hash = createHash("sha256")
  for (const entry of files) {
    const filePath = path.join(entry.parentPath, entry.name)
    hash.update(path.relative(directory, filePath))
    hash.update(await readFile(filePath))
  }
  return hash.digest("hex")
}

async function buildArtifactState() {
  const outputPath = path.join(appRoot, "dist")
  return { path: path.relative(repoRoot, outputPath), digest: await digestDirectory(outputPath) }
}

async function startPreviewServer(baseUrl, env) {
  const url = new URL(baseUrl)
  if (url.protocol !== "http:" || url.hostname !== "127.0.0.1" || url.port !== "4173") {
    throw new Error(`First-navigation measurements must use http://127.0.0.1:4173; received ${baseUrl}`)
  }
  const vite = path.join(appRoot, "node_modules", ".bin", "vite")
  const child = spawn(vite, ["preview", "--host", "127.0.0.1", "--port", "4173", "--strictPort"], { cwd: appRoot, env, stdio: "inherit" })
  await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error("Preview server did not become ready")), 15_000)
    child.once("error", reject)
    const poll = async () => {
      try {
        const response = await fetch(baseUrl)
        if (response.ok) {
          clearTimeout(timeout)
          resolve()
          return
        }
      } catch {}
      setTimeout(poll, 200)
    }
    poll()
  })
  return child
}

async function stopPreviewServer(child) {
  if (!child || child.exitCode !== null) return
  child.kill("SIGTERM")
  await new Promise((resolve) => child.once("exit", resolve))
}

function analyticsUrl(url) {
  try {
    return ANALYTICS_HOSTS.includes(new URL(url).hostname)
  } catch {
    return false
  }
}

async function runNavigation({ browser, baseUrl, profile, target }) {
  const context = await browser.newContext({
    viewport: { width: profile.width, height: profile.height },
    isMobile: profile.mobile,
    deviceScaleFactor: 1,
  })
  const observedAnalyticsRequests = []
  await context.route("**/*", async (route) => {
    if (analyticsUrl(route.request().url())) {
      observedAnalyticsRequests.push(route.request().url())
      await route.abort()
      return
    }
    await route.continue()
  })
  const page = await context.newPage()
  const session = await context.newCDPSession(page)
  await session.send("Network.enable")
  await session.send("Network.emulateNetworkConditions", {
    offline: false,
    latency: THROTTLING.rttMs,
    downloadThroughput: (THROTTLING.throughputKbps * 1024) / 8,
    uploadThroughput: (THROTTLING.uploadKbps * 1024) / 8,
    connectionType: "cellular3g",
  })
  await session.send("Emulation.setCPUThrottlingRate", { rate: profile.cpuSlowdownMultiplier })
  try {
    await page.goto(new URL(target.initialPath, baseUrl).href, { waitUntil: "networkidle" })
    await page.waitForSelector(`[data-route-ready="${target.initialPath}"]`)
    await page.locator(target.selector).waitFor()
    await page.evaluate(() => {
      performance.clearResourceTimings()
      const state = { fallbackExposureMs: 0, fallbackStartedAt: null, pendingAnnouncementCount: 0, activationAt: performance.now() }
      const sample = () => {
        const now = performance.now()
        const fallbackVisible = Boolean(document.querySelector("[data-route-loading-fallback]"))
        if (fallbackVisible && state.fallbackStartedAt === null) state.fallbackStartedAt = now
        if (!fallbackVisible && state.fallbackStartedAt !== null) {
          state.fallbackExposureMs += now - state.fallbackStartedAt
          state.fallbackStartedAt = null
        }
        state.pendingAnnouncementCount = document.querySelectorAll("[data-route-transition-pending]").length
      }
      const observer = new MutationObserver(sample)
      observer.observe(document.body, { childList: true, subtree: true })
      sample()
      window.__issue174NavigationObservation = { state, observer, sample }
    })
    await page.locator(target.selector).evaluate((element) => element.click())
    await page.waitForFunction((targetPath) => {
      const ready = document.querySelector("[data-route-ready]")
      return window.location.pathname === targetPath && ready?.getAttribute("data-route-ready") === targetPath
    }, target.targetPath)
    const measurement = await page.evaluate(() => {
      const observation = window.__issue174NavigationObservation
      observation.sample()
      observation.observer.disconnect()
      const now = performance.now()
      if (observation.state.fallbackStartedAt !== null) {
        observation.state.fallbackExposureMs += now - observation.state.fallbackStartedAt
      }
      const routeResources = performance.getEntriesByType("resource")
        .filter((entry) => entry.initiatorType === "script" && entry.startTime >= observation.state.activationAt)
        .map((entry) => ({ name: entry.name, transferSize: entry.transferSize, encodedBodySize: entry.encodedBodySize }))
      return {
        activationToReadyMs: now - observation.state.activationAt,
        fullPageFallbackExposureMs: observation.state.fallbackExposureMs,
        pendingAnnouncementCount: observation.state.pendingAnnouncementCount,
        routeResources,
        routeChunkBytes: routeResources.reduce((total, resource) => total + resource.transferSize, 0),
      }
    })
    return {
      status: "success",
      ...measurement,
      analyticsBlocking: { enabled: true, measurementId: "", blockedHosts: ANALYTICS_HOSTS, observedRequests: observedAnalyticsRequests },
    }
  } finally {
    await context.close()
  }
}

function reportMarkdown(summary) {
  return [
    "# Issue #174 local first-navigation benchmark",
    "",
    `- Start SHA: \`${summary.provenance.start.headSha}\`; build SHA: \`${summary.provenance.sourceAtBuild.headSha}\`; completion SHA: \`${summary.provenance.completion.headSha}\`.`,
    `- Worktree fingerprints: \`${summary.provenance.start.worktreeFingerprint}\` -> \`${summary.provenance.sourceAtBuild.worktreeFingerprint}\` at build -> \`${summary.provenance.completion.worktreeFingerprint}\`.`,
    `- Measured artifact: \`${summary.provenance.buildArtifact.path}\` SHA-256 \`${summary.provenance.buildArtifact.digest}\`, regenerated by \`--build\` before the localhost server starts.`,
    `- Matrix: ${summary.plan.plannedSuccessfulRuns} fresh-context in-app navigations (${summary.plan.runs} runs per target/profile).`,
    `- Throttling: ${THROTTLING.rttMs} ms RTT, ${THROTTLING.throughputKbps} Kbps down, 4x mobile CPU / 1x desktop CPU.`,
    "- Activation uses programmatic `HTMLElement.click()` after the initial route is ready, deliberately avoiding pointer/focus preloading so this remains a first-navigation measurement.",
    "- Telemetry boundary: build uses a blank GA measurement ID and browser routing aborts GA4/GTM requests. No form is submitted; this lane does not validate analytics delivery.",
    "",
    "## Median results",
    "",
    "| Profile | Navigation | Activation to ready | Full-page fallback | Route script bytes | Max delayed announcements |",
    "| --- | --- | ---: | ---: | ---: | ---: |",
    ...summary.aggregates.map((entry) => `| ${entry.profile} | ${entry.target.id} | ${Math.round(entry.median.activationToReadyMs)} ms | ${Math.round(entry.median.fullPageFallbackExposureMs)} ms | ${Math.round(entry.median.routeChunkBytes)} B | ${entry.maximum.pendingAnnouncementCount} |`),
    "",
    `- Validation: ${summary.valid ? "passed" : `failed: ${summary.errors.join(" | ")}`}.`,
    "- This is a local transition harness, not a deployed cold-load/LCP measurement; compare it only with a compatible prior run.",
    "",
  ].join("\n")
}

async function main() {
  const options = parseArgs(process.argv.slice(2))
  const plan = validateNavigationPlan({ runs: options.runs })
  if (options.dryRun) {
    process.stdout.write(`${JSON.stringify({ issue: ISSUE_ID, plan, throttling: THROTTLING, analyticsHosts: ANALYTICS_HOSTS }, null, 2)}\n`)
    return
  }
  if (options.serve && !options.build) {
    throw new Error("Local first-navigation serving requires --build so the measured dist matches recorded source provenance")
  }
  const outputDir = path.resolve(options.outputDir ?? path.join(appRoot, "performance-results", ISSUE_ID, `first-navigation-${new Date().toISOString().replace(/[:.]/g, "-")}`))
  const measurementEnv = { ...process.env, VITE_GA_MEASUREMENT_ID: "" }
  const start = await gitState()
  if (options.build) await command("npm", ["run", "build"], { cwd: appRoot, env: measurementEnv })
  const sourceAtBuild = await gitState()
  const buildArtifact = await buildArtifactState()
  let preview
  let browser
  try {
    if (options.serve) preview = await startPreviewServer(options.baseUrl, measurementEnv)
    browser = await chromium.launch({ headless: true, args: ["--disable-background-networking", "--disable-component-update", "--disable-sync", "--no-first-run"] })
    const records = []
    for (const profile of plan.profiles) {
      for (const target of plan.targets) {
        for (let runNumber = 1; runNumber <= plan.runs; runNumber += 1) {
          const record = { profile: profile.id, target, runNumber, ...(await runNavigation({ browser, baseUrl: options.baseUrl, profile, target })) }
          records.push(record)
          process.stdout.write(`${record.status.toUpperCase()} ${profile.id} ${target.id} run ${runNumber}\n`)
        }
      }
    }
    const completion = await gitState()
    const errors = records.flatMap((record) => navigationRecordValidationErrors(record).map((error) => `${record.profile} ${record.target.id} run ${record.runNumber}: ${error}`))
    if (sourceAtBuild.headSha !== completion.headSha) errors.push("HEAD changed after the measured build")
    if (sourceAtBuild.worktreeFingerprint !== completion.worktreeFingerprint) errors.push("worktree changed after the measured build")
    const summary = {
      issue: ISSUE_ID,
      method: "Playwright first-navigation route-transition benchmark",
      generatedAt: new Date().toISOString(),
      environment: { nodeVersion: process.version, platform: os.platform(), baseUrl: options.baseUrl },
      provenance: { start, sourceAtBuild, buildArtifact, completion },
      plan,
      throttling: THROTTLING,
      telemetryBoundary: { analyticsMeasurementId: "", blockedHosts: ANALYTICS_HOSTS, contactFormSubmitted: false, analyticsDeliveryValidated: false },
      records,
      aggregates: aggregateNavigationRuns(records),
      valid: errors.length === 0,
      errors,
    }
    await mkdir(outputDir, { recursive: true })
    await writeFile(path.join(outputDir, "summary.json"), JSON.stringify(summary, null, 2))
    await writeFile(path.join(outputDir, "report.md"), reportMarkdown(summary))
    if (!summary.valid) throw new Error(`First-navigation benchmark invalid: ${errors.join(" | ")}`)
    process.stdout.write(`First-navigation benchmark complete: ${outputDir}\n`)
  } finally {
    await browser?.close()
    await stopPreviewServer(preview)
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === scriptPath) {
  main().catch((error) => {
    process.stderr.write(`${error.stack ?? error}\n`)
    process.exitCode = 1
  })
}
