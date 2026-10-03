import assert from "node:assert/strict";
import { chmod, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
  buildInventory,
  escapeMarkdown,
  parseLycheePayload,
  runReport,
} from "./check-external-links.mjs";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const CONFIG_PATH = path.join(SCRIPT_DIR, "external-links.toml");
const LYCHEE_BIN = process.env.LYCHEE_BIN;

async function makeFixtureRoot({ dataText, portfolioText = "{}\n", rootReadmeBlock = "", mainReadmeBlock = "" }) {
  const root = await mkdtemp(path.join(os.tmpdir(), "external-links-fixture-"));
  await mkdir(path.join(root, "main", "src", "data"), { recursive: true });
  await mkdir(path.join(root, "main", "public"), { recursive: true });
  await writeFile(path.join(root, "main", "src", "data", "links.js"), dataText);
  await writeFile(path.join(root, "main", "public", "portfolio.json"), portfolioText);
  await writeFile(path.join(root, "main", "public", "ai-summary.txt"), "fixture\n");
  await writeFile(path.join(root, "main", "public", "llms.txt"), "fixture\n");
  await writeFile(
    path.join(root, "README.md"),
    `outside https://outside.invalid/\n<!-- generated-public-docs:start -->\n${rootReadmeBlock}\n<!-- generated-public-docs:end -->\n`,
  );
  await writeFile(
    path.join(root, "main", "README.md"),
    `<!-- generated-public-docs:start -->\n${mainReadmeBlock}\n<!-- generated-public-docs:end -->\n`,
  );
  return root;
}

test("inventory scans only the bounded scope and preserves deduplicated attribution", async (t) => {
  const root = await makeFixtureRoot({
    dataText: [
      "export const links = [",
      "  'https://example.com/path#one',",
      "  'https://example.com/path#two',",
      "  'https://example.com/path?q=one',",
      "  'mailto:test@example.com',",
      "  'https://waffy.dev/resume/',",
      "  'https://user:pass@example.com/private',",
      "  'http://10.0.0.1/private',",
      "  'https://formspree.io/f/example',",
      "  'https://www.google-analytics.com/g/collect',",
      "];",
    ].join("\n"),
    portfolioText: '{"url":"https://example.com/path"}\n',
    rootReadmeBlock: "[same](https://example.com/path#readme)",
    mainReadmeBlock: "[GitHub](https://github.com/example/repo)",
  });
  t.after(() => rm(root, { recursive: true, force: true }));

  const inventory = await buildInventory({ root });
  assert.deepEqual(inventory.eligible.map(({ url }) => url), [
    "https://example.com/path",
    "https://example.com/path?q=one",
    "https://github.com/example/repo",
  ]);
  const pathEntry = inventory.eligible.find(({ url }) => url === "https://example.com/path");
  assert.equal(pathEntry.sources.length, 4);
  assert.ok(pathEntry.sources.some(({ file, line }) => file === "README.md" && line === 3));
  assert.ok(!inventory.eligible.some(({ url }) => url.includes("outside.invalid")));
  assert.deepEqual(new Set(inventory.excluded.map(({ reason }) => reason)), new Set([
    "analytics-service",
    "first-party-covered-by-deployed-security-headers",
    "form-submission-service",
    "non-http-destination",
    "private-or-link-local-target",
    "url-contains-credentials",
  ]));
});

test("inventory validates JSON and generated README markers", async (t) => {
  const invalidJsonRoot = await makeFixtureRoot({
    dataText: "export const url = 'https://example.com/';\n",
    portfolioText: "{ invalid json\n",
  });
  t.after(() => rm(invalidJsonRoot, { recursive: true, force: true }));
  await assert.rejects(buildInventory({ root: invalidJsonRoot }), /not valid JSON/);

  const invalidReadmeRoot = await makeFixtureRoot({
    dataText: "export const url = 'https://example.com/';\n",
  });
  await writeFile(path.join(invalidReadmeRoot, "README.md"), "missing markers\n");
  t.after(() => rm(invalidReadmeRoot, { recursive: true, force: true }));
  await assert.rejects(buildInventory({ root: invalidReadmeRoot }), /must contain exactly one ordered/);
});

test("inventory fails on empty or over-limit eligible inventories", async (t) => {
  const emptyRoot = await makeFixtureRoot({ dataText: "export const site = 'https://waffy.dev/';\n" });
  t.after(() => rm(emptyRoot, { recursive: true, force: true }));
  await assert.rejects(buildInventory({ root: emptyRoot }), /no eligible HTTP\(S\) URLs/);

  const urls = Array.from({ length: 201 }, (_, index) => `https://host-${index}.example/path`);
  const overLimitRoot = await makeFixtureRoot({ dataText: `export const urls = ${JSON.stringify(urls)};\n` });
  t.after(() => rm(overLimitRoot, { recursive: true, force: true }));
  await assert.rejects(buildInventory({ root: overLimitRoot }), /the limit is 200/);
});

test("loopback override is explicit and does not permit private network targets", async (t) => {
  const root = await makeFixtureRoot({
    dataText: "export const links = ['http://127.0.0.1:8080/ok', 'http://10.0.0.1/private'];\n",
  });
  t.after(() => rm(root, { recursive: true, force: true }));
  await assert.rejects(
    buildInventory({ root }),
    (error) => error.code === "EMPTY_INVENTORY" && /no eligible HTTP\(S\) URLs/.test(error.message),
  );
  const fixture = await buildInventory({ root, allowLoopbackFixtures: true });
  assert.deepEqual(fixture.eligible.map(({ url }) => url), ["http://127.0.0.1:8080/ok"]);
  assert.ok(fixture.excluded.some(({ reason }) => reason === "private-or-link-local-target"));
});

test("Lychee payload validation never infers missing results as success", () => {
  const completePayload = (url) => ({
    success_map: { input: [{ url, status: { code: 200 } }] },
    error_map: {}, timeout_map: {}, excluded_map: {}, redirect_map: {},
    detailed_stats: true, successful: 1, errors: 0, timeouts: 0, excludes: 0,
    total: 1, unique: 1, cached: 0, redirects: 0, unknown: 0, unsupported: 0, remaps: 0,
  });
  assert.throws(() => parseLycheePayload([], ["https://example.com/"], 1), /not an object/);
  assert.throws(() => parseLycheePayload({}, ["https://example.com/"], 1), /missing success_map/);
  assert.throws(
    () => parseLycheePayload({
      success_map: { input: [{}] },
      error_map: {},
      timeout_map: {},
      excluded_map: {},
      redirect_map: {},
      detailed_stats: true,
    }, ["https://example.com/"], 1),
    /entry without a URL/,
  );
  assert.throws(
    () => parseLycheePayload({
      success_map: {}, error_map: {}, timeout_map: {}, excluded_map: {}, redirect_map: {},
      detailed_stats: true, successful: 0, errors: 0, timeouts: 0, excludes: 0,
      total: 0, unique: 0, cached: 0, redirects: 0, unknown: 0, unsupported: 0, remaps: 0,
    }, ["https://example.com/"], 1),
    /omitted 1 expected URL/,
  );
  const counterMismatch = completePayload("https://example.com/");
  counterMismatch.successful = 0;
  assert.throws(
    () => parseLycheePayload(counterMismatch, ["https://example.com/"], 1),
    /counter successful is 0; expected 1/,
  );
  assert.throws(
    () => parseLycheePayload(completePayload("https://unexpected.example/"), ["https://example.com/"], 1),
    /unexpected URL https:\/\/unexpected\.example\//,
  );
  assert.equal(escapeMarkdown("a|b\nc"), "a\\|b c");
});

test("setup failures replace stale output and leave an honest checkpoint", async (t) => {
  const root = await makeFixtureRoot({ dataText: "export const url = 'https://example.com/';\n" });
  const outputDir = path.join(root, "external-link-results", "current");
  await mkdir(outputDir, { recursive: true });
  await writeFile(path.join(outputDir, "stale.txt"), "stale\n");
  t.after(() => rm(root, { recursive: true, force: true }));
  await assert.rejects(
    runReport({ root, outputDir, config: CONFIG_PATH, lychee: path.join(root, "missing-lychee") }),
  );
  await assert.rejects(readFile(path.join(outputDir, "stale.txt"), "utf8"));
  const report = JSON.parse(await readFile(path.join(outputDir, "report.json"), "utf8"));
  assert.equal(report.completion.status, "setup-failure");
  assert.ok(report.completion.errors.length > 0);
  assert.match(await readFile(path.join(outputDir, "report.md"), "utf8"), /setup-failure/);
});

test("output cleanup rejects repository and source-directory targets", async (t) => {
  const root = await makeFixtureRoot({ dataText: "export const url = 'https://example.com/';\n" });
  t.after(() => rm(root, { recursive: true, force: true }));
  await assert.rejects(
    runReport({ root, outputDir: root, config: CONFIG_PATH, lychee: "missing" }),
    /cannot be the repository root/,
  );
  await assert.rejects(
    runReport({ root, outputDir: path.join(root, "main", "danger"), config: CONFIG_PATH, lychee: "missing" }),
    /must be under external-link-results/,
  );
  assert.match(await readFile(path.join(root, "main", "src", "data", "links.js"), "utf8"), /example\.com/);
});

test("fixture loopback mode rejects any eligible real-provider target before Lychee runs", async (t) => {
  const root = await makeFixtureRoot({
    dataText: "export const links = ['http://127.0.0.1:8080/ok', 'https://example.com/'];\n",
  });
  t.after(() => rm(root, { recursive: true, force: true }));
  await assert.rejects(
    runReport({
      root,
      outputDir: path.join(root, "external-link-results", "current"),
      config: CONFIG_PATH,
      lychee: LYCHEE_BIN || "missing",
      allowLoopbackFixtures: true,
    }),
    /rejected 1 non-loopback eligible URL/,
  );
});

test("pinned Lychee fixtures cover redirects, retries, blocked results, and attribution", { timeout: 120_000 }, async (t) => {
  assert.ok(LYCHEE_BIN, "Set LYCHEE_BIN to the checksum-verified Lychee 0.24.2 binary.");
  await chmod(LYCHEE_BIN, 0o755);
  const counts = new Map();
  const methods = new Set();
  let heldRequests = 0;
  let maximumHeldRequests = 0;
  const server = http.createServer((request, response) => {
    const requestUrl = new URL(request.url, "http://127.0.0.1");
    const route = requestUrl.pathname;
    counts.set(route, (counts.get(route) || 0) + 1);
    methods.add(request.method);
    const attempt = counts.get(route);
    const finish = (status, body = "fixture") => {
      response.writeHead(status, { "content-type": "text/html", "x-fixture-attempt": String(attempt) });
      response.end(body);
    };

    if (route === "/redirect") {
      response.writeHead(302, { location: "/ok" });
      response.end();
    } else if (route === "/redirect404") {
      response.writeHead(301, { location: "/missing" });
      response.end();
    } else if (route === "/missing") finish(404);
    else if (route === "/gone") finish(410);
    else if (route === "/flaky503") finish(attempt < 3 ? 503 : 200);
    else if (route === "/persistent503") finish(503);
    else if (route === "/auth") finish(401);
    else if (route === "/forbidden") finish(403);
    else if (route === "/rate") finish(429);
    else if (route === "/blocked999") finish(999);
    else if (route === "/login-start") {
      response.writeHead(302, { location: "/login" });
      response.end();
    } else if (route === "/login") finish(200);
    else if (route === "/reset" && attempt < 3) request.socket.destroy();
    else if (route === "/slow" && attempt < 3) setTimeout(() => finish(200), 1_500);
    else if (route === "/hold-a" || route === "/hold-b") {
      heldRequests += 1;
      maximumHeldRequests = Math.max(maximumHeldRequests, heldRequests);
      setTimeout(() => {
        heldRequests -= 1;
        finish(200);
      }, 150);
    } else if (route === "/should-not-fetch" || route === "/script-fetch") finish(500);
    else finish(200, '<a href="/should-not-fetch">nested</a><script>fetch("/script-fetch")</script>');
  });
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const { port } = server.address();
  const base = `http://127.0.0.1:${port}`;
  const routes = [
    "/ok#one", "/ok#two", "/redirect", "/redirect404", "/missing", "/gone",
    "/flaky503", "/persistent503", "/auth", "/forbidden", "/rate", "/blocked999",
    "/login-start", "/reset", "/slow", "/hold-a", "/hold-b", "/ok?query=kept",
  ];
  const root = await makeFixtureRoot({
    dataText: `export const links = ${JSON.stringify(routes.map((route) => `${base}${route}`))};\n`,
    portfolioText: `${JSON.stringify({ duplicate: `${base}/ok`, generated: `${base}/redirect` })}\n`,
    rootReadmeBlock: `[duplicate](${base}/ok#readme)`,
    mainReadmeBlock: `[generated](${base}/redirect)`,
  });
  const outputDir = path.join(root, "external-link-results", "current");
  t.after(() => rm(root, { recursive: true, force: true }));

  const report = await runReport({
    root,
    outputDir,
    config: CONFIG_PATH,
    lychee: LYCHEE_BIN,
    allowLoopbackFixtures: true,
    retryDelaysMs: [10, 20],
    requestTimeoutSeconds: 1,
    overallTimeoutMs: 110_000,
  });
  const byPath = new Map(report.outcomes.map((outcome) => [new URL(outcome.url).pathname, outcome]));
  const canonicalOk = report.outcomes.find(({ url }) => url === `${base}/ok`);
  assert.equal(report.completion.status, "complete-advisory");
  assert.equal(canonicalOk.classification, "healthy");
  assert.ok(canonicalOk.sources.length >= 4);
  assert.equal(byPath.get("/redirect").classification, "healthy");
  assert.match(byPath.get("/redirect").attemptedFinalUrl, /\/ok$/);
  assert.equal(byPath.get("/redirect404").classification, "broken");
  assert.equal(byPath.get("/gone").classification, "broken");
  assert.equal(byPath.get("/flaky503").classification, "healthy");
  assert.equal(byPath.get("/flaky503").attempts.length, 3);
  assert.equal(byPath.get("/persistent503").classification, "broken");
  assert.equal(byPath.get("/persistent503").attempts.length, 3);
  assert.equal(byPath.get("/auth").classification, "blocked");
  assert.equal(byPath.get("/forbidden").classification, "blocked");
  assert.equal(byPath.get("/rate").classification, "blocked");
  assert.equal(byPath.get("/rate").attempts.length, 3);
  assert.equal(byPath.get("/blocked999").classification, "blocked");
  assert.equal(byPath.get("/login-start").classification, "blocked");
  assert.equal(byPath.get("/reset").classification, "healthy");
  assert.equal(byPath.get("/reset").attempts.length, 3);
  assert.equal(byPath.get("/slow").classification, "healthy");
  assert.equal(byPath.get("/slow").attempts.length, 3);
  assert.equal(new URL(report.outcomes.find(({ url }) => url.includes("query=kept")).url).search, "?query=kept");
  assert.deepEqual(methods, new Set(["GET"]));
  assert.equal(counts.get("/should-not-fetch") || 0, 0);
  assert.equal(counts.get("/script-fetch") || 0, 0);
  assert.equal(maximumHeldRequests, 1);
  assert.ok(report.rounds.every(({ timedOut }) => !timedOut));
  assert.ok(report.outcomes.every(({ attempts }) => attempts.length > 0));
  assert.ok((await readFile(path.join(outputDir, "raw", "round-1.json"), "utf8")).includes("success_map"));
  assert.match(await readFile(path.join(outputDir, "report.md"), "utf8"), /Evidence boundary/);
});
