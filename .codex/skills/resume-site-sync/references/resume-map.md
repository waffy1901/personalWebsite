# Resume Map

## Canonical Assets

- PDF: `main/public/waffyAhmedResume.pdf`
- Preview image: `main/public/resume-preview.png`
- Legacy redirect: `main/public/_redirects`

## App References

- `main/src/data/profile.js` defines `resume.pdf` and `resume.preview`.
- `main/src/pages/Resume.jsx` owns open, download, and preview behavior.
- `main/src/pages/Home.jsx` includes the homepage download action.
- `main/src/App.test.jsx` verifies resume route behavior and analytics.

## Public References

- `main/public/portfolio.json` should expose the canonical absolute resume URL.
- `main/public/llms.txt` should link the canonical resume PDF.
- `main/public/ai-summary.txt` should summarize resume evidence when relevant.
