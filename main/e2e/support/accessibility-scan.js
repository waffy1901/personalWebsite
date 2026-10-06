const AxeBuilder = require("@axe-core/playwright").default
const { expect } = require("@playwright/test")

const blockingImpacts = new Set(["critical", "serious"])

async function waitForFiniteAnimations(page) {
  await page.evaluate(async () => {
    const finiteAnimations = globalThis.document
      .getAnimations({ subtree: true })
      .filter((animation) => {
        const endTime = animation.effect?.getComputedTiming().endTime
        return animation.playState === "running" && Number.isFinite(endTime)
      })

    await Promise.allSettled(
      finiteAnimations.map((animation) => animation.finished)
    )
  })
}

const compact = (value, limit = 500) => {
  const normalized = String(value).replace(/\s+/g, " ").trim()
  return normalized.length > limit
    ? `${normalized.slice(0, limit - 3)}...`
    : normalized
}

function formatViolation(violation) {
  const nodes = violation.nodes
    .map(
      (node, index) =>
        [
          `    affected node ${index + 1}: ${JSON.stringify(node.target)}`,
          `      html: ${compact(node.html)}`,
          `      remediation: ${compact(node.failureSummary || violation.help)}`,
        ].join("\n")
    )
    .join("\n")

  return [
    `  rule=${violation.id} impact=${violation.impact || "unknown"}`,
    `    help: ${violation.help}`,
    `    remediation URL: ${violation.helpUrl}`,
    nodes,
  ].join("\n")
}

function formatBlockingViolations({ route, state, violations }) {
  return [
    `Accessibility scan failed: route=${route} state=${state}`,
    ...violations.map(formatViolation),
  ].join("\n")
}

const toArtifactName = (route, state) =>
  `axe-${route === "/" ? "home" : route}-${state}`
    .replace(/[^a-z0-9-]+/gi, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase()

async function expectNoBlockingAccessibilityViolations({
  page,
  route,
  state,
  testInfo,
}) {
  // Wait only for finite animations that are currently active. Infinite
  // decorative animations remain untouched, and no accessibility rules or
  // page regions are disabled while the rendered state settles.
  await waitForFiniteAnimations(page)

  // Axe's default rules include WCAG checks plus semantic, landmark, ARIA,
  // and other best-practice rules. No rules or page regions are excluded.
  const results = await new AxeBuilder({ page }).analyze()
  const blockingViolations = results.violations.filter((violation) =>
    blockingImpacts.has(violation.impact)
  )
  const advisoryViolations = results.violations.filter(
    (violation) => !blockingImpacts.has(violation.impact)
  )

  if (results.violations.length > 0) {
    await testInfo.attach(toArtifactName(route, state), {
      body: Buffer.from(
        JSON.stringify(
          {
            route,
            state,
            violations: results.violations,
          },
          null,
          2
        )
      ),
      contentType: "application/json",
    })
  }

  if (advisoryViolations.length > 0) {
    testInfo.annotations.push({
      type: "accessibility-advisory",
      description: `${route} ${state}: ${advisoryViolations
        .map((violation) => `${violation.id} (${violation.impact || "unknown"})`)
        .join(", ")}`,
    })
  }

  expect(
    blockingViolations.length,
    formatBlockingViolations({ route, state, violations: blockingViolations })
  ).toBe(0)

  return results
}

module.exports = {
  expectNoBlockingAccessibilityViolations,
}
