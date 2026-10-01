# Route Performance Reporting

The route performance report is a scheduled and manually dispatched evidence job. It measures every canonical route exported by `main/src/data/seo.js` against mobile and desktop Lighthouse profiles. This reporting path is separate from the historical Issue #174 baseline harness, whose fixed eight-route, 80-run measurement contract remains unchanged.

## Measurement contract

- The workflow builds the production app once, serves it only on `http://127.0.0.1:4173`, and visits all nine current canonical routes.
- Each route/profile group has five sequential cold-cache samples. Each sample starts a fresh Chrome process and temporary user-data directory. A failed attempt receives at most one retry after Chrome cleanup finishes.
- The current route inventory produces 90 primary samples and permits at most 180 attempts. Each attempt has a 90-second deadline and a bounded 10-second cleanup grace. If cleanup does not settle, the matrix stops with partial evidence instead of launching another Chrome instance. The harness has a 40-minute measurement budget, the GitHub job has a 50-minute deadline, and the suite has no whole-run retry.
- Google Analytics, Google Tag Manager, DoubleClick, and Formspree URL patterns are blocked before navigation. The browser uses an unreachable loopback proxy, disables QUIC, and bypasses the proxy only for `127.0.0.1`. Analytics and Formspree build variables are empty. The job never submits the contact form.
- Timing and byte deltas are advisory. Missing samples, invalid diagnostics, changed source provenance, or corrupt evidence make the job fail.

Every successful artifact contains `summary.json`, `report.md`, `manifest.json`, and the raw Lighthouse result for each accepted sample. The manifest hashes every retained file. Validation recomputes metrics and diagnostics from each raw result, checks its Lighthouse and Chrome versions and profile settings, recomputes route/profile medians, and verifies the start and completion commit and worktree fingerprints.

## Baseline selection

The acquisition step reads at most 20 successful `main` runs of the same workflow and excludes the current and future runs. It downloads the latest retained artifact named `route-performance-v1-<run-id>-<attempt>` and validates its manifest, raw reports, summary, commit SHA, run ID, run attempt, workflow path, and artifact name.

Compatibility requires the same report schema and method, Node/Chrome/Lighthouse versions, operating system and architecture, hosted image, route order, profiles, sample count, throttling, Lighthouse settings, cold-cache policy, and telemetry policy. The hosted runner's transient display name is recorded but does not affect compatibility. A candidate can be skipped as current, future, expired, missing, unavailable, corrupt, provenance-mismatched, or incompatible. Skip reasons remain in the current report even when an older compatible artifact is selected.

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
