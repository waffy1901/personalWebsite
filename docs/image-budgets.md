# Image delivery and byte budgets

Issue #172 keeps image dimensions and the existing visual design while reducing
encoded bytes and making image regressions fail the Portfolio integrity PR check.
The canonical social card is `/og-image-v3.jpg` (1200x630, JPEG); the older PNG
URLs remain available for existing links and caches.

## Encoding decisions

| Asset | Before (B) | After (B) | Reduction | Decision |
| --- | ---: | ---: | ---: | --- |
| Canonical social card | 1,147,212 | 243,688 | 78.8% | JPEG quality 92, 4:4:4, optimized, original dimensions |
| CDC project WebP | 40,944 | 18,346 | 55.2% | WebP quality 90, original 275x183 |
| Job Search project WebP | 20,116 | 11,104 | 44.8% | WebP quality 90, original 259x194 |
| Discovery Service project WebP | 19,118 | 7,062 | 63.1% | WebP quality 90, original 300x168 |

The exact lossless PNG social-card candidate was 886,284 B. JPEG was chosen after
native-size inspection of text, fine lines, and the portrait. The three project
WebPs were already lossless; quality-90 candidates offered further useful savings
without resizing the logos. Their alpha channels match the PNG originals exactly.
PNG logo fallbacks retain their original bytes. These decisions concern local
visual quality, not a claimed provider-specific file-size limit.

Portraits remain 450x600 WebP (43,400 B), 675x900 WebP (89,616 B), and the 675x900
JPEG fallback (210,685 B). Existing responsive sources avoid sending the full JPEG
to WebP-capable browsers. No extra portrait re-encoding was needed.

Resume files are unchanged: the canonical PDF and PNG paths remain available,
and the four lossless WebPs retain their sharp text and responsive source set.
Their encoded sizes are 61,954 B (640w), 93,424 B (960w), 134,706 B (1280w), and
218,188 B (1920w); the 960x1243 PNG fallback remains 384,203 B.

## Priority and layout

Home reads its `(min-width: 1024px)` layout query before the first image render.
The desktop portrait is eager/high priority; below that breakpoint it is
lazy/auto because it follows the hero text. Media-query changes update the same
image element. A guarded `innerWidth`/resize fallback supports environments
without `matchMedia`. Async decoding, explicit dimensions, responsive `sizes`,
and the existing reserved CSS height remain in place.

Lazy loading is a browser hint. A browser may fetch an offscreen image that is
near its viewport; this change does not promise that mobile skips the portrait
request entirely. Resume remains eager/high priority and repeated logos remain
lazy, with async decoding.

## Budget ownership

`config/image-budgets.json` lists the source raster inventory in
`main/src/images` and `main/public`, including fallbacks, icons, and legacy social
cards. Adding a raster in those directories without an explicit budget fails.
Deleting a budgeted file also fails. Ceilings count encoded file bytes, without
HTTP headers, compression assumptions, or browser timing thresholds.

The social JPEG ceiling is 300,000 B, about 23% above its measured size. Project
WebP ceilings are 24,000 / 15,000 / 10,000 B (CDC / Job Search / Discovery),
leaving 31% / 35% / 42% headroom for small intentional edits. Unchanged sources
and fallbacks generally retain 14-27% headroom; the compatibility-only v2 social
PNG has a 1,200,000 B ceiling. These are regression limits, not target sizes.

Resume WebP dimensions and ceilings are imported directly from
`main/src/data/resume-preview.mjs` (80,000 / 120,000 / 180,000 / 270,000 B), so the
new checker does not maintain a competing set of resume limits. It also requires
their lossless encoding. The PNG fallback ceiling is 450,000 B.

The checker uses only Node built-ins and the existing dependency-free WebP header
reader. It checks file signatures, header dimensions, configured formats, byte
ceilings, inventory coverage, and path containment. It is not a full pixel decoder
or a substitute for visual review. Fixtures cover inclusive byte boundaries,
oversize/missing/unbudgeted files, dimensions, wrong formats, malformed headers,
invalid config, duplicate budgets, symlink escapes, inherited resume policy, and
CLI exit status. The PR workflow runs both fixtures and the real source check.

## Reproduce and verify

Use the repository Node pin (22.22.3) and the locked app dependencies. Prefix
commands with `rtk` in this repository:

```sh
rtk npm run check:image-budgets
rtk npm run test:image-budgets
rtk proxy node .codex/skills/portfolio-performance-auditor/scripts/check_frontend_performance.mjs .
rtk proxy node --test .codex/skills/portfolio-performance-auditor/scripts/test_frontend_performance.mjs
rtk npm run generate:public -- --check
rtk npm run lint:workflows
rtk npm run lint
rtk npm run test
rtk npm run build
```

Candidates were encoded with Pillow 13.0.0 from the existing PNG originals:
`save(format="JPEG", quality=92, subsampling=0, optimize=True)` for the social
card, and `save(format="WEBP", quality=90, method=6, exact=True)` for the logos.
The lossless comparison used PNG `optimize=True, compress_level=9` and WebP
`lossless=True, method=6, exact=True`. Pillow is an asset-authoring tool only;
the app and CI checker gain no dependency.

The canonical image URL and JPEG MIME type are aligned in SEO data, the source
shell, browser metadata updates, and all prerendered route shells. Regenerated
JSON-LD uses the new URL and its CSP hash is regenerated by `generate:public`.
The deployed-artifact contract checks the current JPEG and the legacy v2 PNG.

## Local browser evidence and limits

On 2026-11-05 UTC, five cold loopback-preview samples per profile compared base
`a57cc7d166ddbe9b6fc2e9af88d1679d728ed6e5` with the local candidate. Node 22.22.3,
locked Playwright 1.64.1, and Chromium 156.0.8078.4 were used. Both profiles used
DPR 1, 150 ms latency, 1638 Kbps download and 750 Kbps upload; mobile was 390x844
with 4x CPU slowdown and desktop was 1440x1000 with 1x CPU. External traffic was
blocked before navigation.
Each sample used a newly launched Chromium process, an isolated context, and
disabled cache. The LCP observer was registered before navigation and finalized
1500 ms after `networkidle`; both builds disabled GA and used a synthetic
Formspree key.

| Home profile | Before median LCP | After median LCP | Observed CLS |
| --- | ---: | ---: | ---: |
| Mobile | 1084 ms | 1088 ms | 0 in all samples |
| Desktop | 1312 ms | 1328 ms | 0 in all samples |

The LCP element remained text on mobile and the portrait on desktop. These small
timing differences show no demonstrated speedup. The portrait was below the
mobile fold (top 1327.25 px), and its initial request priority changed from High
to Low; desktop retained High. There was one portrait request per sample and no
page errors. Chromium still fetched the lazy mobile portrait within its proximity
threshold. Measured encoded homepage resources were 158,414 B before and
158,675 B after because of the small responsive-policy script overhead; this
work does not claim a homepage byte reduction. The social-card and project-image
byte savings apply where those images are requested.

On the same date, Chromium and locked Playwright WebKit 2370 passed Home,
Projects, and Resume checks at 390x844 and 1440x1000, each at DPR 1 and 2 (24
route/profile checks). Images decoded, no horizontal overflow or page errors
were found, and removing picture sources successfully exercised the PNG/JPEG
fallbacks. All 12 Chromium checks measured CLS 0; numeric CLS was unavailable in
WebKit. The portrait selected 450w on mobile and desktop DPR 1, and 675w on
desktop DPR 2. Resume selected 640w on mobile, 960w on desktop DPR 1, and 1920w
on desktop DPR 2. These are automated engine checks, not real Safari/iOS tests.

Local HTTP probes using Twitterbot, LinkedInBot, and WhatsApp user agents
returned HTTP 200 for the page shell and the 243,688 B JPEG with the correct MIME
type. All 13 built route shells used the current JPEG URL and MIME metadata.
Bot user-agent probes do not exercise the actual social platforms or caches.

Local checks establish source/build consistency and representative browser
appearance; they do not establish production provenance, social-provider cache
refresh, or actual LinkedIn/X/Facebook unfurl behavior. Those external previews
remain a separate post-publication verification limit.
