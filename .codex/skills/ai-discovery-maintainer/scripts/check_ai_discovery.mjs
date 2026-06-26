#!/usr/bin/env node
import fs from "node:fs"
import path from "node:path"

const repo = path.resolve(process.argv[2] ?? process.cwd())
const errors = []

const read = (rel) => fs.readFileSync(path.join(repo, rel), "utf8")
const requireText = (label, text, value) => {
  if (!text.includes(value)) errors.push(`${label} missing ${value}`)
}

let portfolio
try {
  portfolio = JSON.parse(read("main/public/portfolio.json"))
} catch (error) {
  errors.push(`portfolio.json is not valid JSON: ${error.message}`)
}

const llms = read("main/public/llms.txt")
const aiSummary = read("main/public/ai-summary.txt")
const indexHtml = read("main/index.html")
const sitemap = read("main/public/sitemap.xml")

if (portfolio) {
  for (const key of ["site", "resume", "aiSummary", "llms"]) {
    if (!portfolio.links?.[key]) errors.push(`portfolio.json missing links.${key}`)
  }

  for (const caseStudy of portfolio.caseStudies ?? []) {
    requireText("llms.txt", llms, caseStudy.url)
    requireText("sitemap.xml", sitemap, caseStudy.url)
    requireText("index.html JSON-LD", indexHtml, caseStudy.url)
  }

  for (const topic of ["Kubernetes", "Observability", "Deployment automation"]) {
    const hasTopic = JSON.stringify(portfolio).includes(topic) || aiSummary.includes(topic)
    if (!hasTopic) errors.push(`AI discovery files missing topic ${topic}`)
  }
}

for (const url of [
  "https://waffy.dev/ai-summary.txt",
  "https://waffy.dev/portfolio.json",
  "https://waffy.dev/sitemap.xml",
  "https://waffy.dev/waffyAhmedResume.pdf",
]) {
  requireText("llms.txt", llms, url)
}

for (const rel of ["/llms.txt", "/ai-summary.txt", "/portfolio.json"]) {
  requireText("index.html alternates", indexHtml, rel)
}

if (errors.length > 0) {
  console.error("AI discovery check failed:")
  for (const error of errors) console.error(`- ${error}`)
  process.exit(1)
}

console.log("AI discovery check passed")
