#!/usr/bin/env node

import { spawnSync } from "node:child_process"
import { resolve } from "node:path"
import { fileURLToPath, pathToFileURL } from "node:url"

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
    !report ||
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
    if (resolveAdvisories(report, name).length === 0) {
      throw new Error(`npm audit returned an unresolved vulnerability chain at ${name}`)
    }
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

function resolveAdvisories(report, vulnerabilityName, visiting = new Set()) {
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
      return resolveAdvisories(report, via, nextVisiting)
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

export function checkAudits(audit = runAudit, log = console.log) {
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

  if (fullVulnerabilities.length > 0) {
    failWithVulnerabilities(
      "Full dependency tree contains moderate-or-higher vulnerabilities:",
      fullReport,
      fullVulnerabilities
    )
  }

  log("Full dependency audit passed")
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    checkAudits()
  } catch (error) {
    console.error(error instanceof Error ? error.message : error)
    process.exitCode = 1
  }
}
