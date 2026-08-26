import { chromium } from "@playwright/test"
import fs from "node:fs/promises"
import path from "node:path"
import { resumeDocument } from "../src/data/resume.mjs"

const appRoot = path.resolve(import.meta.dirname, "..")
const publicRoot = path.join(appRoot, "public")
const output = {
  pdf: path.join(publicRoot, "waffyAhmedResume.pdf"),
  png: path.join(publicRoot, "resume-preview.png"),
  webp: path.join(publicRoot, "resume-preview.webp"),
}

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

const list = (items) => `<ul>${items.map((item) => `<li>${formatText(item)}</li>`).join("")}</ul>`

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
      .resume { width: 8.5in; height: 11in; padding: 0.42in 0.5in 0.4in; font-size: 10pt; line-height: 1.08; }
      header { text-align: center; }
      h1 { margin: 0; font-size: 25pt; line-height: 1; letter-spacing: -0.04em; }
      .contact { margin: 5pt 0 9pt; font-size: 10pt; line-height: 1; }
      a { color: inherit; text-decoration: underline; text-underline-offset: 1pt; }
      h2 { margin: 5pt 0 6.5pt; border-bottom: 0.5pt solid #000; font-size: 12pt; line-height: 1; }
      h3 { margin: 0; font-size: 11pt; line-height: 1.05; }
      h4 { margin: 0; font-size: 10pt; font-style: italic; line-height: 1.05; }
      p { margin: 0; }
      .entry { margin-left: 11pt; }
      .line { display: flex; justify-content: space-between; gap: 12pt; }
      .role { margin-top: 3pt; }
      .muted { font-weight: normal; }
      .date { flex: 0 0 auto; font-style: italic; }
      ul { margin: 1pt 0 0 23pt; padding: 0; }
      li { margin: 0; padding-left: 1pt; }
      .education .entry > .line + .line { margin-top: 3pt; padding-left: 3.1pt; }
      .experience h2 { margin-top: 6.5pt; }
      .experience .role:first-of-type { margin-top: 4pt; }
      .experience .role:first-of-type ul { margin-top: 2pt; }
      .projects h2 { margin: 8.5pt 0 8.9pt; }
      .project { margin-top: 6pt; }
      .project h3 { font-size: 10pt; }
      .project ul { margin-top: 5pt; line-height: 1.15; }
      .skills h2 { margin: 5.15pt 0 5.75pt; }
      .skills .entry { line-height: 1.2; }
      .skills p { margin: 1pt 0; }
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
        ${resumeDocument.experience.map((employer) => `<div class="entry"><div class="line"><h3>${formatText(employer.company)}</h3><p>${formatText(employer.location)}</p></div>${employer.roles.map((role) => `<article class="role"><div class="line"><h4>${formatText(role.title)}</h4><p class="date">${formatText(role.date)}</p></div>${list(role.bullets)}</article>`).join("")}</div>`).join("")}
      </section>
      <section class="projects" aria-labelledby="projects"><h2 id="projects">Projects</h2>
        <div class="entry">${resumeDocument.projects.map((project) => `<article class="project"><h3>${formatText(project.name)} <span class="muted" style="font-style:italic">| ${formatText(project.technologies)}</span></h3>${list(project.bullets)}</article>`).join("")}</div>
      </section>
      <section class="skills" aria-labelledby="skills"><h2 id="skills">Skills</h2>
        <div class="entry">${resumeDocument.skills.map((skill) => `<p><strong>${formatText(skill.label)}:</strong> ${formatText(skill.value)}</p>`).join("")}</div>
      </section>
    </main>
  </body>
</html>`

await fs.mkdir(publicRoot, { recursive: true })
const browser = await chromium.launch({ headless: true })
try {
  const page = await browser.newPage({ viewport: { width: 816, height: 1056 }, deviceScaleFactor: 1.177 })
  await page.setContent(documentHtml, { waitUntil: "load" })
  const metrics = await page.locator(".resume").evaluate((element) => ({
    scrollHeight: element.scrollHeight,
    clientHeight: element.clientHeight,
  }))
  if (metrics.scrollHeight > metrics.clientHeight) {
    throw new Error(`Resume content overflows one Letter page (${metrics.scrollHeight}px > ${metrics.clientHeight}px)`)
  }
  await page.pdf({
    path: output.pdf,
    format: "Letter",
    printBackground: true,
    tagged: true,
    outline: true,
    preferCSSPageSize: true,
  })
  await page.screenshot({ path: output.png, type: "png", fullPage: false })
  await page.screenshot({ path: output.webp, type: "webp", quality: 47, fullPage: false })
} finally {
  await browser.close()
}

console.log(`Generated ${path.relative(appRoot, output.pdf)}, ${path.relative(appRoot, output.png)}, and ${path.relative(appRoot, output.webp)}`)
