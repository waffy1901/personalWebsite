// Render every size directly from the tagged PDF, then encode losslessly.
// Budgets include headroom over the measured reference-layout assets.
export const resumePreviewVariants = [
  { src: "/resume-preview-640.webp", width: 640, height: 829, maxBytes: 80_000 },
  { src: "/resume-preview.webp", width: 960, height: 1243, maxBytes: 120_000 },
  { src: "/resume-preview-1280.webp", width: 1280, height: 1657, maxBytes: 180_000 },
  { src: "/resume-preview-1920.webp", width: 1920, height: 2485, maxBytes: 270_000 },
]

export const resumePreviewSrcSet = resumePreviewVariants.map(({ src, width }) => `${src} ${width}w`).join(", ")

// Page padding + panel border/padding + preview border/padding; image caps at 882px.
export const resumePreviewSizes = "(min-width: 974px) 882px, (min-width: 640px) calc(100vw - 92px), calc(100vw - 84px)"
