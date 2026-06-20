#!/usr/bin/env node
import crypto from "node:crypto"
import fs from "node:fs"
import path from "node:path"

const repo = path.resolve(process.argv[2] ?? process.cwd())
const indexHtml = fs.readFileSync(path.join(repo, "main/index.html"), "utf8")
const netlifyToml = fs.readFileSync(path.join(repo, "netlify.toml"), "utf8")

const scriptMatch = indexHtml.match(
  /<script id="portfolio-jsonld" type="application\/ld\+json">([\s\S]*?)<\/script>/
)

if (!scriptMatch) {
  console.error("CSP hash check failed: missing portfolio-jsonld script in main/index.html")
  process.exit(1)
}

const scriptText = scriptMatch[1]
const expectedHash = `sha256-${crypto.createHash("sha256").update(scriptText).digest("base64")}`
const hashTokens = [...netlifyToml.matchAll(/'sha256-([^']+)'/g)].map((match) => `sha256-${match[1]}`)

if (!hashTokens.includes(expectedHash)) {
  console.error("CSP JSON-LD hash mismatch")
  console.error(`Expected token: '${expectedHash}'`)
  if (hashTokens.length > 0) {
    console.error(`Found tokens: ${hashTokens.map((hash) => `'${hash}'`).join(", ")}`)
  } else {
    console.error("Found tokens: none")
  }
  process.exit(1)
}

console.log(`CSP JSON-LD hash check passed: '${expectedHash}'`)
