import { chromium } from "@playwright/test"
import fs from "node:fs/promises"
import path from "node:path"
import { execFileSync } from "node:child_process"
import { tmpdir } from "node:os"
import { resumeDocument } from "../src/data/resume.mjs"
import { resumeLayout, resumePrintLines, validateResumeLayout } from "./resume-layout.mjs"
import { resumePreviewVariants } from "../src/data/resume-preview.mjs"
import { checkResumePreviews } from "./resume-preview-assets.mjs"

validateResumeLayout(resumeDocument)

const appRoot = path.resolve(import.meta.dirname, "..")
const publicRoot = path.join(appRoot, "public")

// Fail before replacing any asset if the authoring prerequisites are unavailable.
execFileSync("pdftoppm", ["-v"], { stdio: "pipe" })
execFileSync("cwebp", ["-version"], { stdio: "pipe" })

const fontRoot = path.join(appRoot, "node_modules", "computer-modern", "fonts")
const [regularFont, italicFont, boldFont, boldItalicFont] = await Promise.all([
  fs.readFile(path.join(fontRoot, "cmu-serif-500-roman.woff2"), "base64"),
  fs.readFile(path.join(fontRoot, "cmu-serif-500-italic.woff2"), "base64"),
  fs.readFile(path.join(fontRoot, "cmu-serif-700-roman.woff2"), "base64"),
  fs.readFile(path.join(fontRoot, "cmu-serif-700-italic.woff2"), "base64"),
])

const escapeHtml = (value) => String(value)
  .replaceAll("&", "&amp;")
  .replaceAll("<", "&lt;")
  .replaceAll(">", "&gt;")
  .replaceAll('"', "&quot;")

const formatText = (value) => escapeHtml(value)
  .replaceAll(" - ", " &ndash; ")
  .replaceAll("~", "&sim;")
  .replaceAll("'", "&rsquo;")

const links = resumeDocument.contact.map((contact) =>
  `<a href="${escapeHtml(contact.href)}" aria-label="${escapeHtml(contact.label)}: ${escapeHtml(contact.text)}">${formatText(contact.text)}</a>`
).join('<span aria-hidden="true"> | </span>')

const printLines = (key, text, label = "", bullet = false) => resumePrintLines(key, text).map((line, index) => {
  const content = label && index === 0
    ? `<strong>${formatText(label)}:</strong>${formatText(line.text.slice(label.length + 1))}`
    : formatText(line.text)
  return `<span class="print-line" data-width="${line.width}">${bullet && index === 0 ? '<span class="bullet" aria-hidden="true">&bull;</span>' : ""}${content}</span>`
}).join("")

const list = (items, key) => `<ul>${items.map((item, index) => `<li>${printLines(`${key}.${index}`, item, "", true)}</li>`).join("")}</ul>`

const documentHtml = `<!doctype html>
<html lang="${resumeDocument.language}">
  <head>
    <meta charset="utf-8">
    <title>${escapeHtml(resumeDocument.title)}</title>
    <style>
      @font-face { font-family: "CMU Serif"; font-style: normal; font-weight: 400; src: url("data:font/woff2;base64,${regularFont}") format("woff2"); }
      @font-face { font-family: "CMU Serif"; font-style: italic; font-weight: 400; src: url("data:font/woff2;base64,${italicFont}") format("woff2"); }
      @font-face { font-family: "CMU Serif"; font-style: normal; font-weight: 700; src: url("data:font/woff2;base64,${boldFont}") format("woff2"); }
      @font-face { font-family: "CMU Serif"; font-style: italic; font-weight: 700; src: url("data:font/woff2;base64,${boldItalicFont}") format("woff2"); }
      @page { size: Letter; margin: 0; }
      * { box-sizing: border-box; }
      html, body { margin: 0; padding: 0; background: white; color: #000; font-family: "CMU Serif", serif; }
      .resume { position: relative; width: 8.5in; height: 11in; padding: 0.42in 0.5in 0.4in; font-size: 9.9626pt; line-height: 11.9552pt; }
      header { text-align: center; }
      h1 { margin: 0; font-size: 24.907pt; line-height: 1; letter-spacing: -0.04em; }
      .contact { margin: 5pt 0 9pt; font-size: 10pt; line-height: 1; }
      a { color: inherit; text-decoration: underline; text-underline-offset: 1pt; }
      a[href^="tel:"] { text-decoration: none; }
      h2 { margin: 5pt 0 6.5pt; border-bottom: 0.5pt solid transparent; font-size: 12pt; line-height: 1; }
      .section-rule { position: absolute; left: 0; top: 0; height: 3pt; background: #000; transform-origin: top left; }
      h3 { margin: 0; font-size: 11pt; line-height: 1.05; }
      h4 { margin: 0; font-size: 10pt; font-style: italic; line-height: 1.05; }
      p { margin: 0; }
      .entry { margin-left: 10.8pt; }
      .line { display: flex; justify-content: space-between; gap: 12pt; padding-right: 5.4pt; }
      .role .line { padding-right: 6.75pt; }
      .role { margin-top: 3pt; }
      .muted { font-weight: normal; }
      .date { flex: 0 0 auto; font-style: italic; }
      ul { margin: 1pt 0 0 23pt; padding: 0; list-style: none; }
      li { margin: 0 0 -0.687pt; padding-left: 1pt; }
      .print-line { display: block; position: relative; white-space: nowrap; }
      .bullet { position: absolute; left: -9.274pt; font-size: 7pt; }
      .education .entry > .line + .line { margin-top: 3pt; padding-left: 3.1pt; }
      .experience h2 { margin-top: 6.5pt; }
      .experience .role:first-of-type { margin-top: 4pt; }
      .experience .role:first-of-type ul { margin-top: 2pt; }
      .projects h2 { margin: 8.5pt 0 8.9pt; }
      .project { margin-top: 6pt; }
      .project h3 { font-size: 10pt; }
      .project ul { margin-top: 5pt; }
      .skills h2 { margin: 5.15pt 0 5.75pt; }
      .skills p { margin: 0.797pt 0; }
    </style>
  </head>
  <body>
    <main class="resume" aria-label="${escapeHtml(resumeDocument.title)}">
      <header>
        <h1>${formatText(resumeDocument.name)}</h1>
        <p class="contact">${links}</p>
      </header>
      <section class="education" aria-labelledby="education"><h2 id="education">Education</h2>
        ${resumeDocument.education.map((education) => `<div class="entry"><div class="line"><h3>${formatText(education.institution)} <span class="muted">| ${formatText(education.location)}</span></h3><p>${formatText(education.date)}</p></div><div class="line"><p>${formatText(education.degree)}</p><p>${formatText(education.honors)}</p></div></div>`).join("")}
      </section>
      <section class="experience" aria-labelledby="experience"><h2 id="experience">Experience</h2>
        ${resumeDocument.experience.map((employer, employerIndex) => `<div class="entry"><div class="line"><h3>${formatText(employer.company)}</h3><p>${formatText(employer.location)}</p></div>${employer.roles.map((role, roleIndex) => `<article class="role"><div class="line"><h4>${formatText(role.title)}</h4><p class="date">${formatText(role.date)}</p></div>${list(role.bullets, `experience.${employerIndex}.roles.${roleIndex}.bullets`)}</article>`).join("")}</div>`).join("")}
      </section>
      <section class="projects" aria-labelledby="projects"><h2 id="projects">Projects</h2>
        <div class="entry">${resumeDocument.projects.map((project, index) => `<article class="project"><h3>${formatText(project.name)} <span class="muted">| <span style="font-style:italic">${formatText(project.technologies)}</span></span></h3>${list(project.bullets, `projects.${index}.bullets`)}</article>`).join("")}</div>
      </section>
      <section class="skills" aria-labelledby="skills"><h2 id="skills">Skills</h2>
        <div class="entry">${resumeDocument.skills.map((skill, index) => `<p>${printLines(`skills.${index}`, `${skill.label}: ${skill.value}`, skill.label)}</p>`).join("")}</div>
      </section>
      ${resumeLayout.rules.map((rule) => `<span class="section-rule" aria-hidden="true" style="width:${rule.width}pt;transform:translate(${rule.x}pt,${rule.top}pt) scaleY(${rule.height / 3})"></span>`).join("")}
    </main>
  </body>
</html>`

await fs.mkdir(publicRoot, { recursive: true })
const temporaryRoot = await fs.mkdtemp(path.join(tmpdir(), "resume-assets-"))
const pdfPath = path.join(temporaryRoot, "waffyAhmedResume.pdf")
let browser
try {
  browser = await chromium.launch({ headless: true })
  const page = await browser.newPage({ viewport: { width: 816, height: 1056 }, deviceScaleFactor: 1.177 })
  await page.setContent(documentHtml, { waitUntil: "load" })
  await page.evaluate(async (reference) => {
    await document.fonts.ready
    for (const line of document.querySelectorAll(".print-line")) {
      const range = document.createRange()
      const bullet = line.querySelector(".bullet")
      range.setStart(line, bullet ? 1 : 0)
      range.setEnd(line, line.childNodes.length)
      const spaces = range.toString().match(/ /g)?.length ?? 0
      const target = Number(line.dataset.width) * 4 / 3
      const delta = target - range.getBoundingClientRect().width
      if (spaces) {
        // Match the reference's word spacing without stretching glyphs.
        if (Math.abs(delta / spaces) > 2) throw new Error("Reference line requires excessive word spacing")
        line.style.wordSpacing = `${delta / spaces}px`
      }
      if (range.getBoundingClientRect().right > 768.5) throw new Error("Resume line exceeds the right page margin")
    }
    // Position physical lines by the reference baselines. DOM order and semantic
    // headings, lists, and links remain intact for the tagged PDF's reading order.
    const rows = [...document.querySelectorAll("h1, .contact, h2, .line, .project h3, .print-line")]
    if (rows.length !== reference.lines.length) throw new Error("Resume physical line count changed")
    for (const [index, row] of rows.entries()) {
      const target = reference.lines[index]
      const container = row.classList.contains("line") ? row.firstElementChild : row
      const probe = document.createElement("span")
      probe.style.cssText = "display:inline-block;width:0;height:0;padding:0;margin:0;vertical-align:baseline"
      container.append(probe)
      const baseline = probe.getBoundingClientRect().top
      probe.remove()
      const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT)
      let firstText
      while ((firstText = walker.nextNode())) {
        if (firstText.textContent.trim() && !firstText.parentElement.closest(".bullet")) break
      }
      const range = document.createRange()
      range.setStart(firstText, 0)
      range.setEnd(firstText, 1)
      const x = range.getBoundingClientRect().left
      row.style.transform = `translate(${target.x * 4 / 3 - x}px, ${target.baseline * 4 / 3 - baseline}px)`
    }
  }, resumeLayout)
  const metrics = await page.locator(".resume").evaluate((element) => ({
    scrollHeight: element.scrollHeight,
    clientHeight: element.clientHeight,
  }))
  if (metrics.scrollHeight > metrics.clientHeight) {
    throw new Error(`Resume content overflows one Letter page (${metrics.scrollHeight}px > ${metrics.clientHeight}px)`)
  }
  await page.pdf({
    path: pdfPath,
    format: "Letter",
    printBackground: true,
    tagged: true,
    outline: true,
    preferCSSPageSize: true,
  })
  await browser.close()
  browser = null

  for (const variant of resumePreviewVariants) {
    const rasterRoot = path.join(temporaryRoot, `raster-${variant.width}`)
    execFileSync("pdftoppm", ["-f", "1", "-singlefile", "-scale-to-x", String(variant.width), "-scale-to-y", "-1", "-png", pdfPath, rasterRoot])
    execFileSync("cwebp", ["-quiet", "-lossless", "-z", "9", `${rasterRoot}.png`, "-o", path.join(temporaryRoot, variant.src)])
    if (variant.width === 960) await fs.copyFile(`${rasterRoot}.png`, path.join(temporaryRoot, "resume-preview.png"))
  }
  const errors = checkResumePreviews(temporaryRoot, resumePreviewVariants)
  if (errors.length) throw new Error(errors.join("\n"))
  const files = ["waffyAhmedResume.pdf", "resume-preview.png", ...resumePreviewVariants.map(({ src }) => src.slice(1))]
  for (const file of files) await fs.copyFile(path.join(temporaryRoot, file), path.join(publicRoot, file))
  console.log(`Generated ${files.map((file) => `public/${file}`).join(", ")}`)
} finally {
  await browser?.close()
  await fs.rm(temporaryRoot, { recursive: true, force: true })
}
