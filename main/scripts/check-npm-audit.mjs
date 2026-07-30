#!/usr/bin/env node

import { spawnSync } from "node:child_process"
import { readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"

const severityRank = {
  info: 0,
  low: 1,
  moderate: 2,
  high: 3,
  critical: 4,
}

const minimumSeverity = severityRank.moderate
const allowedDevAdvisory = {
  packageName: "brace-expansion",
  url: "https://github.com/advisories/GHSA-mh99-v99m-4gvg",
}
const allowedDevVulnerabilityPolicy = new Map([
  [
    "@eslint/config-array",
    {
      isDirect: false,
      via: ["minimatch"],
      effects: ["eslint"],
    },
  ],
  [
    "@eslint/eslintrc",
    {
      isDirect: false,
      via: ["minimatch"],
      effects: ["eslint"],
    },
  ],
  [
    "brace-expansion",
    {
      isDirect: false,
      via: [],
      effects: ["minimatch"],
    },
  ],
  [
    "eslint",
    {
      isDirect: true,
      via: ["@eslint/config-array", "@eslint/eslintrc", "minimatch"],
      effects: [],
    },
  ],
  [
    "eslint-plugin-react",
    {
      isDirect: true,
      via: ["minimatch"],
      effects: [],
    },
  ],
  [
    "minimatch",
    {
      isDirect: false,
      via: ["brace-expansion"],
      effects: [
        "@eslint/config-array",
        "@eslint/eslintrc",
        "eslint",
        "eslint-plugin-react",
      ],
    },
  ],
])
const allowedBraceExpansionVersion = "1.1.17"

const packageLockPath = fileURLToPath(
  new URL("../package-lock.json", import.meta.url)
)
const packageLock = JSON.parse(readFileSync(packageLockPath, "utf8"))

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

function hasExactValues(actual, expected) {
  if (!Array.isArray(actual) || actual.length !== expected.length) {
    return false
  }

  const actualValues = new Set(actual)
  const expectedValues = new Set(expected)
  return (
    actualValues.size === actual.length &&
    expectedValues.size === expected.length &&
    actualValues.size === expectedValues.size &&
    actual.every((value) => expectedValues.has(value))
  )
}

function isAllowedDevVulnerability(report, [name, vulnerability]) {
  const policy = allowedDevVulnerabilityPolicy.get(name)
  if (
    name !== vulnerability.name ||
    !policy ||
    vulnerability.isDirect !== policy.isDirect
  ) {
    return false
  }

  const rootPackage = packageLock.packages?.[""] ?? {}
  const directDependencies = new Set(
    [
      rootPackage.dependencies,
      rootPackage.devDependencies,
      rootPackage.optionalDependencies,
      rootPackage.peerDependencies,
    ].flatMap((dependencies) => Object.keys(dependencies ?? {}))
  )
  if (directDependencies.has(name) !== policy.isDirect) {
    return false
  }

  const allowedLeaf =
    packageLock.packages?.["node_modules/brace-expansion"]
  if (
    allowedLeaf?.version !== allowedBraceExpansionVersion ||
    allowedLeaf.dev !== true
  ) {
    return false
  }

  if (
    !Array.isArray(vulnerability.via) ||
    !hasExactValues(
      vulnerability.via.filter((via) => typeof via === "string"),
      policy.via
    ) ||
    !hasExactValues(vulnerability.effects, policy.effects)
  ) {
    return false
  }

  const directAdvisories = vulnerability.via.filter(
    (via) => typeof via === "object" && via !== null
  )
  if (
    (name === allowedDevAdvisory.packageName &&
      directAdvisories.length !== 1) ||
    (name !== allowedDevAdvisory.packageName &&
      directAdvisories.length !== 0)
  ) {
    return false
  }

  const advisories = resolveAdvisories(report, name)
  if (
    advisories.length === 0 ||
    advisories.some(
      (advisory) =>
        advisory.packageName !== allowedDevAdvisory.packageName ||
        advisory.url !== allowedDevAdvisory.url
    )
  ) {
    return false
  }

  if (
    !Array.isArray(vulnerability.nodes) ||
    vulnerability.nodes.length !== 1
  ) {
    return false
  }

  const [nodePath] = vulnerability.nodes
  const lockedPackage = packageLock.packages?.[nodePath]
  return nodePath === `node_modules/${name}` && lockedPackage?.dev === true
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
  const unexpectedVulnerabilities = fullVulnerabilities.filter(
    (vulnerability) => !isAllowedDevVulnerability(fullReport, vulnerability)
  )

  if (unexpectedVulnerabilities.length > 0) {
    failWithVulnerabilities(
      "Unexpected moderate-or-higher vulnerabilities found:",
      fullReport,
      unexpectedVulnerabilities
    )
  }

  if (fullVulnerabilities.length === 0) {
    console.log(
      "Full dependency audit passed; the temporary dev-only advisory exception can be removed"
    )
  } else {
    console.log(
      `Allowed ${fullVulnerabilities.length} known dev-only ESLint/minimatch entries derived solely from ${allowedDevAdvisory.url}`
    )
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : error)
  process.exitCode = 1
}
