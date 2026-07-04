#!/usr/bin/env node
import fs from "node:fs"
import path from "node:path"

const repo = path.resolve(process.argv[2] ?? process.cwd())
const errors = []
const warnings = []

const read = (rel) => fs.readFileSync(path.join(repo, rel), "utf8")
const exists = (rel) => fs.existsSync(path.join(repo, rel))
const unique = (items) => [...new Set(items)]
const extract = (text, regex) => unique([...text.matchAll(regex)].map((match) => match[1]))
const requireFile = (rel) => {
  if (!exists(rel)) errors.push(`Missing ${rel}`)
}

for (const rel of [
  "main/src/data/profile.js",
  "main/src/data/experience.js",
  "main/src/data/projects.js",
  "main/src/data/caseStudies.js",
  "main/src/data/caseStudySeo.js",
  "main/src/data/seo.js",
  "main/public/portfolio.json",
  "main/public/ai-summary.txt",
  "main/public/llms.txt",
  "main/public/sitemap.xml",
]) {
  requireFile(rel)
}

if (errors.length === 0) {
  const projectsSource = read("main/src/data/projects.js")
  const caseStudiesSource = read("main/src/data/caseStudySeo.js")
  const seoSource = read("main/src/data/seo.js")
  const portfolioText = read("main/public/portfolio.json")
  const portfolio = JSON.parse(portfolioText)
  const sitemap = read("main/public/sitemap.xml")
  const aiSummary = read("main/public/ai-summary.txt")

  const caseSlugs = extract(caseStudiesSource, /slug:\s*"([^"]+)"/g)
  const projectsListSource = projectsSource.split("export const projects =")[1] ?? ""
  const projectIds = extract(projectsListSource, /id:\s*"([^"]+)"/g)
  const portfolioCaseSlugs = new Set((portfolio.caseStudies ?? []).map((item) => item.slug))
  const portfolioProjectIds = new Set((portfolio.projects ?? []).map((item) => item.id))

  for (const slug of caseSlugs) {
    if (!portfolioCaseSlugs.has(slug)) errors.push(`portfolio.json missing case study slug ${slug}`)
    if (!sitemap.includes(`/case-studies/${slug}`)) errors.push(`sitemap.xml missing /case-studies/${slug}`)
    if (!seoSource.includes(`/case-studies/${slug}`) && !seoSource.includes("caseStudySeoItems.map")) {
      errors.push(`seo.js does not appear to cover case-study slug ${slug}`)
    }
  }

  for (const id of projectIds) {
    if (!portfolioProjectIds.has(id)) errors.push(`portfolio.json missing project id ${id}`)
  }

  const riskyFirestorePasswordCopy = /Firestore[^.\n]*password|password[^.\n]*Firestore/i
  for (const [label, text] of [
    ["projects.js", projectsSource],
    ["portfolio.json", portfolioText],
    ["ai-summary.txt", aiSummary],
  ]) {
    if (riskyFirestorePasswordCopy.test(text)) {
      warnings.push(`${label} may imply Firestore stores passwords; prefer FirebaseAuth plus Firestore profile metadata wording`)
    }
  }
}

if (warnings.length > 0) {
  console.warn("Content sync warnings:")
  for (const warning of warnings) console.warn(`- ${warning}`)
}

if (errors.length > 0) {
  console.error("Content sync failed:")
  for (const error of errors) console.error(`- ${error}`)
  process.exit(1)
}

console.log("Content sync check passed")
