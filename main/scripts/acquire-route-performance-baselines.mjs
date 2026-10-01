#!/usr/bin/env node
import { spawn } from "node:child_process"
import { mkdir, rm, writeFile } from "node:fs/promises"
import path from "node:path"
import { fileURLToPath } from "node:url"
import {
  ARTIFACT_PREFIX,
  BASELINE_WINDOW_RUNS,
  REPORT_WORKFLOW_PATH,
} from "./route-performance-report-lib.mjs"

const scriptPath = fileURLToPath(import.meta.url)
const appRoot = path.resolve(path.dirname(scriptPath), "..")
const workflowFile = path.basename(REPORT_WORKFLOW_PATH)

function parseArgs(argv) {
  const options = {
    outputDir: path.join(appRoot, "performance-results", "route-performance-v1", "baselines"),
    repository: process.env.GITHUB_REPOSITORY,
    token: process.env.GITHUB_TOKEN,
    currentRunId: process.env.GITHUB_RUN_ID ?? null,
    currentRunNumber: Number(process.env.GITHUB_RUN_NUMBER ?? 0),
  }
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index]
    if (argument === "--output-dir") options.outputDir = path.resolve(argv[++index])
    else if (argument === "--repository") options.repository = argv[++index]
    else if (argument === "--current-run-id") options.currentRunId = argv[++index]
    else if (argument === "--current-run-number") options.currentRunNumber = Number(argv[++index])
    else throw new Error(`Unknown option: ${argument}`)
  }
  return options
}

async function githubJson(url, token) {
  const response = await fetch(url, {
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${token}`,
      "X-GitHub-Api-Version": "2022-11-28",
    },
  })
  if (!response.ok) throw new Error(`GitHub API ${response.status} for ${new URL(url).pathname}`)
  return response.json()
}

async function download(url, token, outputPath) {
  const response = await fetch(url, {
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${token}`,
      "X-GitHub-Api-Version": "2022-11-28",
    },
    redirect: "follow",
  })
  if (!response.ok) throw new Error(`Artifact download returned ${response.status}`)
  await writeFile(outputPath, Buffer.from(await response.arrayBuffer()))
}

async function unzip(zipPath, outputDir) {
  await new Promise((resolve, reject) => {
    const child = spawn("unzip", ["-q", zipPath, "-d", outputDir], { stdio: ["ignore", "pipe", "pipe"] })
    let diagnostics = ""
    child.stdout.on("data", (chunk) => { diagnostics += chunk })
    child.stderr.on("data", (chunk) => { diagnostics += chunk })
    child.once("error", reject)
    child.once("exit", (code) => code === 0 ? resolve() : reject(new Error(`unzip exited ${code}: ${diagnostics.slice(-2000)}`)))
  })
}

export async function acquireCandidates(options) {
  if (!options.repository || !options.token) {
    return {
      status: "unavailable",
      reason: "GITHUB_REPOSITORY and GITHUB_TOKEN are required",
      candidates: [{ status: "unavailable", runId: null }],
    }
  }
  const apiRoot = `https://api.github.com/repos/${options.repository}`
  const query = new URL(`${apiRoot}/actions/workflows/${workflowFile}/runs`)
  query.searchParams.set("branch", "main")
  query.searchParams.set("status", "success")
  query.searchParams.set("per_page", String(BASELINE_WINDOW_RUNS))
  const runPayload = await githubJson(query, options.token)
  const runs = (runPayload.workflow_runs ?? [])
    .filter((run) => String(run.id) !== String(options.currentRunId))
    .filter((run) => !options.currentRunNumber || run.run_number < options.currentRunNumber)
    .slice(0, BASELINE_WINDOW_RUNS)
  const candidates = []
  for (const run of runs) {
    const artifactPayload = await githubJson(`${apiRoot}/actions/runs/${run.id}/artifacts?per_page=100`, options.token)
    const expectedName = `${ARTIFACT_PREFIX}-${run.id}-${run.run_attempt}`
    const artifact = (artifactPayload.artifacts ?? [])
      .filter((item) => item.name === expectedName)
      .sort((left, right) => right.id - left.id)[0]
    if (!artifact) {
      candidates.push({ status: "missing", runId: String(run.id), runAttempt: run.run_attempt, createdAt: run.created_at, completedAt: run.updated_at })
      continue
    }
    if (artifact.expired) {
      candidates.push({ status: "expired", runId: String(run.id), runAttempt: run.run_attempt, artifactName: artifact.name, createdAt: run.created_at, completedAt: run.updated_at })
      continue
    }
    const artifactDir = path.join(options.outputDir, `run-${run.id}-artifact-${artifact.id}`)
    const zipPath = path.join(options.outputDir, `run-${run.id}-artifact-${artifact.id}.zip`)
    try {
      await rm(artifactDir, { force: true, recursive: true })
      await mkdir(artifactDir, { recursive: true })
      await download(artifact.archive_download_url, options.token, zipPath)
      await unzip(zipPath, artifactDir)
      candidates.push({
        status: "downloaded",
        runId: String(run.id),
        runAttempt: run.run_attempt,
        artifactName: artifact.name,
        artifactDir,
        workflowPath: run.path,
        commitSha: run.head_sha,
        createdAt: run.created_at,
        completedAt: run.updated_at,
      })
    } catch (error) {
      candidates.push({
        status: "unavailable",
        runId: String(run.id),
        runAttempt: run.run_attempt,
        artifactName: artifact.name,
        workflowPath: run.path,
        createdAt: run.created_at,
        completedAt: run.updated_at,
        acquisitionError: error.message,
      })
    } finally {
      await rm(zipPath, { force: true })
    }
  }
  return {
    status: runs.length === 0 ? "first-run" : "complete",
    workflow: workflowFile,
    repository: options.repository,
    boundedWindowRuns: BASELINE_WINDOW_RUNS,
    candidates,
  }
}

async function main() {
  const options = parseArgs(process.argv.slice(2))
  await mkdir(options.outputDir, { recursive: true })
  let result
  try {
    result = await acquireCandidates(options)
  } catch (error) {
    result = {
      status: "unavailable",
      reason: error.message,
      workflow: workflowFile,
      repository: options.repository ?? null,
      boundedWindowRuns: BASELINE_WINDOW_RUNS,
      candidates: [{ status: "unavailable", runId: null, acquisitionError: error.message }],
    }
  }
  const outputPath = path.join(options.outputDir, "candidates.json")
  await writeFile(outputPath, JSON.stringify(result, null, 2))
process.stdout.write(`${outputPath}\n`)
}

if (process.argv[1] && path.resolve(process.argv[1]) === scriptPath) {
  main().catch((error) => {
    process.stderr.write(`${error.stack ?? error}\n`)
    process.exitCode = 1
  })
}
