#!/usr/bin/env node
import fs from "node:fs"
import path from "node:path"
import { execFileSync } from "node:child_process"
import { inflateSync } from "node:zlib"
import { pathToFileURL } from "node:url"

const repo = path.resolve(process.argv[2] ?? process.cwd())
const errors = []

const read = (rel) => fs.readFileSync(path.join(repo, rel), "utf8")
const stat = (rel) => {
  try {
    return fs.statSync(path.join(repo, rel))
  } catch {
    errors.push(`Missing ${rel}`)
    return null
  }
}

const normalize = (value) => value
  .normalize("NFKC")
  .replace(/[\u2010-\u2015\u2212]/g, "-")
  .replace(/[\u223C\u2248]/g, "~")
  .replace(/[\u2018\u2019]/g, "'")
  .replace(/-\s+/g, "-")
  .replace(/~\s+/g, "~")
  .replace(/\s+/g, " ")
  .trim()

const readPdfObjects = (buffer) => {
  const source = buffer.toString("latin1")
  const objects = new Map()
  const objectPattern = /(\d+)\s+0\s+obj\b([\s\S]*?)endobj/g

  for (const match of source.matchAll(objectPattern)) {
    const objectNumber = Number(match[1])
    const body = match[2]
    const streamMatch = /stream\r?\n([\s\S]*?)\r?\nendstream/.exec(body)
    let stream = null
    if (streamMatch) {
      const rawStream = Buffer.from(streamMatch[1], "latin1")
      try {
        stream = /\/FlateDecode/.test(body) ? inflateSync(rawStream).toString("latin1") : rawStream.toString("latin1")
      } catch {
        // Keep structural checks running; a missing stream is reported by text assertions.
      }
    }
    objects.set(objectNumber, { body, stream })
  }
  return { source, objects }
}

const parseCMap = (stream) => {
  const map = new Map()
  if (!stream?.includes("begincmap")) return map
  for (const block of stream.matchAll(/\d+\s+beginbfchar\s*([\s\S]*?)endbfchar/gi)) {
    for (const match of block[1].matchAll(/<([0-9A-F]+)>\s+<([0-9A-F]+)>/gi)) {
      const code = Number.parseInt(match[1], 16)
      const unicode = String.fromCodePoint(Number.parseInt(match[2], 16))
      map.set(code, unicode)
    }
  }
  for (const block of stream.matchAll(/\d+\s+beginbfrange\s*([\s\S]*?)endbfrange/gi)) {
    for (const match of block[1].matchAll(/<([0-9A-F]+)>\s+<([0-9A-F]+)>\s+<([0-9A-F]+)>/gi)) {
      const start = Number.parseInt(match[1], 16)
      const end = Number.parseInt(match[2], 16)
      const unicodeStart = Number.parseInt(match[3], 16)
      for (let code = start; code <= end; code += 1) map.set(code, String.fromCodePoint(unicodeStart + code - start))
    }
  }
  return map
}

const extractPdfText = (buffer) => {
  const { objects } = readPdfObjects(buffer)
  const fontObjects = new Map()
  for (const [objectNumber, object] of objects) {
    const cmapReference = /\/ToUnicode\s+(\d+)\s+0\s+R/.exec(object.body)
    if (cmapReference) fontObjects.set(objectNumber, Number(cmapReference[1]))
  }
  const fonts = new Map()
  for (const object of objects.values()) {
    for (const match of object.body.matchAll(/\/(F\d+)\s+(\d+)\s+0\s+R/g)) {
      const cmapObject = fontObjects.get(Number(match[2]))
      if (cmapObject) fonts.set(match[1], parseCMap(objects.get(cmapObject)?.stream))
    }
  }

  const text = []
  for (const object of objects.values()) {
    if (!object.stream?.includes("BT")) continue
    let currentFont = null
    for (const operation of object.stream.split(/(?=BT|ET|\/F\d+\s+[\d.]+\s+Tf|<[0-9A-F]+>\s+Tj)/i)) {
      const fontMatch = /\/(F\d+)\s+[\d.]+\s+Tf/.exec(operation)
      if (fontMatch) currentFont = fontMatch[1]
      const cmap = fonts.get(currentFont)
      if (!cmap) continue
      for (const glyphRun of operation.matchAll(/<([0-9A-F]+)>\s+Tj/gi)) {
        for (let offset = 0; offset < glyphRun[1].length; offset += 4) {
          const glyph = Number.parseInt(glyphRun[1].slice(offset, offset + 4), 16)
          text.push(cmap.get(glyph) ?? "")
        }
      }
      if (/\bET\b/.test(operation)) text.push("\n")
    }
  }
  return normalize(text.join(""))
}

const getPdfInfo = (pdfPath) => {
  try {
    return execFileSync("pdfinfo", [pdfPath], { encoding: "utf8" })
  } catch {
    // Keep the validator portable. The raw PDF checks below cover the same
    // required invariants when Poppler is not installed.
    return null
  }
}

const pngDimensions = (buffer) => ({ width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) })
const webpDimensions = (buffer) => ({
  width: buffer.readUIntLE(24, 3) + 1,
  height: buffer.readUIntLE(27, 3) + 1,
})

const pdf = stat("main/public/waffyAhmedResume.pdf")
const preview = stat("main/public/resume-preview.png")
const optimizedPreview = stat("main/public/resume-preview.webp")
if (pdf && pdf.size === 0) errors.push("Resume PDF is empty")
if (preview && preview.size === 0) errors.push("Resume preview image is empty")
if (optimizedPreview && optimizedPreview.size === 0) errors.push("Optimized resume preview image is empty")

if (errors.length === 0) {
  const profile = read("main/src/data/profile.js")
  const resumePage = read("main/src/pages/Resume.jsx")
  const redirects = read("main/public/_redirects")
  const portfolio = JSON.parse(read("main/public/portfolio.json"))
  const llms = read("main/public/llms.txt")

  if (!profile.includes('pdf: "/waffyAhmedResume.pdf"')) errors.push("profile.js does not use canonical resume PDF path")
  if (!profile.includes('preview: "/resume-preview.png"')) errors.push("profile.js does not use canonical resume preview path")
  if (!resumePage.includes("resume.pdf") || !resumePage.includes("resume.preview")) {
    errors.push("Resume.jsx should render from resume.pdf and resume.preview")
  }
  if (!resumePage.includes("ResumeDocument")) errors.push("Resume.jsx missing the semantic HTML resume document")
  if (portfolio.links?.resume !== "https://waffy.dev/waffyAhmedResume.pdf") {
    errors.push("portfolio.json resume link is not canonical")
  }
  if (!llms.includes("https://waffy.dev/waffyAhmedResume.pdf")) {
    errors.push("llms.txt missing canonical resume PDF link")
  }
  if (!redirects.includes("/waffyahmedresume.pdf /waffyAhmedResume.pdf 301")) {
    errors.push("_redirects missing legacy lowercase resume redirect")
  }

  const pdfPath = path.join(repo, "main/public/waffyAhmedResume.pdf")
  const pdfBuffer = fs.readFileSync(pdfPath)
  const pdfSource = pdfBuffer.toString("latin1")
  const pdfInfo = getPdfInfo(pdfPath)
  const requiredStructure = [
    "/StructTreeRoot",
    "/ParentTree",
    "/MarkInfo",
    "/S /Document",
    "/S /H1",
    "/S /H2",
    "/S /H3",
    "/S /H4",
    "/S /L",
    "/S /LI",
    "/S /Link",
    "/Subtype /Link",
  ]
  for (const token of requiredStructure) {
    if (!pdfSource.includes(token)) errors.push(`Resume PDF missing structural token ${token}`)
  }
  if (!pdfSource.includes("/Lang (en-US)")) errors.push("Resume PDF language is not en-US")
  if (!pdfSource.includes("/Title (Waffy Ahmed Resume)")) errors.push("Resume PDF title metadata is not descriptive")
  if (!pdfSource.includes("/Marked true")) errors.push("Resume PDF does not mark content as tagged")
  if ((pdfSource.match(/\/Type\s*\/Page\b/g) ?? []).length !== 1) errors.push("Resume PDF must have one page")
  if (!/\/MediaBox\s*\[0\s+0\s+612\s+792\]/.test(pdfSource)) errors.push("Resume PDF must use Letter page dimensions")
  if (pdfInfo) {
    if (!pdfInfo.includes("Title:           Waffy Ahmed Resume")) errors.push("pdfinfo title metadata is not descriptive")
    if (!pdfInfo.includes("Tagged:          yes")) errors.push("pdfinfo does not report a tagged PDF")
    if (!pdfInfo.includes("Pages:           1")) errors.push("pdfinfo does not report one PDF page")
    if (!pdfInfo.includes("Page size:       612 x 792 pts (letter)")) errors.push("pdfinfo does not report Letter page dimensions")
  }

  const { resumeDocument } = await import(pathToFileURL(path.join(repo, "main/src/data/resume.mjs")).href)
  const extractedText = extractPdfText(pdfBuffer)
  const expectedText = [
    resumeDocument.name,
    ...resumeDocument.contact.map((contact) => contact.text),
    "Education",
    ...resumeDocument.education.flatMap((education) => [
      education.institution,
      education.location,
      education.date,
      education.degree,
      education.honors,
    ]),
    "Experience",
    ...resumeDocument.experience.flatMap((employer) => [
      employer.company,
      employer.location,
      ...employer.roles.flatMap((role) => [role.title, role.date, ...role.bullets]),
    ]),
    "Projects",
    ...resumeDocument.projects.flatMap((project) => [project.name, project.technologies, ...project.bullets]),
    "Skills",
    ...resumeDocument.skills.flatMap((skill) => [skill.label, skill.value]),
  ]
  let lastIndex = -1
  for (const expected of expectedText) {
    const index = extractedText.indexOf(normalize(expected), lastIndex + 1)
    if (index < 0) errors.push(`Extracted resume PDF text is missing: ${expected}`)
    else lastIndex = index
  }
  for (const contact of resumeDocument.contact) {
    if (!pdfSource.includes(contact.href)) errors.push(`Resume PDF is missing link annotation target: ${contact.href}`)
  }

  const png = fs.readFileSync(path.join(repo, "main/public/resume-preview.png"))
  const webp = fs.readFileSync(path.join(repo, "main/public/resume-preview.webp"))
  if (!png.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) errors.push("Resume PNG preview has an invalid signature")
  if (webp.subarray(0, 4).toString("ascii") !== "RIFF" || webp.subarray(8, 12).toString("ascii") !== "WEBP") errors.push("Resume WebP preview has an invalid signature")
  if (png.length >= 24 && (pngDimensions(png).width < 800 || pngDimensions(png).height < 1000)) errors.push("Resume PNG preview dimensions are unexpectedly small")
  if (webp.length >= 30 && (webpDimensions(webp).width < 800 || webpDimensions(webp).height < 1000)) errors.push("Resume WebP preview dimensions are unexpectedly small")
}

if (errors.length > 0) {
  console.error("Resume asset check failed:")
  for (const error of errors) console.error(`- ${error}`)
  process.exit(1)
}

console.log("Resume asset check passed")
