# Resume Map

## Canonical Assets

- PDF: `main/public/waffyAhmedResume.pdf`
- Optimized previews: `main/public/resume-preview.webp` (960px), plus `resume-preview-640.webp`, `resume-preview-1280.webp`, and `resume-preview-1920.webp`
- PNG fallback preview image: `main/public/resume-preview.png`
- Legacy redirect: `main/public/_redirects`

## App References

- `main/src/data/profile.js` defines `resume.pdf`, `resume.preview`, the compatibility `resume.optimizedPreview` path, and responsive `resume.previewSrcSet` / `resume.previewSizes`.
- `main/src/data/resume-preview.mjs` owns responsive source widths, dimensions, byte budgets, and the CSS slot-size expression.
- `main/src/data/resume.mjs` is the canonical data for the semantic resume document.
- `main/src/components/ResumeDocument.jsx` renders the semantic HTML alternative.
- `main/src/pages/Resume.jsx` owns open, download, the WebP-with-PNG-fallback preview, and the semantic alternative on `/resume/`.
- `main/src/pages/Home.jsx` includes the homepage download action.
- `main/src/App.test.jsx` verifies resume route behavior and analytics.

## Generation and Layout Contract

- Run `npm run generate:resume` from the repository root; requires Playwright Chromium, the installed Computer Modern fonts, Poppler `pdftoppm`, and `cwebp` on PATH.
- `main/scripts/generate-resume-assets.mjs` creates a tagged Letter PDF, rasterizes each preview directly from that final PDF, and encodes WebP losslessly. All outputs are prepared and checked in a temporary directory before replacing public assets.
- `main/scripts/resume-layout-reference.json` records the owner-approved Downloads PDF's physical lines, baselines, prose widths, and section rules. Its source hash and historical Git commit make the reference reproducible without the owner's local file.
- `main/scripts/resume-layout.mjs` checks that the print lines still contain the canonical words. A resume content change requires an explicit layout review; do not make a mismatch pass by weakening text normalization or silently reflowing lines.
- Print positioning does not constrain the responsive semantic HTML alternative in `ResumeDocument.jsx`.

## Verification

- `node .codex/skills/resume-site-sync/scripts/check_resume_assets.mjs .` checks canonical links, ordered text, PDF tagging, Letter page count, fallback dimensions, and all responsive image budgets/formats/dimensions.
- `python3 main/scripts/check-resume-layout.py --assets` requires `pdfplumber`, Pillow, and `pdftoppm`. It checks the actual PDF's 53 physical lines and rule geometry, and compares every decoded preview pixel with a render of the final PDF. Text extraction with whitespace collapsed is not a layout check.
- Run `PYTHONDONTWRITEBYTECODE=1 python3 main/scripts/test_resume_layout.py`, `npm test`, and the frontend performance policy tests. The layout regression test specifically rejects identical words moved between lines.
- Inspect desktop 1x/2x and mobile previews and record `currentSrc`. Browser smoke tests gate image arrival to check reserved image space separately from the existing lazy route's initial layout shift.
- Repeat the issue #174 mobile throttling methodology for `/resume/`, with fresh browser profiles and analytics blocked. Record local versus deployed evidence explicitly; local success does not close deployment acceptance.

## Public References

- `main/public/portfolio.json` should expose the canonical absolute resume URL.
- `main/public/llms.txt` should link the canonical resume PDF.
- `main/public/ai-summary.txt` should summarize resume evidence when relevant.
