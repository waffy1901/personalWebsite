import { describe, expect, it } from "vitest"
import path from "node:path"
import { resumeDocument } from "../src/data/resume.mjs"
import { resumePreviewVariants } from "../src/data/resume-preview.mjs"
import { validateResumeLayout } from "./resume-layout.mjs"
import { checkResumePreviews, webpDimensions } from "./resume-preview-assets.mjs"

describe("resume print layout contract", () => {
  it("matches the canonical resume content", () => {
    expect(() => validateResumeLayout(resumeDocument)).not.toThrow()
  })

  it("requires explicit layout review after a word is removed or added", () => {
    const changed = structuredClone(resumeDocument)
    changed.experience[0].roles[0].bullets[0] = changed.experience[0].roles[0].bullets[0].replace("daily ", "")
    expect(() => validateResumeLayout(changed)).toThrow(/Resume content changed/)
  })

  it("preserves word boundaries as well as characters", () => {
    const changed = structuredClone(resumeDocument)
    changed.experience[0].roles[0].bullets[0] = changed.experience[0].roles[0].bullets[0].replace("daily order", "dailyorder")
    expect(() => validateResumeLayout(changed)).toThrow(/Resume content changed/)
  })

  it("rejects reordered bullets and removed paragraphs", () => {
    const changed = structuredClone(resumeDocument)
    changed.projects[0].bullets.reverse()
    expect(() => validateResumeLayout(changed)).toThrow(/Resume content changed/)
    changed.projects[0].bullets.reverse()
    changed.skills.pop()
    expect(() => validateResumeLayout(changed)).toThrow(/paragraph count changed/)
  })
})

describe("responsive resume artifacts", () => {
  it("ships all four intentional resolutions within their dimensions and byte budgets", () => {
    expect(resumePreviewVariants.map(({ width }) => width)).toEqual([640, 960, 1280, 1920])
    expect(checkResumePreviews(path.resolve("public"), resumePreviewVariants)).toEqual([])
  })

  it("rejects truncated and mislabeled image containers", () => {
    expect(() => webpDimensions(Buffer.from("not a WebP image"))).toThrow(/Invalid WebP/)
    const bytes = Buffer.alloc(22)
    bytes.write("RIFF")
    bytes.writeUInt32LE(14, 4)
    bytes.write("WEBPVP8L", 8)
    bytes.writeUInt32LE(10, 16)
    expect(() => webpDimensions(bytes)).toThrow(/Truncated/)
  })
})
