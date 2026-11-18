#!/usr/bin/env node

import { spawnSync } from "node:child_process"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { fileURLToPath, pathToFileURL } from "node:url"
import { isDeepStrictEqual } from "node:util"

const severityRank = {
  info: 0,
  low: 1,
  moderate: 2,
  high: 3,
  critical: 4,
}

const minimumSeverity = severityRank.moderate

function runAudit(extraArgs) {
  const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm"
  const result = spawnSync(
    npmCommand,
    ["audit", "--json", "--audit-level=moderate", ...extraArgs],
    {
      cwd: fileURLToPath(new URL("..", import.meta.url)),
      encoding: "utf8",
      maxBuffer: 10 * 1024 * 1024,
    }
  )

  return validateAuditResult(result)
}

export function validateAuditResult(result) {
  if (result.error) {
    throw new Error(`npm audit could not start: ${result.error.message}`)
  }

  if (result.signal || ![0, 1].includes(result.status)) {
    throw new Error(
      `npm audit failed unexpectedly (status ${result.status}, signal ${result.signal ?? "none"})`
    )
  }

  let report
  try {
    report = JSON.parse(result.stdout)
  } catch {
    throw new Error(
      `npm audit returned malformed JSON${result.stderr ? `: ${result.stderr.trim()}` : ""}`
    )
  }

  if (
    !report || Object.hasOwn(report, "error") ||
    report.auditReportVersion !== 2 ||
    !report.vulnerabilities ||
    typeof report.vulnerabilities !== "object" ||
    Array.isArray(report.vulnerabilities)
  ) {
    throw new Error("npm audit did not return a version 2 vulnerability report")
  }

  for (const [name, vulnerability] of Object.entries(report.vulnerabilities)) {
    if (!vulnerability || typeof vulnerability !== "object" || Array.isArray(vulnerability) ||
        !Object.hasOwn(severityRank, vulnerability.severity)) {
      throw new Error(`npm audit returned an unknown vulnerability severity for ${name}`)
    }
    const advisories = resolveAdvisories(report, name)
    if (advisories.length === 0) {
      throw new Error(`npm audit returned an unresolved vulnerability chain at ${name}`)
    }
    if (advisories.some((advisory) => severityRank[advisory.severity] > severityRank[vulnerability.severity])) {
      throw new Error(`npm audit understates the advisory severity for ${name}`)
    }
  }

  if (report.metadata !== undefined) {
    const counts = report.metadata?.vulnerabilities
    const findings = Object.values(report.vulnerabilities)
    if (counts?.total !== findings.length || Object.keys(severityRank).some((level) =>
      counts[level] !== findings.filter((finding) => finding.severity === level).length
    )) throw new Error("npm audit vulnerability counts disagree with its findings")
  }

  const hasBlockingVulnerabilities =
    blockingVulnerabilities(report).length > 0
  if ((result.status === 1) !== hasBlockingVulnerabilities) {
    throw new Error(
      `npm audit exit status ${result.status} does not match its moderate-or-higher findings`
    )
  }

  return report
}

function isModerateOrHigher(vulnerability) {
  const rank = severityRank[vulnerability.severity]
  return rank === undefined || rank >= minimumSeverity
}

function blockingVulnerabilities(report) {
  return Object.entries(report.vulnerabilities).filter(([, vulnerability]) =>
    isModerateOrHigher(vulnerability)
  )
}

function resolveAdvisories(report, vulnerabilityName, visiting = new Set(), packages = new Set()) {
  packages.add(vulnerabilityName)
  if (visiting.has(vulnerabilityName)) {
    // npm's metavulnerability graph can cycle; another edge can still reach
    // the underlying advisory. Only stop revisiting this branch.
    return []
  }

  const vulnerability = report.vulnerabilities[vulnerabilityName]
  if (!vulnerability || !Array.isArray(vulnerability.via)) {
    throw new Error(
      `npm audit returned an unresolved vulnerability chain at ${vulnerabilityName}`
    )
  }

  const nextVisiting = new Set(visiting)
  nextVisiting.add(vulnerabilityName)

  return vulnerability.via.flatMap((via) => {
    if (typeof via === "string") {
      if (!Object.hasOwn(report.vulnerabilities, via)) {
        throw new Error(
          `npm audit referenced unknown vulnerability ${via} from ${vulnerabilityName}`
        )
      }
      return resolveAdvisories(report, via, nextVisiting, packages)
    }

    if (!via || typeof via !== "object" || Array.isArray(via) ||
        typeof via.name !== "string" || !via.name ||
        typeof via.url !== "string" || !via.url ||
        !Object.hasOwn(severityRank, via.severity)) {
      throw new Error(
        `npm audit returned malformed advisory data for ${vulnerabilityName}`
      )
    }

    return [
      {
        packageName: via.name,
        url: via.url,
        dependency: via.dependency,
        sourcePackage: vulnerabilityName,
        severity: via.severity,
        range: via.range,
      },
    ]
  })
}

function describeVulnerability(report, [name, vulnerability]) {
  const advisories = [...new Set(resolveAdvisories(report, name)
    .map((advisory) => advisory.url))]
    .join(", ")
  return `${name} (${vulnerability.severity ?? "unknown"}): ${advisories}`
}

function failWithVulnerabilities(message, report, vulnerabilities) {
  const details = vulnerabilities
    .map((vulnerability) => describeVulnerability(report, vulnerability))
    .join("\n- ")
  throw new Error(`${message}\n- ${details}`)
}

const packageNamePattern = /^(?:@[a-z0-9-][a-z0-9._-]*\/)?[a-z0-9-][a-z0-9._-]*$/
const exactVersionPattern = /^(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)$/
const isRecord = (value) => value !== null && typeof value === "object" && !Array.isArray(value)
const matches = (value, pattern) => typeof value === "string" && pattern.test(value)

function reviewedTime(value) {
  if (typeof value !== "string" || !/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\dZ$/.test(value)) return NaN
  const time = Date.parse(value)
  return Number.isFinite(time) && new Date(time).toISOString() === value.replace("Z", ".000Z") ? time : NaN
}

function validFixSuggestion(fix) {
  return fix === true || (isRecord(fix) && Object.keys(fix).length === 3 &&
    matches(fix.name, packageNamePattern) && matches(fix.version, exactVersionPattern) &&
    fix.isSemVerMajor === true)
}

function validateExceptions({ exceptions, lock, now }) {
  if (!Array.isArray(exceptions) || lock?.lockfileVersion !== 3 || !isRecord(lock.packages) ||
      !Number.isFinite(now)) throw new Error("Invalid audit exception registry, clock or lockfile")

  const ids = new Set()
  for (const entry of exceptions) {
    if (!isRecord(entry)) throw new Error("Invalid audit exception entry")
    const created = reviewedTime(entry.createdAt)
    const reviewed = reviewedTime(entry.reviewedAt)
    const expires = reviewedTime(entry.expiresAt)
    if (!(created <= reviewed && reviewed <= now && now < expires && expires - created <= 30 * 86400_000)) {
      throw new Error(`Expired or invalid audit exception review window: ${entry.tracker}`)
    }
    if (!matches(entry.package, packageNamePattern) ||
        !matches(entry.advisory, /^https:\/\/github\.com\/advisories\/GHSA-[a-z0-9]{4}-[a-z0-9]{4}-[a-z0-9]{4}$/) ||
        ids.has(entry.advisory) || !["moderate", "high"].includes(entry.severity) ||
        !matches(entry.affectedRange, /^<=\d+\.\d+\.\d+$/) ||
        !matches(entry.owner, /^@[a-z\d](?:[a-z\d-]{0,37}[a-z\d])?$/i) ||
        !matches(entry.tracker, /^https:\/\/github\.com\/waffy1901\/personalWebsite\/issues\/[1-9]\d*$/) ||
        typeof entry.reason !== "string" || !entry.reason.trim() ||
        !isRecord(entry.nodes) || !Object.keys(entry.nodes).length) {
      throw new Error("Invalid audit exception metadata")
    }
    ids.add(entry.advisory)
    for (const [path, spec] of Object.entries(entry.nodes)) {
      const parts = path.split("node_modules/")
      const name = parts.at(-1)
      const installed = lock.packages[path]
      if (parts.length < 2 || parts[0] !== "" || !packageNamePattern.test(name) ||
          parts.slice(1, -1).some((parent) => !parent.endsWith("/") || !packageNamePattern.test(parent.slice(0, -1))) ||
          !isRecord(spec) || !matches(spec.version, exactVersionPattern) ||
          !Array.isArray(spec.npmFixSuggestions) || !spec.npmFixSuggestions.every(validFixSuggestion) ||
          !isRecord(installed) || installed.dev !== true || installed.devOptional || installed.link ||
          (installed.name !== undefined && installed.name !== name) || installed.version !== spec.version) {
        throw new Error(`Invalid or changed dev-only audit exception node: ${path}`)
      }
    }
  }
  return exceptions
}

function loadPolicy() {
  const read = (path) => JSON.parse(readFileSync(new URL(path, import.meta.url), "utf8"))
  return { exceptions: read("./npm-audit-exceptions.json"), lock: read("../package-lock.json"), now: Date.now() }
}

function matchingException(report, name, exceptions) {
  const packages = new Set()
  const advisories = resolveAdvisories(report, name, new Set(), packages)
  return exceptions.find((entry) => advisories.every((advisory) =>
    advisory.url === entry.advisory && advisory.packageName === entry.package &&
    advisory.sourcePackage === entry.package && advisory.dependency === entry.package &&
    advisory.severity === entry.severity && advisory.range === entry.affectedRange
  ) && [...packages].every((dependency) => {
    const finding = report.vulnerabilities[dependency]
    return finding.name === dependency && severityRank[finding.severity] <= severityRank[entry.severity] &&
      Array.isArray(finding.nodes) && finding.nodes.length > 0 &&
      new Set(finding.nodes).size === finding.nodes.length && finding.nodes.every((path) => {
        if (typeof path !== "string" || !Object.hasOwn(entry.nodes, path) ||
            path.split("node_modules/").at(-1) !== dependency) return false
        return finding.fixAvailable === false || entry.nodes[path].npmFixSuggestions
          .some((suggestion) => isDeepStrictEqual(suggestion, finding.fixAvailable))
      })
  }))
}

export function checkAudits(audit = runAudit, log = console.log, policy) {
  const productionReport = audit([
    "--omit=dev",
    "--include=optional",
    "--include=peer",
  ])
  const productionVulnerabilities = blockingVulnerabilities(productionReport)

  if (productionVulnerabilities.length > 0) {
    failWithVulnerabilities(
      "Production dependencies contain moderate-or-higher vulnerabilities:",
      productionReport,
      productionVulnerabilities
    )
  }

  log("Production dependency audit passed")

  const fullReport = audit([
    "--include=dev",
    "--include=optional",
    "--include=peer",
  ])
  const fullVulnerabilities = blockingVulnerabilities(fullReport)
  const exceptions = validateExceptions(policy === undefined ? loadPolicy() : policy)
  const blocking = fullVulnerabilities.filter(([name]) => {
    const entry = matchingException(fullReport, name, exceptions)
    if (!entry) return true
    log(`Waived dev audit finding: ${name} - ${entry.advisory} (tracker ${entry.tracker}, expires ${entry.expiresAt})`)
    return false
  })
  if (blocking.length > 0) {
    failWithVulnerabilities(
      "Full dependency tree contains moderate-or-higher vulnerabilities:",
      fullReport,
      blocking
    )
  }

  log(fullVulnerabilities.length
    ? `Full dependency audit passed with ${fullVulnerabilities.length} waived development package findings`
    : "Full dependency audit passed")
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    checkAudits()
  } catch (error) {
    console.error(error instanceof Error ? error.message : error)
    process.exitCode = 1
  }
}
