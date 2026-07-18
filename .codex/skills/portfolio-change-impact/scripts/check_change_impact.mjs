#!/usr/bin/env node

import { spawnSync } from "node:child_process"
import {
  existsSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  renameSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs"
import { tmpdir } from "node:os"
import path from "node:path"

const CHECKS = [
  {
    id: "generated-public",
    label: "Generated public artifacts",
    surface: "canonical content and checked-in public artifacts",
    requiredSync: "Regenerate public artifacts from canonical data and commit the aligned outputs.",
    skills: ["$portfolio-content-sync", "$ai-discovery-maintainer"],
    paths: [
      /^main\/src\/data\//,
      /^main\/scripts\/generate-public-artifacts\.mjs$/,
      /^main\/package\.json$/,
      /^main\/public\/(?:portfolio\.json|ai-summary\.txt|llms\.txt|sitemap\.xml)$/,
    ],
    command: ["npm", "run", "generate:public", "--", "--check"],
  },
  {
    id: "content-sync",
    label: "Portfolio content sync",
    surface: "visible portfolio content, route metadata, and public content mirrors",
    requiredSync: "Keep canonical app data, recruiter-facing copy, public metadata, and route slugs aligned.",
    skills: ["$portfolio-content-sync"],
    paths: [
      /^main\/src\/data\//,
      /^main\/public\/(?:portfolio\.json|ai-summary\.txt|llms\.txt|sitemap\.xml)$/,
    ],
    command: [
      "node",
      ".codex/skills/portfolio-content-sync/scripts/check_content_sync.mjs",
      "{repo}",
    ],
  },
  {
    id: "resume-assets",
    label: "Resume asset alignment",
    surface: "resume route, canonical PDF, preview image, redirects, and public resume links",
    requiredSync: "Keep the canonical resume files and every public reference to them aligned.",
    skills: ["$resume-site-sync"],
    paths: [
      /^main\/public\/(?:waffyAhmedResume\.pdf|resume-preview\.png|_redirects|portfolio\.json|llms\.txt)$/,
      /^main\/src\/data\/profile\.js$/,
      /^main\/src\/pages\/Resume\.jsx$/,
    ],
    command: [
      "node",
      ".codex/skills/resume-site-sync/scripts/check_resume_assets.mjs",
      "{repo}",
    ],
  },
  {
    id: "spa-seo",
    label: "SPA and SEO alignment",
    surface: "routes, canonical metadata, crawler discovery, redirects, and 404 behavior",
    requiredSync: "Keep canonical lowercase routes, legacy redirects, sitemap entries, and metadata aligned.",
    skills: ["$seo-spa-auditor"],
    paths: [
      /^main\/src\/(?:App\.jsx|components\/Seo\.jsx|data\/(?:seo|caseStudySeo)\.js|pages\/NotFound\.jsx)$/,
      /^main\/scripts\/(?:export|prerender)-route-metadata\.mjs$/,
      /^main\/public\/(?:404\.html|sitemap\.xml|robots\.txt|_redirects)$/,
      /^main\/index\.html$/,
      /^netlify\.toml$/,
    ],
    command: [
      "node",
      ".codex/skills/seo-spa-auditor/scripts/check_spa_seo.mjs",
      "{repo}",
    ],
  },
  {
    id: "ai-discovery",
    label: "AI discovery alignment",
    surface: "AI-readable portfolio data, summaries, JSON-LD links, and discovery endpoints",
    requiredSync: "Keep AI-readable artifacts derived from canonical engineering content and discovery links aligned.",
    skills: ["$ai-discovery-maintainer"],
    paths: [
      /^main\/src\/data\//,
      /^main\/scripts\/generate-public-artifacts\.mjs$/,
      /^main\/public\/(?:portfolio\.json|ai-summary\.txt|llms\.txt|sitemap\.xml)$/,
      /^main\/index\.html$/,
    ],
    command: [
      "node",
      ".codex/skills/ai-discovery-maintainer/scripts/check_ai_discovery.mjs",
      "{repo}",
    ],
  },
  {
    id: "csp-jsonld",
    label: "CSP JSON-LD hash",
    surface: "inline JSON-LD and the Netlify Content-Security-Policy hash",
    requiredSync: "Recompute the CSP script hash whenever the inline JSON-LD payload changes.",
    skills: ["$csp-security-header-maintainer"],
    paths: [/^main\/index\.html$/, /^netlify\.toml$/],
    command: [
      "node",
      ".codex/skills/csp-security-header-maintainer/scripts/check_csp_jsonld_hash.mjs",
      "{repo}",
    ],
  },
  {
    id: "ga4-events",
    label: "GA4 event contract",
    surface: "analytics initialization, event call sites, tests, docs, and key-event metadata",
    requiredSync: "Keep emitted events, tests, analytics docs, and public key-event metadata aligned.",
    skills: ["$ga4-portfolio-analytics"],
    paths: [
      /^main\/src\/(?:utils\/analytics\.js|hooks\/usePageTracking\.jsx|App\.test\.jsx)$/,
      /^main\/src\/(?:components\/(?:ContactForm|ProjectCard|SocialLinks)|pages\/(?:CaseStudies|CaseStudy|Home|Resume))\.jsx$/,
      /^docs\/analytics\.md$/,
      /^README\.md$/,
      /^main\/public\/portfolio\.json$/,
    ],
    patchPaths: [/^main\/src\/.*\.(?:jsx?|tsx?)$/],
    patchPattern: /(?:trackEvent|trackLinkClick|utils\/analytics|\bgtag\b|page_view|resume_download|contact_form_|project_source_click|case_study_)/,
    command: [
      "node",
      ".codex/skills/ga4-portfolio-analytics/scripts/check_ga4_events.mjs",
      "{repo}",
    ],
  },
  {
    id: "frontend-performance",
    label: "Frontend performance policy",
    surface: "route loading, image loading priority, and frontend delivery policy",
    requiredSync: "Preserve eager homepage loading, lazy secondary routes, and explicit image loading policy.",
    skills: ["$portfolio-performance-auditor"],
    paths: [
      /^main\/src\/(?:App\.jsx|pages\/.*\.jsx|components\/.*\.jsx|.*\.css)$/,
      /^main\/src\/images\//,
      /^main\/public\/.*\.(?:avif|gif|jpe?g|png|svg|webp)$/i,
      /^main\/(?:vite\.config\.[cm]?[jt]s|package(?:-lock)?\.json)$/,
    ],
    command: [
      "node",
      ".codex/skills/portfolio-performance-auditor/scripts/check_frontend_performance.mjs",
      "{repo}",
    ],
  },
]

function usage() {
  return `Usage: check_change_impact.mjs [options]\n\nOptions:\n  --source staged|worktree  Select changed files (default: worktree)\n  --repo PATH               Repository path (default: current Git repository)\n  --path FILE               Map an explicit path; repeatable\n  --check                   Run the selected validators\n  --format text|json        Report format (default: text)\n  --self-test               Verify representative path-to-check mappings\n  --help                    Show this help\n`
}

function parseArgs(argv) {
  const options = {
    source: "worktree",
    repo: process.cwd(),
    paths: [],
    check: false,
    format: "text",
    selfTest: false,
  }

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]
    if (arg === "--source" || arg === "--repo" || arg === "--path" || arg === "--format") {
      const value = argv[index + 1]
      if (!value) throw new Error(`${arg} requires a value`)
      index += 1
      if (arg === "--source") options.source = value
      if (arg === "--repo") options.repo = value
      if (arg === "--path") options.paths.push(value)
      if (arg === "--format") options.format = value
    } else if (arg === "--check") {
      options.check = true
    } else if (arg === "--self-test") {
      options.selfTest = true
    } else if (arg === "--help" || arg === "-h") {
      process.stdout.write(usage())
      process.exit(0)
    } else {
      throw new Error(`Unknown option: ${arg}`)
    }
  }

  if (!["staged", "worktree"].includes(options.source)) {
    throw new Error(`Unsupported source: ${options.source}`)
  }
  if (!["text", "json"].includes(options.format)) {
    throw new Error(`Unsupported format: ${options.format}`)
  }

  return options
}

function run(command, args, cwd, { allowFailure = false, env = process.env } = {}) {
  const result = spawnSync(command, args, {
    cwd,
    env,
    encoding: "utf8",
    maxBuffer: 16 * 1024 * 1024,
  })

  if (result.error) throw result.error
  if (!allowFailure && result.status !== 0) {
    const detail = [result.stdout, result.stderr].filter(Boolean).join("\n").trim()
    throw new Error(`${command} ${args.join(" ")} failed${detail ? `:\n${detail}` : ""}`)
  }
  return result
}

function git(repo, args, options = {}) {
  return run("git", args, repo, options)
}

function resolveRepo(inputPath) {
  const result = git(path.resolve(inputPath), ["rev-parse", "--show-toplevel"])
  return result.stdout.trim()
}

function splitNullList(value) {
  return value.split("\0").filter(Boolean).map((item) => item.replaceAll("\\", "/"))
}

function uniqueSorted(items) {
  return [...new Set(items)].sort((left, right) => left.localeCompare(right))
}

function collectChangedPaths(repo, source) {
  // Treat renames as a deletion plus an addition so both mapping-relevant paths survive.
  if (source === "staged") {
    return splitNullList(
      git(repo, ["diff", "--cached", "--no-renames", "--name-only", "--diff-filter=ACMRDTUXB", "-z", "--"]).stdout,
    )
  }

  return uniqueSorted([
    ...splitNullList(
      git(repo, ["diff", "--no-renames", "--name-only", "--diff-filter=ACMRDTUXB", "-z", "--"]).stdout,
    ),
    ...splitNullList(
      git(repo, ["diff", "--cached", "--no-renames", "--name-only", "--diff-filter=ACMRDTUXB", "-z", "--"]).stdout,
    ),
    ...splitNullList(git(repo, ["ls-files", "--others", "--exclude-standard", "-z"]).stdout),
  ])
}

function collectPatchTextByPath(repo, source, changedPaths) {
  const untracked = source === "worktree"
    ? new Set(splitNullList(git(repo, ["ls-files", "--others", "--exclude-standard", "-z"]).stdout))
    : new Set()
  const patches = new Map()

  for (const relativePath of changedPaths) {
    const parts = []
    if (source === "staged") {
      parts.push(
        git(repo, ["diff", "--cached", "--no-renames", "--no-ext-diff", "--unified=0", "--", relativePath]).stdout,
      )
    } else {
      parts.push(
        git(repo, ["diff", "--no-renames", "--no-ext-diff", "--unified=0", "--", relativePath]).stdout,
      )
      parts.push(
        git(repo, ["diff", "--cached", "--no-renames", "--no-ext-diff", "--unified=0", "--", relativePath]).stdout,
      )

      if (untracked.has(relativePath)) {
        const fullPath = path.join(repo, relativePath)
        if (existsSync(fullPath) && lstatSync(fullPath).isFile()) {
          const buffer = readFileSync(fullPath)
          if (buffer.length <= 1024 * 1024 && !buffer.includes(0)) parts.push(buffer.toString("utf8"))
        }
      }
    }
    patches.set(relativePath, parts.join("\n"))
  }

  return patches
}

function selectChecks(changedPaths, patchTextByPath = new Map()) {
  return CHECKS.filter(
    (check) =>
      changedPaths.some((changedPath) => check.paths.some((pattern) => pattern.test(changedPath))) ||
      Boolean(
        check.patchPattern &&
          changedPaths.some(
            (changedPath) =>
              check.patchPaths?.some((pattern) => pattern.test(changedPath)) &&
              check.patchPattern.test(patchTextByPath.get(changedPath) ?? ""),
          ),
      ),
  )
}

function reportFor(source, changedPaths, checks) {
  return {
    source,
    changedFiles: changedPaths,
    affectedSurfaces: uniqueSorted(checks.map((check) => check.surface)),
    requiredSync: uniqueSorted(checks.map((check) => check.requiredSync)),
    adjacentSkills: uniqueSorted(checks.flatMap((check) => check.skills)),
    validators: checks.map((check) => ({
      id: check.id,
      label: check.label,
      command: check.command.join(" "),
    })),
  }
}

function renderText(report) {
  const lines = [`Portfolio change impact (${report.source})`]
  if (report.changedFiles.length === 0) return `${lines[0]}: no changed files.\n`

  lines.push("", `Changed files (${report.changedFiles.length}):`)
  lines.push(...report.changedFiles.map((file) => `- ${file}`))

  if (report.validators.length === 0) {
    lines.push("", "No portfolio integrity validators matched these paths.")
    lines.push("Use the pre-push lint, test, and build gate when code or release behavior changed.")
    return `${lines.join("\n")}\n`
  }

  lines.push("", "Affected surfaces:", ...report.affectedSurfaces.map((item) => `- ${item}`))
  lines.push("", "Required synchronization:", ...report.requiredSync.map((item) => `- ${item}`))
  lines.push("", "Adjacent skills:", ...report.adjacentSkills.map((item) => `- ${item}`))
  lines.push("", "Selected validators:")
  lines.push(...report.validators.map((item) => `- ${item.label}: ${item.command}`))
  return `${lines.join("\n")}\n`
}

function createIndexSnapshot(repo) {
  const snapshot = mkdtempSync(path.join(tmpdir(), "portfolio-change-impact-"))
  git(repo, ["checkout-index", "--all", "--force", `--prefix=${snapshot}${path.sep}`])

  const sourceModules = path.join(repo, "main", "node_modules")
  const snapshotModules = path.join(snapshot, "main", "node_modules")
  if (existsSync(sourceModules) && !existsSync(snapshotModules)) {
    symlinkSync(sourceModules, snapshotModules, "dir")
  }

  return snapshot
}

function commandFor(check, targetRepo) {
  return check.command.map((part) => (part === "{repo}" ? targetRepo : part))
}

function runChecks(repo, source, checks) {
  let targetRepo = repo
  let snapshot = null
  const results = []

  try {
    if (source === "staged") {
      snapshot = createIndexSnapshot(repo)
      targetRepo = snapshot
    }

    for (const check of checks) {
      const [command, ...args] = commandFor(check, targetRepo)
      process.stdout.write(`change-impact: running ${check.label}\n`)
      const result = run(command, args, targetRepo, { allowFailure: true })
      results.push({
        id: check.id,
        label: check.label,
        status: result.status,
        stdout: result.stdout.trim(),
        stderr: result.stderr.trim(),
      })
      if (result.stdout) process.stdout.write(result.stdout)
      if (result.stderr) process.stderr.write(result.stderr)
    }
  } finally {
    if (snapshot) rmSync(snapshot, { recursive: true, force: true })
  }

  return results
}

function runSelfTest() {
  const cases = [
    ["main/src/data/projects.js", ["generated-public", "content-sync", "ai-discovery"]],
    ["main/src/pages/Resume.jsx", ["resume-assets", "ga4-events", "frontend-performance"]],
    ["main/src/components/Seo.jsx", ["spa-seo", "frontend-performance"]],
    ["main/public/404.html", ["spa-seo"]],
    ["main/scripts/export-route-metadata.mjs", ["spa-seo"]],
    ["main/scripts/prerender-route-metadata.mjs", ["spa-seo"]],
    ["main/index.html", ["spa-seo", "ai-discovery", "csp-jsonld"]],
    ["main/src/images/profilePic.jpg", ["frontend-performance"]],
    ["main/src/utils/analytics.js", ["ga4-events"]],
    ["README.md", ["ga4-events"]],
    [".github/workflows/dev-ci.yml", []],
  ]
  const failures = []

  for (const [file, expected] of cases) {
    const actual = selectChecks([file]).map((check) => check.id)
    if (actual.join("\0") !== expected.join("\0")) {
      failures.push(`${file}: expected [${expected.join(", ")}], got [${actual.join(", ")}]`)
    }
  }

  const dynamicAnalytics = selectChecks(
    ["main/src/components/NewTrackedAction.jsx"],
    new Map([["main/src/components/NewTrackedAction.jsx", '+import { trackEvent } from "../utils/analytics"']]),
  ).map((check) => check.id)
  if (dynamicAnalytics.join("\0") !== ["ga4-events", "frontend-performance"].join("\0")) {
    failures.push(`dynamic analytics call site: got [${dynamicAnalytics.join(", ")}]`)
  }

  const renameFixture = mkdtempSync(path.join(tmpdir(), "portfolio-change-impact-self-test-"))
  try {
    const sourceDirectory = path.join(renameFixture, "main", "src", "data")
    const destinationDirectory = path.join(renameFixture, "archive")
    const sourcePath = path.join(sourceDirectory, "experience.js")
    const destinationPath = path.join(destinationDirectory, "experience.js")

    git(renameFixture, ["init", "--quiet"])
    git(renameFixture, ["config", "diff.renames", "true"])
    mkdirSync(sourceDirectory, { recursive: true })
    writeFileSync(sourcePath, "export const experience = []\n")
    git(renameFixture, ["add", "--all"])
    git(renameFixture, [
      "-c",
      "user.name=Portfolio Change Impact",
      "-c",
      "user.email=change-impact@example.invalid",
      "commit",
      "--quiet",
      "-m",
      "baseline",
    ])

    mkdirSync(destinationDirectory, { recursive: true })
    renameSync(sourcePath, destinationPath)
    git(renameFixture, ["add", "--all"])

    const renamePaths = collectChangedPaths(renameFixture, "staged")
    const expectedRenamePaths = ["archive/experience.js", "main/src/data/experience.js"]
    if (renamePaths.join("\0") !== expectedRenamePaths.join("\0")) {
      failures.push(
        `staged rename paths: expected [${expectedRenamePaths.join(", ")}], got [${renamePaths.join(", ")}]`,
      )
    }

    const renameChecks = selectChecks(renamePaths).map((check) => check.id)
    const expectedRenameChecks = ["generated-public", "content-sync", "ai-discovery"]
    if (renameChecks.join("\0") !== expectedRenameChecks.join("\0")) {
      failures.push(
        `staged rename checks: expected [${expectedRenameChecks.join(", ")}], got [${renameChecks.join(", ")}]`,
      )
    }
  } finally {
    rmSync(renameFixture, { recursive: true, force: true })
  }

  if (failures.length > 0) throw new Error(`Change-impact self-test failed:\n${failures.join("\n")}`)
  process.stdout.write(`Change-impact self-test passed (${cases.length + 3} cases).\n`)
}

function main() {
  try {
    const options = parseArgs(process.argv.slice(2))
    if (options.selfTest) {
      runSelfTest()
      return
    }

    const repo = resolveRepo(options.repo)
    const changedPaths = uniqueSorted(
      options.paths.length > 0 ? options.paths.map((item) => item.replaceAll("\\", "/")) : collectChangedPaths(repo, options.source),
    )
    const patchTextByPath = options.paths.length > 0
      ? new Map()
      : collectPatchTextByPath(repo, options.source, changedPaths)
    const checks = selectChecks(changedPaths, patchTextByPath)
    const report = reportFor(options.source, changedPaths, checks)

    process.stdout.write(options.format === "json" ? `${JSON.stringify(report, null, 2)}\n` : renderText(report))

    if (!options.check || checks.length === 0) return

    const results = runChecks(repo, options.source, checks)
    const failures = results.filter((result) => result.status !== 0)
    if (failures.length === 0) {
      process.stdout.write(`change-impact: ${results.length} validator(s) passed\n`)
      return
    }

    process.stderr.write(`change-impact: ${failures.length} validator(s) failed\n`)
    process.exitCode = 1
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`)
    process.exitCode = 1
  }
}

main()
