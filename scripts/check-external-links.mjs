#!/usr/bin/env node

import { spawn } from "node:child_process";
import { lstat, mkdir, readFile, readdir, realpath, rm, writeFile } from "node:fs/promises";
import { isIP } from "node:net";
import path from "node:path";
import process from "node:process";
import { fileURLToPath, pathToFileURL } from "node:url";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_ROOT = path.resolve(SCRIPT_DIR, "..");
const DEFAULT_OUTPUT_DIR = path.join(DEFAULT_ROOT, "external-link-results", "current");
const DEFAULT_CONFIG = path.join(SCRIPT_DIR, "external-links.toml");
const INPUT_FILES = [
  "main/public/portfolio.json",
  "main/public/ai-summary.txt",
  "main/public/llms.txt",
];
const README_FILES = ["README.md", "main/README.md"];
const README_START = "<!-- generated-public-docs:start -->";
const README_END = "<!-- generated-public-docs:end -->";
const BLOCKED_CODES = new Set([401, 403, 407, 418, 429, 451, 999]);
const RETRYABLE_CODES = new Set([408, 429]);
const MAX_ELIGIBLE_URLS = 200;
const REPORT_SCHEMA = "external-link-report-v1";
const INVENTORY_SCHEMA = "external-link-inventory-v1";

class CheckerError extends Error {
  constructor(message, code = "SETUP_ERROR") {
    super(message);
    this.name = "CheckerError";
    this.code = code;
  }
}

function parseArguments(argv) {
  const options = {
    root: DEFAULT_ROOT,
    outputDir: DEFAULT_OUTPUT_DIR,
    config: DEFAULT_CONFIG,
    lychee: process.env.LYCHEE_BIN || "lychee",
    inventoryOnly: false,
    allowLoopbackFixtures: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    const valueOptions = new Map([
      ["--root", "root"],
      ["--output-dir", "outputDir"],
      ["--config", "config"],
      ["--lychee", "lychee"],
    ]);
    if (valueOptions.has(argument)) {
      const value = argv[index + 1];
      if (!value) {
        throw new CheckerError(`${argument} requires a value.`);
      }
      options[valueOptions.get(argument)] = path.resolve(value);
      index += 1;
    } else if (argument === "--inventory-only") {
      options.inventoryOnly = true;
    } else if (argument === "--allow-loopback-fixtures") {
      options.allowLoopbackFixtures = true;
    } else if (argument === "--help") {
      options.help = true;
    } else {
      throw new CheckerError(`Unknown argument: ${argument}`);
    }
  }

  options.root = path.resolve(options.root);
  options.outputDir = path.resolve(options.outputDir);
  options.config = path.resolve(options.config);
  return options;
}

function usage() {
  return `Usage: node scripts/check-external-links.mjs [options]

Options:
  --inventory-only             Write inventory.json and urls.txt without HTTP requests
  --root <path>                Repository root (default: current repository)
  --output-dir <path>          Task-specific result directory
  --config <path>              Lychee TOML configuration
  --lychee <path>              Lychee 0.24.2 binary (or set LYCHEE_BIN)
  --allow-loopback-fixtures    Permit loopback URLs only for local fixture tests
  --help                       Show this help
`;
}

function lineNumberAt(text, offset) {
  let line = 1;
  for (let index = 0; index < offset; index += 1) {
    if (text.charCodeAt(index) === 10) line += 1;
  }
  return line;
}

function stripTrailingPunctuation(value) {
  let result = value;
  while (/[.,;:!?]$/.test(result)) result = result.slice(0, -1);
  while (result.endsWith(")")) {
    const opens = [...result].filter((character) => character === "(").length;
    const closes = [...result].filter((character) => character === ")").length;
    if (closes <= opens) break;
    result = result.slice(0, -1);
  }
  return result;
}

function extractUrlOccurrences(text, file, lineOffset = 0) {
  const occurrences = [];
  const pattern = /(?:https?:\/\/|[a-zA-Z][a-zA-Z0-9+.-]*:\/\/|mailto:|tel:)[^\s"'`<>\[\]{}\\]+/g;
  for (const match of text.matchAll(pattern)) {
    const originalUrl = stripTrailingPunctuation(match[0]);
    occurrences.push({
      file,
      line: lineOffset + lineNumberAt(text, match.index),
      originalUrl,
    });
  }
  return occurrences;
}

function extractReadmeBlock(text, file) {
  const starts = [...text.matchAll(new RegExp(README_START, "g"))];
  const ends = [...text.matchAll(new RegExp(README_END, "g"))];
  if (starts.length !== 1 || ends.length !== 1 || starts[0].index >= ends[0].index) {
    throw new CheckerError(
      `${file} must contain exactly one ordered ${README_START}/${README_END} block.`,
      "INVALID_README_MARKERS",
    );
  }
  const contentStart = starts[0].index + README_START.length;
  const block = text.slice(contentStart, ends[0].index);
  return extractUrlOccurrences(block, file, lineNumberAt(text, contentStart) - 1);
}

function isLoopbackHostname(hostname) {
  const host = hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (host === "localhost" || host.endsWith(".localhost") || host === "::1") return true;
  if (isIP(host) === 4) return host.startsWith("127.");
  return false;
}

function isPrivateHostname(hostname) {
  const host = hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (host.endsWith(".local") || host.endsWith(".internal")) return true;
  const ipVersion = isIP(host);
  if (ipVersion === 4) {
    const octets = host.split(".").map(Number);
    return (
      octets[0] === 10 ||
      (octets[0] === 172 && octets[1] >= 16 && octets[1] <= 31) ||
      (octets[0] === 192 && octets[1] === 168) ||
      (octets[0] === 169 && octets[1] === 254) ||
      octets[0] === 0
    );
  }
  if (ipVersion === 6) {
    return host.startsWith("fc") || host.startsWith("fd") || host.startsWith("fe8") || host.startsWith("fe9") || host.startsWith("fea") || host.startsWith("feb");
  }
  return false;
}

function exclusionReason(originalUrl, { allowLoopbackFixtures = false } = {}) {
  let parsed;
  try {
    parsed = new URL(originalUrl);
  } catch {
    return "malformed-url";
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return "non-http-destination";
  if (parsed.username || parsed.password) return "url-contains-credentials";
  const hostname = parsed.hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (hostname === "waffy.dev" || hostname.endsWith(".waffy.dev")) {
    return "first-party-covered-by-deployed-security-headers";
  }
  if (isLoopbackHostname(hostname) && !allowLoopbackFixtures) return "loopback-target";
  if (isPrivateHostname(hostname)) return "private-or-link-local-target";
  if (hostname === "formspree.io" || hostname.endsWith(".formspree.io") || hostname === "formspree.com" || hostname.endsWith(".formspree.com")) {
    return "form-submission-service";
  }
  if (
    hostname === "google-analytics.com" ||
    hostname.endsWith(".google-analytics.com") ||
    hostname === "googletagmanager.com" ||
    hostname.endsWith(".googletagmanager.com") ||
    hostname === "doubleclick.net" ||
    hostname.endsWith(".doubleclick.net")
  ) {
    return "analytics-service";
  }
  return null;
}

function normalizeHttpUrl(originalUrl) {
  const parsed = new URL(originalUrl);
  parsed.hash = "";
  return parsed.href;
}

async function readScopedOccurrences(root) {
  const dataDirectory = path.join(root, "main", "src", "data");
  const directDataFiles = (await readdir(dataDirectory, { withFileTypes: true }))
    .filter((entry) => entry.isFile() && /\.(?:js|mjs)$/.test(entry.name))
    .map((entry) => `main/src/data/${entry.name}`)
    .sort();
  const occurrences = [];

  for (const relativeFile of [...directDataFiles, ...INPUT_FILES]) {
    const absoluteFile = path.join(root, relativeFile);
    const text = await readFile(absoluteFile, "utf8");
    if (relativeFile.endsWith(".json")) {
      try {
        JSON.parse(text);
      } catch (error) {
        throw new CheckerError(`${relativeFile} is not valid JSON: ${error.message}`, "INVALID_JSON");
      }
    }
    occurrences.push(...extractUrlOccurrences(text, relativeFile));
  }

  for (const relativeFile of README_FILES) {
    const text = await readFile(path.join(root, relativeFile), "utf8");
    occurrences.push(...extractReadmeBlock(text, relativeFile));
  }

  return {
    files: [...directDataFiles, ...INPUT_FILES, ...README_FILES],
    occurrences,
  };
}

export async function buildInventory({ root = DEFAULT_ROOT, allowLoopbackFixtures = false } = {}) {
  const { files, occurrences } = await readScopedOccurrences(path.resolve(root));
  const eligibleByUrl = new Map();
  const excludedByKey = new Map();

  for (const occurrence of occurrences) {
    const reason = exclusionReason(occurrence.originalUrl, { allowLoopbackFixtures });
    if (reason) {
      const key = `${reason}\u0000${occurrence.originalUrl}`;
      if (!excludedByKey.has(key)) {
        excludedByKey.set(key, { originalUrl: occurrence.originalUrl, reason, sources: [] });
      }
      excludedByKey.get(key).sources.push(occurrence);
      continue;
    }

    const normalizedUrl = normalizeHttpUrl(occurrence.originalUrl);
    if (!eligibleByUrl.has(normalizedUrl)) {
      eligibleByUrl.set(normalizedUrl, { url: normalizedUrl, sources: [] });
    }
    eligibleByUrl.get(normalizedUrl).sources.push(occurrence);
  }

  const eligible = [...eligibleByUrl.values()].sort((left, right) => left.url.localeCompare(right.url));
  const excluded = [...excludedByKey.values()].sort((left, right) => {
    const reasonOrder = left.reason.localeCompare(right.reason);
    return reasonOrder || left.originalUrl.localeCompare(right.originalUrl);
  });
  if (eligible.length === 0) {
    throw new CheckerError("External-link inventory contains no eligible HTTP(S) URLs.", "EMPTY_INVENTORY");
  }
  if (eligible.length > MAX_ELIGIBLE_URLS) {
    throw new CheckerError(
      `External-link inventory contains ${eligible.length} eligible URLs; the limit is ${MAX_ELIGIBLE_URLS}.`,
      "INVENTORY_LIMIT",
    );
  }

  return {
    schema: INVENTORY_SCHEMA,
    generatedAt: new Date().toISOString(),
    scope: {
      files,
      readmeBoundary: "Only generated-public-docs marker blocks are scanned.",
      extractionBoundary: "Literal canonical URLs in direct data modules and generated resolved URLs in named public documents are scanned; code is never executed.",
    },
    policy: {
      maxEligibleUrls: MAX_ELIGIBLE_URLS,
      fragments: "Removed from the HTTP destination while every original occurrence is retained.",
      queries: "Preserved as distinct HTTP destinations.",
      fixtureLoopbackOverride: allowLoopbackFixtures,
    },
    counts: {
      occurrences: occurrences.length,
      eligible: eligible.length,
      excluded: excluded.length,
    },
    eligible,
    excluded,
  };
}

async function writeInventory(outputDir, inventory) {
  await mkdir(outputDir, { recursive: true });
  await writeFile(path.join(outputDir, "inventory.json"), `${JSON.stringify(inventory, null, 2)}\n`);
  await writeFile(path.join(outputDir, "urls.txt"), `${inventory.eligible.map(({ url }) => url).join("\n")}\n`);
}

function sanitizedSubprocessEnvironment() {
  const environment = { ...process.env };
  for (const name of ["GITHUB_TOKEN", "GH_TOKEN", "GITHUB_PAT", "INPUT_GITHUB_TOKEN"]) {
    delete environment[name];
  }
  return environment;
}

async function spawnCaptured(command, args, { timeoutMs, cwd = DEFAULT_ROOT } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd,
      env: sanitizedSubprocessEnvironment(),
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    let timedOut = false;
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk) => { stdout += chunk; });
    child.stderr.on("data", (chunk) => { stderr += chunk; });
    child.on("error", reject);
    const timeout = setTimeout(() => {
      timedOut = true;
      child.kill("SIGTERM");
      setTimeout(() => child.kill("SIGKILL"), 1_000).unref();
    }, timeoutMs);
    child.on("close", (exitCode, signal) => {
      clearTimeout(timeout);
      resolve({ exitCode, signal, stdout, stderr, timedOut });
    });
  });
}

function statusFromItem(item) {
  if (Number.isInteger(item?.status?.code)) return item.status.code;
  if (Number.isInteger(item?.status)) return item.status;
  return null;
}

function detailFromItem(item) {
  if (typeof item?.status?.details === "string") return item.status.details;
  if (typeof item?.status?.text === "string") return item.status.text;
  if (typeof item?.status === "string") return item.status;
  return null;
}

function redirectChainFromItem(item) {
  const redirectData = item?.redirects;
  if (!redirectData) return [];
  const chain = [];
  if (typeof redirectData.origin === "string") chain.push(redirectData.origin);
  const redirects = Array.isArray(redirectData.redirects) ? redirectData.redirects : [];
  for (const redirect of redirects) {
    const url = typeof redirect === "string" ? redirect : redirect?.url;
    if (typeof url === "string" && chain.at(-1) !== url) chain.push(url);
  }
  return chain;
}

function flattenMap(resultMap, category) {
  if (resultMap == null) return [];
  if (typeof resultMap !== "object" || Array.isArray(resultMap)) {
    throw new CheckerError(`Lychee ${category}_map is malformed.`, "MALFORMED_LYCHEE_OUTPUT");
  }
  const items = [];
  for (const [input, entries] of Object.entries(resultMap)) {
    if (!Array.isArray(entries)) {
      throw new CheckerError(`Lychee ${category}_map entry for ${input} is malformed.`, "MALFORMED_LYCHEE_OUTPUT");
    }
    for (const entry of entries) items.push({ input, entry, category });
  }
  return items;
}

export function parseLycheePayload(payload, expectedUrls, round) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw new CheckerError("Lychee JSON output is not an object.", "MALFORMED_LYCHEE_OUTPUT");
  }
  const categories = ["success", "error", "timeout", "excluded"];
  for (const category of categories) {
    if (!Object.hasOwn(payload, `${category}_map`)) {
      throw new CheckerError(`Lychee JSON output is missing ${category}_map.`, "MALFORMED_LYCHEE_OUTPUT");
    }
  }
  if (!Object.hasOwn(payload, "redirect_map")) {
    throw new CheckerError("Lychee JSON output is missing redirect_map.", "MALFORMED_LYCHEE_OUTPUT");
  }
  if (payload.detailed_stats !== true) {
    throw new CheckerError("Lychee JSON output does not include verbose detailed statistics.", "MALFORMED_LYCHEE_OUTPUT");
  }
  const expected = new Set(expectedUrls);
  const attempts = new Map();
  const categoryCounts = new Map();
  for (const category of categories) {
    const entries = flattenMap(payload[`${category}_map`], category);
    categoryCounts.set(category, entries.length);
    for (const { input, entry } of entries) {
      if (!entry || typeof entry.url !== "string") {
        throw new CheckerError(`Lychee ${category}_map contains an entry without a URL.`, "MALFORMED_LYCHEE_OUTPUT");
      }
      let normalized;
      try {
        normalized = normalizeHttpUrl(entry.url);
      } catch {
        throw new CheckerError(`Lychee returned an invalid URL: ${entry.url}`, "MALFORMED_LYCHEE_OUTPUT");
      }
      if (!expected.has(normalized)) {
        throw new CheckerError(`Lychee returned unexpected URL ${normalized}.`, "MALFORMED_LYCHEE_OUTPUT");
      }
      if (attempts.has(normalized)) {
        throw new CheckerError(`Lychee returned duplicate results for ${normalized}.`, "MALFORMED_LYCHEE_OUTPUT");
      }
      const redirectChain = redirectChainFromItem(entry);
      attempts.set(normalized, {
        round,
        category,
        status: statusFromItem(entry),
        detail: detailFromItem(entry),
        attemptedFinalUrl: redirectChain.at(-1) || entry.url,
        redirectChain,
        input,
        duration: entry.duration ?? null,
        raw: entry,
      });
    }
  }
  const missing = expectedUrls.filter((url) => !attempts.has(url));
  if (missing.length > 0) {
    throw new CheckerError(`Lychee omitted ${missing.length} expected URL result(s) in round ${round}.`, "INCOMPLETE_ROUND");
  }
  const counterPairs = [
    ["successful", categoryCounts.get("success")],
    ["errors", categoryCounts.get("error")],
    ["timeouts", categoryCounts.get("timeout")],
    ["excludes", categoryCounts.get("excluded")],
    ["total", expectedUrls.length],
    ["unique", expectedUrls.length],
  ];
  for (const [name, expectedCount] of counterPairs) {
    if (!Number.isInteger(payload[name]) || payload[name] !== expectedCount) {
      throw new CheckerError(
        `Lychee counter ${name} is ${JSON.stringify(payload[name])}; expected ${expectedCount}.`,
        "MALFORMED_LYCHEE_OUTPUT",
      );
    }
  }
  if (payload.cached !== 0) {
    throw new CheckerError(`Lychee unexpectedly reported ${payload.cached} cached result(s).`, "MALFORMED_LYCHEE_OUTPUT");
  }
  for (const name of ["unknown", "unsupported", "remaps"]) {
    if (payload[name] !== 0) {
      throw new CheckerError(`Lychee unexpectedly reported ${JSON.stringify(payload[name])} ${name} result(s).`, "MALFORMED_LYCHEE_OUTPUT");
    }
  }
  const redirectEntries = flattenMap(payload.redirect_map ?? {}, "redirect");
  for (const { entry } of redirectEntries) {
    if (!entry || typeof entry.origin !== "string") {
      throw new CheckerError("Lychee redirect_map contains an entry without an origin.", "MALFORMED_LYCHEE_OUTPUT");
    }
    const normalizedOrigin = normalizeHttpUrl(entry.origin);
    if (!expected.has(normalizedOrigin)) {
      throw new CheckerError(`Lychee returned an unexpected redirect origin ${normalizedOrigin}.`, "MALFORMED_LYCHEE_OUTPUT");
    }
  }
  if (!Number.isInteger(payload.redirects) || payload.redirects !== redirectEntries.length) {
    throw new CheckerError(
      `Lychee counter redirects is ${JSON.stringify(payload.redirects)}; expected ${redirectEntries.length}.`,
      "MALFORMED_LYCHEE_OUTPUT",
    );
  }
  return attempts;
}

function shouldRetry(attempt) {
  if (!attempt) return true;
  if (attempt.status != null) {
    return RETRYABLE_CODES.has(attempt.status) || (attempt.status >= 500 && attempt.status <= 599);
  }
  return attempt.category === "timeout" || attempt.category === "error";
}

function isAuthWall(urlValue) {
  try {
    const url = new URL(urlValue);
    const combined = `${url.hostname}${url.pathname}`.toLowerCase();
    return /(?:^|[./_-])(login|signin|sign-in|authwall|checkpoint|challenge)(?:[./_-]|$)/.test(combined);
  } catch {
    return false;
  }
}

function classifyAttempt(attempt, attemptCount) {
  if (!attempt) return { classification: "inconclusive", reason: "missing-result" };
  const status = attempt.status;
  if (attempt.category === "excluded") return { classification: "inconclusive", reason: "unexpected-lychee-exclusion" };
  if (status != null && status >= 200 && status <= 299) {
    if (isAuthWall(attempt.attemptedFinalUrl)) return { classification: "blocked", reason: "login-or-challenge-destination" };
    return { classification: "healthy", reason: "confirmed-2xx" };
  }
  if (status != null && BLOCKED_CODES.has(status)) return { classification: "blocked", reason: `blocked-http-${status}` };
  if (status != null && status >= 500 && status <= 599) {
    return {
      classification: attemptCount >= 3 ? "broken" : "inconclusive",
      reason: attemptCount >= 3 ? `persistent-server-http-${status}` : `server-http-${status}-retry-incomplete`,
    };
  }
  if (status != null && status >= 400 && status <= 499 && status !== 408) {
    return { classification: "broken", reason: `permanent-http-${status}` };
  }
  if (status === 408) return { classification: "inconclusive", reason: "request-timeout-http-408" };
  if (attempt.category === "timeout") return { classification: "inconclusive", reason: "request-timeout" };
  return { classification: "inconclusive", reason: attempt.detail || "network-or-unexpected-result" };
}

function escapeMarkdown(value) {
  return String(value ?? "").replace(/\\/g, "\\\\").replace(/\|/g, "\\|").replace(/[\r\n]+/g, " ");
}

export { escapeMarkdown };

function reportMarkdown(report) {
  const lines = [
    "# External link report",
    "",
    `- Completion: **${escapeMarkdown(report.completion.status)}**`,
    `- Generated: ${escapeMarkdown(report.generatedAt)}`,
    `- Source commit: \`${escapeMarkdown(report.source.commit || "unavailable")}\``,
    `- Lychee: ${escapeMarkdown(report.tool.version || "unavailable")}`,
    `- Eligible URLs: ${report.counts.eligible}`,
    `- Healthy: ${report.counts.healthy}`,
    `- Broken: ${report.counts.broken}`,
    `- Blocked: ${report.counts.blocked}`,
    `- Inconclusive: ${report.counts.inconclusive}`,
    `- Excluded destinations: ${report.counts.excluded}`,
    "",
  ];
  if (report.completion.errors.length > 0) {
    lines.push("## Setup and coverage errors", "");
    for (const error of report.completion.errors) lines.push(`- ${escapeMarkdown(error)}`);
    lines.push("");
  }
  lines.push(
    "## Outcomes",
    "",
    "| Classification | Status | URL | Attempted final URL | Attempts | Sources | Reason |",
    "| --- | ---: | --- | --- | ---: | --- | --- |",
  );
  for (const outcome of report.outcomes.slice(0, 100)) {
    const sources = outcome.sources.map((source) => `${source.file}:${source.line}`).join(", ");
    lines.push(`| ${escapeMarkdown(outcome.classification)} | ${escapeMarkdown(outcome.status ?? "-")} | ${escapeMarkdown(outcome.url)} | ${escapeMarkdown(outcome.attemptedFinalUrl || "-")} | ${outcome.attempts.length} | ${escapeMarkdown(sources)} | ${escapeMarkdown(outcome.reason)} |`);
  }
  if (report.outcomes.length > 100) lines.push("", `Outcome table truncated to 100 rows; report.json retains all ${report.outcomes.length} outcomes.`);
  lines.push(
    "",
    "## Evidence boundary",
    "",
    "This advisory report performs credential-free HTTP GET requests only. It does not execute JavaScript, submit forms, validate fragments, inspect authenticated content, prove indexing or browser rendering, or establish semantic page health.",
    "",
  );
  return `${lines.join("\n")}\n`;
}

async function currentCommit(root) {
  try {
    const result = await spawnCaptured("git", ["rev-parse", "HEAD"], { cwd: root, timeoutMs: 5_000 });
    return result.exitCode === 0 ? result.stdout.trim() : null;
  } catch {
    return null;
  }
}

function baseReport(inventory, commit) {
  return {
    schema: REPORT_SCHEMA,
    generatedAt: new Date().toISOString(),
    source: { commit, inventorySchema: inventory.schema, files: inventory.scope.files },
    tool: { name: "lychee", requiredVersion: "0.24.2", version: null },
    policy: {
      method: "GET",
      acceptedStatus: "200..299",
      maxConcurrency: 3,
      hostConcurrency: 1,
      hostRequestInterval: "1s",
      requestTimeout: "15s",
      maxRedirects: 10,
      retryRounds: 2,
      retryWaits: ["2s", "4s"],
      persistentServerFailures: "Broken after three total attempts; incomplete retry coverage is inconclusive.",
    },
    completion: { status: "setup-failure", errors: [] },
    counts: {
      eligible: inventory.eligible.length,
      excluded: inventory.excluded.length,
      healthy: 0,
      broken: 0,
      blocked: 0,
      inconclusive: inventory.eligible.length,
    },
    exclusions: inventory.excluded,
    outcomes: [],
    rounds: [],
  };
}

async function writeReport(outputDir, report) {
  await writeFile(path.join(outputDir, "report.json"), `${JSON.stringify(report, null, 2)}\n`);
  await writeFile(path.join(outputDir, "report.md"), reportMarkdown(report));
}

async function resetOwnedOutputDirectory(root, outputDir, { createRaw = false } = {}) {
  const resolvedRoot = path.resolve(root);
  const resolvedOutput = path.resolve(outputDir);
  let canonicalRoot;
  try {
    canonicalRoot = await realpath(resolvedRoot);
  } catch (error) {
    throw new CheckerError(
      `Unable to resolve the repository root before output cleanup: ${error.message}`,
      "UNSAFE_OUTPUT_DIR",
    );
  }

  let rootStats;
  try {
    rootStats = await lstat(canonicalRoot);
  } catch (error) {
    throw new CheckerError(
      `Unable to inspect the repository root before output cleanup: ${error.message}`,
      "UNSAFE_OUTPUT_DIR",
    );
  }
  if (!rootStats.isDirectory()) {
    throw new CheckerError("The repository root must resolve to a directory.", "UNSAFE_OUTPUT_DIR");
  }

  const relativeOutput = path.relative(resolvedRoot, resolvedOutput);
  const outputSegments = relativeOutput.split(path.sep).filter(Boolean);
  if (
    relativeOutput === ""
    || relativeOutput.startsWith(`..${path.sep}`)
    || relativeOutput === ".."
    || path.isAbsolute(relativeOutput)
    || outputSegments[0] !== "external-link-results"
    || outputSegments.length < 2
  ) {
    throw new CheckerError(
      "Output directory must be a strict descendant of the selected repository's external-link-results/ directory.",
      "UNSAFE_OUTPUT_DIR",
    );
  }

  let componentPath = canonicalRoot;
  for (const segment of outputSegments) {
    componentPath = path.join(componentPath, segment);
    let componentStats;
    try {
      componentStats = await lstat(componentPath);
    } catch (error) {
      if (error.code === "ENOENT") break;
      throw new CheckerError(
        `Unable to inspect output path component ${componentPath}: ${error.message}`,
        "UNSAFE_OUTPUT_DIR",
      );
    }
    if (componentStats.isSymbolicLink()) {
      throw new CheckerError(
        `Output path component cannot be a symbolic link: ${componentPath}`,
        "UNSAFE_OUTPUT_DIR",
      );
    }
    if (!componentStats.isDirectory()) {
      throw new CheckerError(
        `Output path component must be a directory: ${componentPath}`,
        "UNSAFE_OUTPUT_DIR",
      );
    }
  }

  const canonicalOutput = path.join(canonicalRoot, ...outputSegments);
  await rm(canonicalOutput, { recursive: true, force: true });
  await mkdir(createRaw ? path.join(canonicalOutput, "raw") : canonicalOutput, { recursive: true });
  return canonicalOutput;
}

function refreshOutcomes(report, inventory, attemptsByUrl) {
  report.outcomes = inventory.eligible.map(({ url, sources }) => {
    const attempts = attemptsByUrl.get(url) || [];
    const latest = attempts.at(-1);
    const { classification, reason } = classifyAttempt(latest, attempts.length);
    return {
      url,
      classification,
      reason,
      status: latest?.status ?? null,
      attemptedFinalUrl: latest?.attemptedFinalUrl ?? url,
      redirectChain: latest?.redirectChain ?? [],
      sources,
      attempts,
    };
  });
  report.counts.healthy = 0;
  report.counts.broken = 0;
  report.counts.blocked = 0;
  report.counts.inconclusive = 0;
  for (const outcome of report.outcomes) report.counts[outcome.classification] += 1;
}

function remainingTime(deadline) {
  const remaining = deadline - Date.now();
  if (remaining <= 0) throw new CheckerError("The eight-minute checker deadline expired.", "CHECKER_DEADLINE");
  return remaining;
}

async function waitWithinDeadline(milliseconds, deadline) {
  if (milliseconds <= 0) return;
  if (Date.now() + milliseconds >= deadline) {
    throw new CheckerError("The checker deadline expired before the next retry round.", "CHECKER_DEADLINE");
  }
  await new Promise((resolve) => setTimeout(resolve, milliseconds));
}

export async function runReport({
  root = DEFAULT_ROOT,
  outputDir = DEFAULT_OUTPUT_DIR,
  config = DEFAULT_CONFIG,
  lychee = process.env.LYCHEE_BIN || "lychee",
  allowLoopbackFixtures = false,
  retryDelaysMs = [2_000, 4_000],
  requestTimeoutSeconds = null,
  overallTimeoutMs = 8 * 60 * 1_000,
} = {}) {
  root = path.resolve(root);
  outputDir = path.resolve(outputDir);
  config = path.resolve(config);
  const deadline = Date.now() + overallTimeoutMs;
  outputDir = await resetOwnedOutputDirectory(root, outputDir, { createRaw: true });

  let inventory;
  try {
    inventory = await buildInventory({ root, allowLoopbackFixtures });
    if (allowLoopbackFixtures) {
      const nonLoopback = inventory.eligible.filter(({ url }) => !isLoopbackHostname(new URL(url).hostname));
      if (nonLoopback.length > 0) {
        throw new CheckerError(
          `Fixture loopback mode rejected ${nonLoopback.length} non-loopback eligible URL(s).`,
          "UNSAFE_FIXTURE_TARGET",
        );
      }
    }
    await writeInventory(outputDir, inventory);
  } catch (error) {
    await mkdir(outputDir, { recursive: true });
    const placeholder = {
      schema: REPORT_SCHEMA,
      generatedAt: new Date().toISOString(),
      source: { commit: await currentCommit(root), inventorySchema: null, files: [] },
      tool: { name: "lychee", requiredVersion: "0.24.2", version: null },
      policy: {},
      completion: { status: "setup-failure", errors: [error.message] },
      counts: { eligible: 0, excluded: 0, healthy: 0, broken: 0, blocked: 0, inconclusive: 0 },
      exclusions: [],
      outcomes: [],
      rounds: [],
    };
    await writeReport(outputDir, placeholder);
    throw error;
  }

  const report = baseReport(inventory, await currentCommit(root));
  await writeReport(outputDir, report);
  try {
    const versionResult = await spawnCaptured(lychee, ["--version"], { cwd: root, timeoutMs: Math.min(10_000, remainingTime(deadline)) });
    const versionText = `${versionResult.stdout}\n${versionResult.stderr}`.trim();
    report.tool.version = versionText || null;
    if (versionResult.exitCode !== 0 || !/\blychee\s+0\.24\.2\b/i.test(versionText)) {
      throw new CheckerError(`Expected Lychee 0.24.2, received: ${versionText || "no version output"}.`, "LYCHEE_VERSION");
    }

    const attemptsByUrl = new Map(inventory.eligible.map(({ url }) => [url, []]));
    let pendingUrls = inventory.eligible.map(({ url }) => url);
    for (let round = 1; round <= 3 && pendingUrls.length > 0; round += 1) {
      if (round > 1) await waitWithinDeadline(retryDelaysMs[round - 2], deadline);
      const roundPrefix = path.join(outputDir, "raw", `round-${round}`);
      const urlFile = `${roundPrefix}.urls.txt`;
      const jsonFile = `${roundPrefix}.json`;
      await writeFile(urlFile, `${pendingUrls.join("\n")}\n`);
      const args = [
        "--config", config,
        "--format", "json",
        "--output", jsonFile,
        "--verbose",
      ];
      if (allowLoopbackFixtures) {
        args.push("--exclude-all-private=false", "--exclude-loopback=false");
      }
      if (requestTimeoutSeconds != null) args.push("--timeout", String(requestTimeoutSeconds));
      args.push(urlFile);
      const processResult = await spawnCaptured(lychee, args, {
        cwd: root,
        timeoutMs: remainingTime(deadline),
      });
      await writeFile(`${roundPrefix}.stdout.txt`, processResult.stdout);
      await writeFile(`${roundPrefix}.stderr.txt`, processResult.stderr);
      report.rounds.push({
        round,
        urlCount: pendingUrls.length,
        exitCode: processResult.exitCode,
        signal: processResult.signal,
        timedOut: processResult.timedOut,
        files: {
          urls: path.relative(outputDir, urlFile),
          json: path.relative(outputDir, jsonFile),
          stdout: path.relative(outputDir, `${roundPrefix}.stdout.txt`),
          stderr: path.relative(outputDir, `${roundPrefix}.stderr.txt`),
        },
      });
      await writeReport(outputDir, report);
      if (processResult.timedOut) throw new CheckerError(`Lychee round ${round} exceeded the checker deadline.`, "CHECKER_DEADLINE");
      let payload;
      try {
        payload = JSON.parse(await readFile(jsonFile, "utf8"));
      } catch (error) {
        throw new CheckerError(`Lychee round ${round} did not produce valid JSON: ${error.message}`, "MALFORMED_LYCHEE_OUTPUT");
      }
      const parsedAttempts = parseLycheePayload(payload, pendingUrls, round);
      for (const url of pendingUrls) {
        const attempt = parsedAttempts.get(url);
        if (attempt) attemptsByUrl.get(url).push(attempt);
      }
      refreshOutcomes(report, inventory, attemptsByUrl);
      report.completion.status = "incomplete";
      await writeReport(outputDir, report);
      if (![0, 2].includes(processResult.exitCode)) {
        throw new CheckerError(
          `Lychee round ${round} exited with unexpected status ${processResult.exitCode}.`,
          "LYCHEE_PROCESS_FAILURE",
        );
      }
      pendingUrls = pendingUrls.filter((url) => shouldRetry(attemptsByUrl.get(url).at(-1)));
    }

    refreshOutcomes(report, inventory, attemptsByUrl);
    const missing = report.outcomes.filter((outcome) => outcome.attempts.length === 0);
    const retryIncomplete = report.outcomes.filter((outcome) => shouldRetry(outcome.attempts.at(-1)) && outcome.attempts.length < 3);
    if (missing.length > 0) report.completion.errors.push(`Missing Lychee results for ${missing.length} eligible URL(s).`);
    if (retryIncomplete.length > 0) report.completion.errors.push(`Retry coverage is incomplete for ${retryIncomplete.length} URL(s).`);
    report.completion.status = report.completion.errors.length === 0 ? "complete-advisory" : "incomplete";
    await writeReport(outputDir, report);
    if (report.completion.status !== "complete-advisory") {
      throw new CheckerError(report.completion.errors.join(" "), "INCOMPLETE_REPORT");
    }
    return report;
  } catch (error) {
    if (!report.completion.errors.includes(error.message)) report.completion.errors.push(error.message);
    report.completion.status = report.outcomes.some(({ attempts }) => attempts.length > 0) ? "incomplete" : "setup-failure";
    await writeReport(outputDir, report);
    throw error;
  }
}

async function runCli() {
  const options = parseArguments(process.argv.slice(2));
  if (options.help) {
    process.stdout.write(usage());
    return;
  }
  if (options.inventoryOnly) {
    options.outputDir = await resetOwnedOutputDirectory(options.root, options.outputDir);
    const inventory = await buildInventory(options);
    await writeInventory(options.outputDir, inventory);
    process.stdout.write(`Inventoried ${inventory.counts.eligible} eligible URL(s) and ${inventory.counts.excluded} exclusion(s).\n`);
    return;
  }
  const report = await runReport(options);
  process.stdout.write(`External-link report complete: ${report.counts.healthy} healthy, ${report.counts.broken} broken, ${report.counts.blocked} blocked, ${report.counts.inconclusive} inconclusive.\n`);
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (isMain) {
  runCli().catch((error) => {
    process.stderr.write(`External-link checker failed: ${error.message}\n`);
    process.exitCode = 2;
  });
}
