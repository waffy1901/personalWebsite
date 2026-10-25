# JavaScript and CSS byte budgets

Refs #287. The existing `Main PR CI / Verify app` job runs synthetic checker
fixtures, makes its normal production build once, and checks that build against
absolute limits in [`config/bundle-budgets.json`](../config/bundle-budgets.json).
The new steps fail the job on a checker error or any exceeded limit. Existing
job names, permissions, action pins, and the separate browser lane are retained.

Run from the repository root with Node 22.22.3:

```bash
npm ci --prefix main
npm run test:bundle-budgets
VITE_GA_MEASUREMENT_ID= VITE_FORMSPREE_KEY=synthetic-premerge-test-key npm run build
npm run check:bundle-budgets
```

The non-secret synthetic Formspree key keeps the production contact form code in
the measured build; an empty key removes most of that code and understates its
size. The empty analytics ID disables telemetry. These commands do not run a
browser or submit a form. CI sets both values on the existing Build step.

The checker defaults to `main/dist/.vite/manifest.json` and the checked-in budget
configuration, independent of the caller's working directory. For isolated
fixtures or a copied build, use:

```bash
npm run check:bundle-budgets -- --dist /tmp/copied-dist --config /tmp/budgets.json
```

## Membership and measurement

Startup is the union of every Vite `isEntry` chunk's transitive static `imports`
closure, including each chunk's associated `css`. `dynamicImports` are excluded
from that traversal. JS and CSS are deduplicated by output path, including shared
imports and cycles. Membership follows the generated manifest rather than
hashed filenames or a hard-coded list of startup assets.

Each configured lazy source must exist and be marked `isDynamicEntry`. Its group
contains its full static closure with all startup JS/CSS subtracted. Every route
starts with the same startup cache: shared lazy assets are counted once for each
route that uses them, without being amortized across routes. For example,
`CaseStudy.jsx` statically imports `NotFound.jsx`, so its budget includes that
chunk as well as its own. Nested dynamic entries get separate budgets. Every
manifest dynamic entry must have an explicit configuration key; new splitting or
source renames require a deliberate configuration review.

The checker validates manifest shape, flags, static and dynamic graph edges,
configuration fields and integer limits, safe relative output paths, and regular
JS/CSS files. Missing, malformed, empty, or incomplete output fails. It also
validates JS/CSS assets belonging to manifest chunks outside the measured groups.
Images, fonts, and other assets are excluded from the byte contract.

Each asset is compressed separately using Node `gzipSync`: level 9, windowBits
15, memLevel 8, strategy `Z_DEFAULT_STRATEGY`, gzip MTIME 0. Raw byte lengths and
gzip byte lengths are summed separately per group and type. The log prints the
Node/zlib versions, asset paths, actual/limit/signed delta (`actual - limit`), and
elapsed checker time. Equality passes; a positive delta fails with exit status 1.
Invalid input and CLI arguments also exit 1. There is no automatic rebaselining.

## Recorded clean baseline and limits

Measured at **2026-10-25T23:38:46.332Z** from clean commit
`0a33c553421a066c689d68d928cbcbc7fec73372`, after `npm ci --prefix main` and the
production build command above. Platform: darwin arm64. Tools: Node v22.22.3,
npm 11.17.0, zlib 1.3.1-e00f703, Vite 8.3.4, Rolldown 1.2.13, React 19.3.1,
Tailwind CSS 4.3.3. `main/package-lock.json` SHA-256:
`1629a0ebbe8f9a2db0105458b557de0c4ceddbb423513e403a35484aa5f9f95d`.
Observed `.vite/manifest.json` SHA-256:
`32a07b548a4abeeb2ecfbcd1180e974f7d23e87058fe27d745aadf9f11806aa2`.

All values below are bytes, shown as **raw / gzip**. These observations are a
source baseline, not a promise of identical builds: injected deployment timestamps
and output hashes can change compressed size slightly.

| Group | Baseline JS | JS limit | Baseline CSS | CSS limit |
| --- | ---: | ---: | ---: | ---: |
| `startup` | 313868 / 99549 | 380000 / 120000 | 77483 / 12668 | 95000 / 16000 |
| `src/pages/CaseStudies.jsx` | 15298 / 6080 | 19000 / 7600 | 0 / 0 | 2000 / 1000 |
| `src/pages/CaseStudy.jsx` | 20328 / 7357 | 25000 / 9000 | 0 / 0 | 2000 / 1000 |
| `src/pages/Contact.jsx` | 35512 / 11719 | 43000 / 14500 | 0 / 0 | 2000 / 1000 |
| `src/pages/Experience.jsx` | 27390 / 10034 | 34000 / 12500 | 0 / 0 | 2000 / 1000 |
| `src/pages/NotFound.jsx` | 727 / 427 | 1000 / 600 | 0 / 0 | 2000 / 1000 |
| `src/pages/Projects.jsx` | 13049 / 4771 | 16000 / 6000 | 0 / 0 | 2000 / 1000 |
| `src/pages/Resume.jsx` | 11510 / 4270 | 14000 / 5300 | 0 / 0 | 2000 / 1000 |

Startup and normal route JS limits allow roughly 20-30% growth from the measured
baseline, rounded to readable absolute numbers. Startup CSS allows about 23% raw
and 26% gzip growth. The small NotFound chunk uses rounded minimums (about 38-41%
growth). Each currently empty lazy CSS group has an explicit 2000 raw / 1000 gzip
byte allowance for a small future route stylesheet; percentage headroom is
undefined for a zero baseline. Limits are independent of the current build.

The baseline's asset membership was:

- `startup` JS: `assets/MissionControl-OtzCWnZL.js`, `assets/index-DAMjYerH.js`. CSS: `assets/index-lY-z7SSS.css`.
- `src/pages/CaseStudies.jsx` JS: `assets/CaseStudies-D7PQW7RN.js`, `assets/caseStudies-DKPNYoze.js`, `assets/cdcLogo-8kHjk12k.js`, `assets/hdLogo-BAre_BTv.js`. CSS: none.
- `src/pages/CaseStudy.jsx` JS: `assets/CaseStudy-DyHMgFbF.js`, `assets/NotFound-D9RmQX8o.js`, `assets/caseStudies-DKPNYoze.js`, `assets/cdcLogo-8kHjk12k.js`, `assets/hdLogo-BAre_BTv.js`. CSS: none.
- `src/pages/Contact.jsx` JS: `assets/Contact-BQNP7XWu.js`. CSS: none.
- `src/pages/Experience.jsx` JS: `assets/Experience-Cae1sAtY.js`, `assets/cdcLogo-8kHjk12k.js`, `assets/hdLogo-BAre_BTv.js`. CSS: none.
- `src/pages/NotFound.jsx` JS: `assets/NotFound-D9RmQX8o.js`. CSS: none.
- `src/pages/Projects.jsx` JS: `assets/Projects-JYO4-rXl.js`, `assets/cdcLogo-8kHjk12k.js`. CSS: none.
- `src/pages/Resume.jsx` JS: `assets/Resume-CqGSLSmF.js`. CSS: none.

## Reviewing changes and evidence limits

When a budget fails, inspect the listed assets and manifest closure first. Prefer
removing unintended weight. An intentional limit increase needs an explained,
reviewed diff with the product/engineering reason, before/after raw and gzip
measurements, exact commit and tool/environment/compression details, revised
headroom rationale, and a refreshed recorded baseline. Changing the current
output must never reset limits automatically or silently remove a lazy group.
Keep both raw and gzip limits: highly compressible growth can otherwise hide a
large parse/evaluation payload.

`npm run test:bundle-budgets` uses temporary synthetic output and CLI subprocesses
without network or browser access. It covers exact boundaries, raw-only and
gzip-only failures, graph/CSS deduplication and cycles, multiple entries, lazy
startup subtraction, shared lazy dependencies, nested dynamic coverage, hash
renaming, invalid config/manifest/edges/assets, unsafe paths, and CLI errors. An
isolated oversize negative control can copy `main/dist` to a temporary directory,
enlarge a startup JS file, run `--dist` against the copy and require exit 1 with
`OVER LIMIT`, then discard that copy and verify the original still passes.

Local checker/fixture elapsed times are supporting runtime evidence, not hosted
runner timing. Successful exact-head hosted PR execution, failure propagation,
and incremental runner duration/cost remain pending until an authorized PR run;
no billable cost is inferred from local wall time. No new job or second build is
introduced by this gate.

This is a reproducible local gzip estimate. It does not establish actual Netlify
or CDN transfer encoding/bytes, cache behavior, browser parse/execute cost, LCP,
or user-perceived speed. Lighthouse timing remains advisory under the existing
[performance reporting policy](performance-reporting.md). Image budgets remain
owned by issue #172. Hosted CI evidence is still required for issue acceptance;
local success alone does not complete or close it.
