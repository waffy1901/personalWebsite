# External link reporting

The External link report is a weekly and manually dispatched advisory check of current public HTTP(S) destinations referenced by the portfolio. It runs each Monday at 08:23 UTC and does not run on pull requests. During the initial rollout, neither the fixtures nor the external scan gates unrelated pull requests; the scheduled/manual workflow runs both.

## Inventory scope

The inventory reads only these local sources:

- direct `.js` and `.mjs` files in `main/src/data/`;
- `main/public/portfolio.json`, `main/public/ai-summary.txt`, and `main/public/llms.txt`;
- content inside the `generated-public-docs` marker blocks in `README.md` and `main/README.md`.

The checker extracts literal canonical URLs from source modules and generated resolved URLs from the named public documents. It does not execute source code or recurse through documentation, historical audits, build output, temporary artifacts, or remote pages. Every occurrence retains its file, line, and original URL. HTTP destinations are deduplicated after fragments are removed; query strings remain distinct.

The inventory records narrow exclusions and their source attribution. It excludes `waffy.dev` destinations already covered by the deployed-security-headers workflow, non-HTTP destinations, private or loopback production targets, URLs containing credentials, Formspree submission services, and analytics services. GitHub and LinkedIn remain eligible. An empty inventory or more than 200 eligible URLs is a setup failure.

## Request and classification policy

The workflow installs checksum-pinned Lychee 0.24.2 and makes credential-free HTTP GET requests. The checker accepts only 2xx responses, follows at most 10 redirects, verifies TLS, uses three requests globally and one per host, waits at least one second between requests to a host, and limits each request to 15 seconds. It does not use cookies, a cache, suggestions, fragments, mail checks, JavaScript, forms, endpoint credentials, or a GitHub token.

Lychee performs no internal retries. The wrapper retries only 408, 429, 5xx, timeout, connection, and network failures in at most two additional rounds, after two and four seconds. Successful URLs and permanent HTTP failures are not retried.

Results are classified as follows:

- `healthy`: a confirmed 2xx response whose final destination is not a known login, authwall, checkpoint, or challenge page;
- `broken`: a permanent 4xx response outside the blocked set, or a persistent 5xx response after three total attempts;
- `blocked`: 401, 403, 407, 418, 429, 451, or 999, and known login/authwall/challenge destinations even when they return 2xx;
- `inconclusive`: timeout, connection, network, unexpected, missing, or incomplete evidence.

Blocked and inconclusive responses never imply that a destination is healthy. Link outcomes are advisory and return a successful workflow status only when every eligible URL has a complete outcome. Missing, malformed, stale, or incomplete runner evidence is a setup failure.

## Evidence and limits

Each run writes `inventory.json`, `urls.txt`, `report.json`, `report.md`, and raw JSON/stdout/stderr/URL inputs for every round. The workflow appends `report.md` to the Actions summary and retains the complete directory for 21 days under a run-and-attempt-specific artifact name. The report records its schema, generation time, source commit, tool version, input policy, exclusions, attempts, redirect chains, final attempted destinations, counters, and completion state.

This is HTTP-only evidence. It does not execute JavaScript, submit or validate actual forms, check fragments, access authenticated content, prove search indexing, render pages in a browser, or judge semantic page health. A hosted workflow run is still required before treating the schedule, runner installation, and retained artifact behavior as verified.

## Local reproduction

From the repository root, install the pinned binary and run the deterministic loopback fixtures:

```bash
bash scripts/install-lychee.sh /tmp/personalWebsite-lychee
LYCHEE_BIN=/tmp/personalWebsite-lychee/lychee npm run test:links
```

Create the current inventory without network requests:

```bash
npm run links:inventory
```

Custom output directories must be strict descendants of the selected repository's `external-link-results/` directory, such as `external-link-results/local/inventory`. The checker rejects the owned output root itself, paths outside that subtree, and paths with existing symbolic-link or non-directory components before cleanup. A valid run replaces only its selected output directory and preserves sibling runs.

Run the advisory real-link report explicitly:

```bash
LYCHEE_BIN=/tmp/personalWebsite-lychee/lychee npm run links:report
```

The real-link report command has an eight-minute overall checker bound, and the Actions job has a 15-minute timeout covering installation, fixtures, and reporting. The `--allow-loopback-fixtures` switch exists only for local fixtures; ordinary runs exclude private and loopback targets.

## Initial local evidence

The local report generated on October 2, 2026 used Node 22.22.3 and Lychee 0.24.2 against the current inventory at source HEAD `10ab39937ef836e35faa000e0148bbb1a9c6ea75`. It retained 82 source occurrences, five eligible destinations, and 18 reasoned exclusions. All four GitHub destinations returned HTTP 200. LinkedIn followed one redirect and returned HTTP 999, so it remains `blocked` and eligible rather than being excluded or considered healthy. No destination was classified as broken or inconclusive in that complete advisory report.

The local evidence is retained under `external-link-results/current/`. Hosted execution and issue closure remain pending.
