#!/usr/bin/env node
import fs from "node:fs"
import path from "node:path"

const repo = path.resolve(process.argv[2] ?? process.cwd())
const errors = []

const read = (rel) => fs.readFileSync(path.join(repo, rel), "utf8")
const unique = (items) => [...new Set(items)]
const extract = (text, regex) => unique([...text.matchAll(regex)].map((match) => match[1]))

const seo = read("main/src/data/seo.js")
const app = read("main/src/App.jsx")
const sitemap = read("main/public/sitemap.xml")
const robots = read("main/public/robots.txt")
const indexHtml = read("main/index.html")
const caseStudies = read("main/src/data/caseStudies.js")

const literalRoutes = extract(seo, /path:\s*"([^"]+)"/g).filter((route) => route !== "*")
const caseStudyRoutes = extract(caseStudies, /slug:\s*"([^"]+)"/g).map((slug) => `/case-studies/${slug}`)
const routes = unique([...literalRoutes, ...caseStudyRoutes])

for (const route of routes) {
  const url = route === "/" ? "https://waffy.dev/" : `https://waffy.dev${route}`
  if (!sitemap.includes(`<loc>${url}</loc>`)) errors.push(`sitemap.xml missing ${url}`)
}

for (const route of ["/resume", "/contact", "/case-studies", "/experience", "/projects"]) {
  if (!app.includes(`path="${route}"`)) errors.push(`App.jsx missing route ${route}`)
}

for (const legacy of ["/Resume", "/Contact", "/CaseStudies", "/Case-Studies", "/Experience", "/Projects"]) {
  if (!app.includes(`path="${legacy}"`)) errors.push(`App.jsx missing legacy redirect ${legacy}`)
}

for (const required of [
  'rel="canonical"',
  'property="og:title"',
  'property="og:description"',
  'property="og:image"',
  'name="twitter:card"',
  'href="/sitemap.xml"',
  'href="/llms.txt"',
  'href="/ai-summary.txt"',
  'href="/portfolio.json"',
]) {
  if (!indexHtml.includes(required)) errors.push(`index.html missing ${required}`)
}

if (!robots.includes("Sitemap: https://waffy.dev/sitemap.xml")) {
  errors.push("robots.txt missing canonical sitemap pointer")
}

if (errors.length > 0) {
  console.error("SPA SEO check failed:")
  for (const error of errors) console.error(`- ${error}`)
  process.exit(1)
}

console.log("SPA SEO check passed")
