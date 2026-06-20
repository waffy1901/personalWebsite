#!/usr/bin/env node
import fs from "node:fs"
import path from "node:path"

const repo = path.resolve(process.argv[2] ?? process.cwd())
const errors = []
const warnings = []

const read = (rel) => fs.readFileSync(path.join(repo, rel), "utf8")
const walk = (dir) => {
  const full = path.join(repo, dir)
  return fs.readdirSync(full, { withFileTypes: true }).flatMap((entry) => {
    const rel = path.join(dir, entry.name)
    if (entry.isDirectory()) return walk(rel)
    return entry.isFile() && /\.(jsx?|tsx?)$/.test(entry.name) ? [rel] : []
  })
}

const srcTexts = walk("main/src").map((rel) => read(rel)).join("\n")
const docs = read("docs/analytics.md")
const readme = read("README.md")
const tests = read("main/src/App.test.jsx")
const portfolio = JSON.parse(read("main/public/portfolio.json"))

const expectedEvents = [
  "page_view",
  "resume_open",
  "resume_download",
  "social_link_click",
  "project_source_click",
  "project_details_open",
  "case_study_card_click",
  "case_study_link_click",
  "contact_form_submit",
  "contact_form_success",
  "contact_email_click",
]

const keyEventCandidates = [
  "resume_download",
  "contact_form_success",
  "project_source_click",
  "case_study_link_click",
]

for (const event of expectedEvents) {
  if (!srcTexts.includes(`"${event}"`) && !srcTexts.includes(`'${event}'`)) {
    warnings.push(`source does not currently emit ${event}`)
  }
  if (event === "page_view") {
    if (!readme.includes(`\`${event}\``)) errors.push(`README.md missing ${event}`)
  } else if (!docs.includes(`\`${event}\``)) {
    errors.push(`docs/analytics.md missing ${event}`)
  }
}

for (const event of keyEventCandidates) {
  if (!portfolio.analyticsEvents?.keyEventCandidates?.includes(event)) {
    errors.push(`portfolio.json keyEventCandidates missing ${event}`)
  }
}

for (const event of ["page_view", "project_source_click", "resume_download", "contact_form_submit"]) {
  if (!tests.includes(event)) warnings.push(`App.test.jsx does not assert ${event}`)
}

if (!srcTexts.includes("send_page_view: false")) {
  errors.push("GA config should keep send_page_view false for manual SPA page views")
}

if (warnings.length > 0) {
  console.warn("GA4 analytics warnings:")
  for (const warning of warnings) console.warn(`- ${warning}`)
}

if (errors.length > 0) {
  console.error("GA4 analytics check failed:")
  for (const error of errors) console.error(`- ${error}`)
  process.exit(1)
}

console.log("GA4 analytics check passed")
