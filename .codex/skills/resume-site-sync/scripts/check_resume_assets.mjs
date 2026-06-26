#!/usr/bin/env node
import fs from "node:fs"
import path from "node:path"

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

const pdf = stat("main/public/waffyAhmedResume.pdf")
const preview = stat("main/public/resume-preview.png")
if (pdf && pdf.size === 0) errors.push("Resume PDF is empty")
if (preview && preview.size === 0) errors.push("Resume preview image is empty")

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
  if (portfolio.links?.resume !== "https://waffy.dev/waffyAhmedResume.pdf") {
    errors.push("portfolio.json resume link is not canonical")
  }
  if (!llms.includes("https://waffy.dev/waffyAhmedResume.pdf")) {
    errors.push("llms.txt missing canonical resume PDF link")
  }
  if (!redirects.includes("/waffyahmedresume.pdf /waffyAhmedResume.pdf 301")) {
    errors.push("_redirects missing legacy lowercase resume redirect")
  }
}

if (errors.length > 0) {
  console.error("Resume asset check failed:")
  for (const error of errors) console.error(`- ${error}`)
  process.exit(1)
}

console.log("Resume asset check passed")
