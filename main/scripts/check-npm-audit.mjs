#!/usr/bin/env node

import { spawnSync } from "node:child_process"
import { fileURLToPath } from "node:url"

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
    report.auditReportVersion !== 2 ||
    !report.vulnerabilities ||
    typeof report.vulnerabilities !== "object" ||
    Array.isArray(report.vulnerabilities)
  ) {
    throw new Error("npm audit did not return a version 2 vulnerability report")
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
    throw new Error(
      `npm audit returned a cyclic vulnerability chain at ${vulnerabilityName}`
    )
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
      if (!report.vulnerabilities[via]) {
        throw new Error(
          `npm audit referenced unknown vulnerability ${via} from ${vulnerabilityName}`
        )
      }
      return resolveAdvisories(report, via, nextVisiting)
    }

    if (!via || typeof via !== "object") {
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
  const advisories = resolveAdvisories(report, name)
    .map((advisory) => advisory.url ?? "unknown advisory")
    .join(", ")
  return `${name} (${vulnerability.severity ?? "unknown"}): ${advisories}`
}

function failWithVulnerabilities(message, report, vulnerabilities) {
  const details = vulnerabilities
    .map((vulnerability) => describeVulnerability(report, vulnerability))
    .join("\n- ")
  throw new Error(`${message}\n- ${details}`)
}

try {
  const productionReport = runAudit([
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

  console.log("Production dependency audit passed")

  const fullReport = runAudit([
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

  console.log("Full dependency audit passed")
} catch (error) {
  console.error(error instanceof Error ? error.message : error)
  process.exitCode = 1
}
