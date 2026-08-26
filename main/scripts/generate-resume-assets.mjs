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

const escapeHtml = (value) => String(value)
  .replaceAll("&", "&amp;")
  .replaceAll("<", "&lt;")
  .replaceAll(">", "&gt;")
  .replaceAll('"', "&quot;")

const links = resumeDocument.contact.map((contact) =>
  `<a href="${escapeHtml(contact.href)}" aria-label="${escapeHtml(contact.label)}: ${escapeHtml(contact.text)}">${escapeHtml(contact.text)}</a>`
).join('<span aria-hidden="true"> | </span>')

const list = (items) => `<ul>${items.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>`

const documentHtml = `<!doctype html>
<html lang="${resumeDocument.language}">
  <head>
    <meta charset="utf-8">
    <title>${escapeHtml(resumeDocument.title)}</title>
    <style>
      @page { size: Letter; margin: 0; }
      * { box-sizing: border-box; }
      html, body { margin: 0; padding: 0; background: white; color: #111827; font-family: Arial, Helvetica, sans-serif; }
      .resume { width: 8.5in; height: 11in; padding: 0.42in 0.5in 0.38in; font-size: 8.1pt; line-height: 1.16; }
      header { text-align: center; }
      h1 { margin: 0; font-size: 23pt; letter-spacing: 0.01em; }
      .contact { margin: 3pt 0 7pt; font-size: 8.8pt; }
      a { color: inherit; text-decoration: underline; text-underline-offset: 2pt; }
      h2 { margin: 7pt 0 4pt; border-bottom: 0.7pt solid #374151; font-size: 12pt; line-height: 1.12; }
      h3 { margin: 0; font-size: 9.5pt; }
      h4 { margin: 0; font-size: 8.5pt; font-style: italic; }
      p { margin: 0; }
      .line { display: flex; justify-content: space-between; gap: 12pt; }
      .role { margin-top: 3pt; }
      .muted { font-weight: normal; }
      .date { flex: 0 0 auto; font-style: italic; }
      ul { margin: 1.5pt 0 0 13pt; padding: 0; }
      li { margin: 0 0 0.7pt; padding-left: 1pt; }
      .project { margin-top: 3pt; }
      .skills p { margin: 1.4pt 0; }
      .skills strong { font-size: 8.4pt; }
    </style>
  </head>
  <body>
    <main class="resume" aria-label="${escapeHtml(resumeDocument.title)}">
      <header>
        <h1>${escapeHtml(resumeDocument.name)}</h1>
        <p class="contact">${links}</p>
      </header>
      <section aria-labelledby="education"><h2 id="education">Education</h2>
        ${resumeDocument.education.map((education) => `<div class="line"><h3>${escapeHtml(education.institution)} <span class="muted">| ${escapeHtml(education.location)}</span></h3><p>${escapeHtml(education.date)}</p></div><div class="line"><p>${escapeHtml(education.degree)}</p><p>${escapeHtml(education.honors)}</p></div>`).join("")}
      </section>
      <section aria-labelledby="experience"><h2 id="experience">Experience</h2>
        ${resumeDocument.experience.map((employer) => `<div class="line"><h3>${escapeHtml(employer.company)}</h3><p>${escapeHtml(employer.location)}</p></div>${employer.roles.map((role) => `<article class="role"><div class="line"><h4>${escapeHtml(role.title)}</h4><p class="date">${escapeHtml(role.date)}</p></div>${list(role.bullets)}</article>`).join("")}`).join("")}
      </section>
      <section aria-labelledby="projects"><h2 id="projects">Projects</h2>
        ${resumeDocument.projects.map((project) => `<article class="project"><h3>${escapeHtml(project.name)} <span class="muted" style="font-style:italic">| ${escapeHtml(project.technologies)}</span></h3>${list(project.bullets)}</article>`).join("")}
      </section>
      <section class="skills" aria-labelledby="skills"><h2 id="skills">Skills</h2>
        ${resumeDocument.skills.map((skill) => `<p><strong>${escapeHtml(skill.label)}:</strong> ${escapeHtml(skill.value)}</p>`).join("")}
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
  await page.screenshot({ path: output.webp, type: "webp", quality: 60, fullPage: false })
} finally {
  await browser.close()
}

console.log(`Generated ${path.relative(appRoot, output.pdf)}, ${path.relative(appRoot, output.png)}, and ${path.relative(appRoot, output.webp)}`)
