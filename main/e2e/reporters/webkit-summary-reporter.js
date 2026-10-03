const fs = require("node:fs")
const path = require("node:path")

const evidenceAnnotation = (annotations, type, fallback = "unknown") =>
  annotations.find((annotation) => annotation.type === type)?.description ||
  fallback

const markdownCell = (value) =>
  String(value).replaceAll("|", "\\|").replaceAll("\n", " ")

class WebKitSummaryReporter {
  constructor(options = {}) {
    this.outputDir = path.resolve(options.outputDir || "webkit-results/current")
    this.testRecords = new Map()
    this.startedAt = new Date().toISOString()
  }

  onTestEnd(test, result) {
    const project = test.parent.project()?.name || "unknown-project"
    const key = `${project}:${test.id}`
    const record = this.testRecords.get(key) || {
      id: test.id,
      project,
      title: test.titlePath().slice(1).join(" > "),
      attempts: [],
      test,
    }

    record.attempts.push({
      status: result.status,
      retry: result.retry,
      durationMs: result.duration,
      annotations: test.annotations.map(({ type, description }) => ({
        type,
        description: description || "",
      })),
      attachments: result.attachments
        .filter((attachment) => attachment.path)
        .map((attachment) => ({
          name: attachment.name,
          contentType: attachment.contentType,
          path: path.relative(process.cwd(), attachment.path),
        })),
      error: result.error?.message || null,
    })
    this.testRecords.set(key, record)
  }

  async onEnd(runResult) {
    const projects = new Map()
    const failures = []
    const unsupportedAssertions = []

    for (const record of this.testRecords.values()) {
      const latestAttempt = record.attempts.at(-1)
      const project = projects.get(record.project) || {
        name: record.project,
        total: 0,
        executed: 0,
        passed: 0,
        failed: 0,
        flaky: 0,
        skipped: 0,
        skippedReasons: {},
        runtimes: new Set(),
        viewports: new Set(),
      }
      const annotations = latestAttempt.annotations
      const outcome = record.test.outcome()

      project.total += 1
      project.runtimes.add(evidenceAnnotation(annotations, "browser"))
      project.viewports.add(evidenceAnnotation(annotations, "viewport"))

      if (latestAttempt.status === "skipped") {
        project.skipped += 1
        const reason = evidenceAnnotation(
          annotations,
          "skip",
          "No skip reason recorded"
        )
        project.skippedReasons[reason] =
          (project.skippedReasons[reason] || 0) + 1
      } else {
        project.executed += 1
        if (outcome === "flaky") {
          project.flaky += 1
        } else if (outcome === "expected" && latestAttempt.status === "passed") {
          project.passed += 1
        } else {
          project.failed += 1
        }
      }

      for (const annotation of annotations.filter(
        ({ type }) => type === "unsupported"
      )) {
        unsupportedAssertions.push({
          project: record.project,
          test: record.title,
          reason: annotation.description,
        })
      }

      for (const attempt of record.attempts.filter(({ status }) =>
        ["failed", "timedOut", "interrupted"].includes(status)
      )) {
        failures.push({
          project: record.project,
          test: record.title,
          attempt: attempt.retry + 1,
          status: attempt.status,
          route: evidenceAnnotation(attempt.annotations, "route"),
          browser: evidenceAnnotation(attempt.annotations, "browser"),
          viewport: evidenceAnnotation(attempt.annotations, "viewport"),
          attachments: attempt.attachments,
          error: attempt.error,
        })
      }

      projects.set(record.project, project)
    }

    const serializableProjects = Array.from(projects.values()).map(
      ({ runtimes, viewports, ...project }) => ({
        ...project,
        runtimes: Array.from(runtimes).sort(),
        viewports: Array.from(viewports).sort(),
      })
    )
    const report = {
      schema: "webkit-smoke-report-v1",
      startedAt: this.startedAt,
      completedAt: new Date().toISOString(),
      status: runResult.status,
      projects: serializableProjects,
      failures,
      unsupportedAssertions,
      evidencePolicy: {
        screenshots: "only-on-failure",
        traces: "retain-on-failure",
      },
    }

    fs.mkdirSync(this.outputDir, { recursive: true })
    fs.writeFileSync(
      path.join(this.outputDir, "report.json"),
      `${JSON.stringify(report, null, 2)}\n`
    )
    fs.writeFileSync(
      path.join(this.outputDir, "report.md"),
      this.toMarkdown(report)
    )
  }

  toMarkdown(report) {
    const lines = [
      "# WebKit smoke report",
      "",
      `- Status: **${report.status}**`,
      `- Started: ${report.startedAt}`,
      `- Completed: ${report.completedAt}`,
      "- Evidence: screenshot and trace retained for every failed attempt",
      "",
      "## Project counts",
      "",
      "| Project | Runtime | Viewport | Executed | Passed | Flaky | Failed | Skipped |",
      "| --- | --- | --- | ---: | ---: | ---: | ---: | ---: |",
    ]

    for (const project of report.projects) {
      lines.push(
        `| ${markdownCell(project.name)} | ${markdownCell(project.runtimes.join(", "))} | ${markdownCell(project.viewports.join(", "))} | ${project.executed} | ${project.passed} | ${project.flaky} | ${project.failed} | ${project.skipped} |`
      )
    }

    lines.push("", "## Skipped cases", "")
    const skipped = report.projects.flatMap((project) =>
      Object.entries(project.skippedReasons).map(([reason, count]) => ({
        project: project.name,
        reason,
        count,
      }))
    )
    if (skipped.length === 0) {
      lines.push("None.")
    } else {
      for (const item of skipped) {
        lines.push(
          `- ${item.project}: ${item.count} - ${item.reason}`
        )
      }
    }

    lines.push("", "## Unsupported assertions", "")
    if (report.unsupportedAssertions.length === 0) {
      lines.push("None.")
    } else {
      for (const item of report.unsupportedAssertions) {
        lines.push(`- ${item.project} - ${item.test}: ${item.reason}`)
      }
    }

    lines.push("", "## Failed attempts", "")
    if (report.failures.length === 0) {
      lines.push("None.")
    } else {
      for (const failure of report.failures) {
        lines.push(
          `### ${failure.project}: ${failure.test} (attempt ${failure.attempt})`,
          "",
          `- Status: ${failure.status}`,
          `- Route: ${failure.route}`,
          `- Browser: ${failure.browser}`,
          `- Viewport: ${failure.viewport}`,
          `- Evidence: ${
            failure.attachments.length > 0
              ? failure.attachments
                  .map(({ name, path: attachmentPath }) =>
                    `${name} (${attachmentPath})`
                  )
                  .join(", ")
              : "none"
          }`,
          `- Error: ${failure.error ? failure.error.split("\n")[0] : "none"}`,
          ""
        )
      }
    }

    return `${lines.join("\n")}\n`
  }
}

module.exports = WebKitSummaryReporter
