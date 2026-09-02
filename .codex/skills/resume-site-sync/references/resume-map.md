# Resume Map

## Canonical Assets

- PDF: `main/public/waffyAhmedResume.pdf`
- Optimized preview image: `main/public/resume-preview.webp`
- PNG fallback preview image: `main/public/resume-preview.png`
- Legacy redirect: `main/public/_redirects`

## App References

- `main/src/data/profile.js` defines `resume.pdf`, `resume.preview`, and `resume.optimizedPreview`.
- `main/src/data/resume.mjs` is the canonical data for the semantic resume document.
- `main/src/components/ResumeDocument.jsx` renders the semantic HTML alternative.
- `main/src/pages/Resume.jsx` owns open, download, the WebP-with-PNG-fallback preview, and the semantic alternative on `/resume/`.
- `main/src/pages/Home.jsx` includes the homepage download action.
- `main/src/App.test.jsx` verifies resume route behavior and analytics.

## Public References

- `main/public/portfolio.json` should expose the canonical absolute resume URL.
- `main/public/llms.txt` should link the canonical resume PDF.
- `main/public/ai-summary.txt` should summarize resume evidence when relevant.
