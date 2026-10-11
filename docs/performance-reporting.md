# Route Performance Reporting

The route performance report is a scheduled and manually dispatched evidence job. It measures every canonical route exported by `main/src/data/seo.js` against mobile and desktop Lighthouse profiles. This reporting path is separate from the historical Issue #174 baseline harness, whose fixed eight-route, 80-run measurement contract remains unchanged.

## Measurement contract

- The workflow builds the production app once, serves it only on `http://127.0.0.1:4173`, and visits all nine current canonical routes.
- Each route/profile group has five sequential cold-cache samples. Each sample starts a fresh Chrome process and temporary user-data directory. A failed attempt receives at most one retry after Chrome cleanup finishes.
- The current route inventory produces 90 primary samples and permits at most 180 attempts. Each attempt has a 90-second deadline and a bounded 10-second cleanup grace. If cleanup does not settle, the matrix stops with partial evidence instead of launching another Chrome instance. The harness has a 40-minute measurement budget, the GitHub job has a 50-minute deadline, and the suite has no whole-run retry.
- Google Analytics, Google Tag Manager, DoubleClick, and Formspree URL patterns are blocked before navigation. The browser uses an unreachable loopback proxy, disables QUIC, and bypasses the proxy only for `127.0.0.1`. Analytics and Formspree build variables are empty. The job never submits the contact form.
- LCP, FCP, CLS, TBT, and transferred-byte deltas are advisory. Every accepted metric must be a finite nonnegative number; zero is valid. Missing samples, invalid diagnostics, changed source provenance, or corrupt evidence make the job fail.

Every successful artifact contains `summary.json`, `report.md`, `manifest.json`, and the raw Lighthouse result for each accepted sample. The manifest hashes every retained file. Validation recomputes metrics and diagnostics from each raw result, checks its Lighthouse and Chrome versions and profile settings, recomputes route/profile medians, and verifies the start and completion commit and worktree fingerprints.

## Baseline selection

The acquisition step reads at most 20 successful `main` runs of the same workflow and excludes the current and future runs. It downloads the latest retained artifact named `route-performance-v1-<run-id>-<attempt>` and validates its manifest, raw reports, summary, commit SHA, run ID, run attempt, workflow path, and artifact name.

Compatibility requires the same report schema and method, Node/Chrome/Lighthouse versions, operating system and architecture, hosted image, route order, profiles, sample count, throttling, Lighthouse settings, cold-cache policy, and telemetry policy. The hosted runner's transient display name is recorded but does not affect compatibility. Historical artifacts without CLS are incomplete and cannot become comparable baselines; missing CLS is never replaced with zero. A candidate can be skipped as current, future, expired, missing, unavailable, corrupt, provenance-mismatched, or incompatible. Skip reasons remain in the current report even when an older compatible artifact is selected.

No comparable evidence produces null deltas and one explicit state: `first-run`, `missing`, `expired`, `unavailable`, `corrupt`, or `incompatible`. Unavailable GitHub evidence is never labeled as a first run.

## Commands

Run deterministic harness tests without launching Lighthouse:

```bash
npm run test:performance:report
npm run test:performance:baseline
```

Inspect the full plan and browser controls without a build or browser launch:

```bash
npm run performance:report -- --dry-run
```

Run the first complete local report from a clean, stable checkout. The numeric `GITHUB_RUN_ID` values below are synthetic local comparison IDs; they are not evidence that GitHub Actions ran the commands.
Reporter `--output-dir` values are resolved from the repository root even though the root npm script delegates into `main/`.

```bash
GITHUB_RUN_ID=900001 GITHUB_RUN_ATTEMPT=1 GITHUB_RUN_NUMBER=1 \
CHROME_PATH="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" \
npm run performance:report -- \
  --build --serve \
  --output-dir main/performance-results/route-performance-v1/manual-900001
```

Create bounded candidate metadata from the first report, then run a comparable second report from the same unchanged checkout:

```bash
node -e 'const fs=require("node:fs"),path=require("node:path");const p=path.resolve("main/performance-results/route-performance-v1/manual-900001");const s=JSON.parse(fs.readFileSync(path.join(p,"summary.json"),"utf8"));fs.writeFileSync("/tmp/route-performance-candidates.json",JSON.stringify({candidates:[{status:"downloaded",runId:s.run.githubRunId,runAttempt:s.run.githubRunAttempt,artifactName:s.run.artifactName,artifactDir:p,workflowPath:s.run.workflowPath,commitSha:s.provenance.start.sha,completedAt:s.timestamps.completedAt}]},null,2))'

GITHUB_RUN_ID=900002 GITHUB_RUN_ATTEMPT=1 GITHUB_RUN_NUMBER=2 \
CHROME_PATH="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" \
npm run performance:report -- \
  --build --serve \
  --baseline-candidates /tmp/route-performance-candidates.json \
  --output-dir main/performance-results/route-performance-v1/manual-900002
```

Do not edit source, dependencies, lockfiles, configuration, or generated build inputs between the start and completion of either measurement. Generated reports live under the ignored `main/performance-results/` directory.

## GitHub workflow

`.github/workflows/route-performance-report.yml` runs at 07:17 UTC each Wednesday and by manual dispatch. It has read-only repository and Actions permissions, prevents overlapping runs on the same ref, uses a stable artifact name with the run ID and attempt, retains evidence for 21 days, and writes the human-readable report to the Actions summary. The PR/manual Portfolio integrity workflow runs the deterministic report tests and the historical Issue #174 tests; it does not run Lighthouse or enforce timing thresholds.

## Opt-in configured contact diagnostic

The default scenario is `fallback`: the unchanged 90-sample Lighthouse report above, with blank integrations. Manual workflow dispatch can select `configured-contact` instead. This replaces that manual run's matrix with a bounded actual-browser diagnostic; scheduled runs continue measuring fallback and acquiring Lighthouse baselines. Configured artifacts use `configured-contact-v1-<run-id>-<attempt>` and cannot become fallback baselines.

Inspect the configured plan without starting a browser:

```bash
npm run performance:report -- --scenario configured-contact --dry-run
```

Run from a stable checkout with installed dependencies and Chrome:

```bash
CHROME_PATH="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" \
npm run performance:report -- \
  --scenario configured-contact --build --serve \
  --output-dir main/performance-results/configured-contact-v1/local
```

Both `--build` and `--serve` are required. The reporter owns a fresh production build and loopback preview; it rejects supplied Lighthouse baseline candidates and cannot accept an unverified prebuilt fallback. The build forces analytics empty and Formspree to `synthetic-webkit-smoke-key`, matching the WebKit fixture. No application code or dependency changes are needed.

The method is `playwright-contact-native-v1`, schema `configured-contact-performance-v1`. Each desktop (1440x900) and mobile (390x844) viewport records five cold document navigations to `/contact/` and five home-to-contact link navigations: 20 sequential samples, zero retries, a 90-second sample deadline, 10-second cleanup grace and at most a 10-minute suite budget covering the build, owned preview startup, browser launches and samples. Startup and cancellation share that deadline and bounded cleanup; there is no separate version-probe browser. The first sample records its actual Chromium version and later samples must match it. `--measurement-budget-ms` can reduce that budget. A failed sample stops the suite and leaves an incomplete checkpoint; missing, invalid or changed-source evidence fails the command.

Each sample starts a fresh headless Chromium process and context. Playwright request routing disables HTTP caching. The client-navigation mode first loads home and clicks its visible Contact link, retaining the same document and its loaded modules; validation rejects a document reload. Measurements use native CPU/network timing with no artificial throttling. Both profiles explicitly emulate `prefers-reduced-motion: reduce`, while the mobile profile retains mobile/touch emulation. In local probes, the narrow Navbar's automatic smooth scroll left Chromium LCP observations empty; reduced motion produced native entries without changing the application. This is a reduced-motion lab scenario, so its paint timing does not describe the default motion preference. The observation extends through three seconds after all four fields and the submit button become visible. Raw resource entries must show the nonempty Contact JavaScript chunk arriving during that cold/client action. These observations describe this machine and window; they cannot be compared with fallback Lighthouse simulated-throttling medians or treated as a demonstrated regression.

Form-ready time is measured from navigation start (cold) or the link action (client). Cold LCP/FCP are document paint entries observed through that window. Client LCP/FCP remain null because those entries would describe the original home document. Observed CLS sums eligible layout-shift entries in the measured window; transfer totals sum resource `transferSize` in that window. This is a local browser diagnostic, not field Core Web Vitals. Field INP is explicitly unavailable/null. Neither TBT nor mocked task completion is labeled INP.

Before navigation, the context blocks service workers and denies every request outside the exact loopback origin. Chromium background networking/QUIC are disabled and an unreachable external proxy adds a second boundary. Unexpected popups/downloads are closed/cancelled and fail the sample. Only two exact `POST https://formspree.io/f/synthetic-webkit-smoke-key` requests can be fulfilled locally: a synthetic 500 verifies visible error/recovery UI, then a synthetic 200 verifies visible focused success after retry. Task timings measure submit-to-recovery and retry-to-success, including browser automation and mock latency. They do not measure real provider service time. Mocked requests and blocked requests have separate evidence; unknown external requests remain denied. No email draft is opened, real provider submission occurs, or analytics delivery is claimed.

The artifact contains `summary.json`, `report.md`, `manifest.json` and one `raw/<viewport>-<mode>-<sample>.json` per accepted sample. The existing manifest envelope and `validateArtifactDirectory` entry point handle both report methods. Validation checks complete manifest hashes, raw sample hashes, exact scenario/config/method/viewport/context settings (including reduced motion), runtime and machine identity (Node, Chromium, Playwright, OS/release, architecture, hostname, CPU and RAM), form controls, Contact chunk waterfall, observed paint/layout data, traffic policy, mocked task and request evidence. It recomputes raw metrics and all four group medians and rejects incomplete/malformed evidence. Start and completion HEAD/worktree hashes must match; a stable local diff is allowed and fingerprinted. Do not edit source, dependencies or configuration while a run is in progress.

Compare configured results only within the same method/configuration, Node/Chromium/Playwright versions, machine identity, viewport, reduced-motion preference and navigation mode. Even those comparisons are advisory because machine load can vary. This diagnostic deliberately has no automatic baseline selector or threshold gate. All WebSocket attempts are closed without connecting to a server and fail the sample, alongside unexpected popups/downloads.

Request interception captures the Node monotonic clock without querying a paused browser document. After task completion, a document-clock anchor normalizes those request timestamps; its midpoint uncertainty is retained and checked against task timing. Pre-document requests clamp to zero. This approximate request clock is separate from the browser Performance API clocks used for resource, paint and task metrics.

`npm run test:performance:report` includes deterministic configured-contact acceptance and rejection fixtures without starting a browser. Real-browser verification requires the command above and inspection of its artifact. Hosted execution remains a separately authorized workflow dispatch; local results do not claim CI delivery or real Formspree delivery.
