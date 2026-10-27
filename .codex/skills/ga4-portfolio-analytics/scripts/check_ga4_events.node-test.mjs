import assert from "node:assert/strict"
import { spawnSync } from "node:child_process"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { fileURLToPath } from "node:url"
import test from "node:test"

const scriptDir = path.dirname(fileURLToPath(import.meta.url))
const repo = path.resolve(scriptDir, "../../../..")
const checker = path.join(scriptDir, "check_ga4_events.mjs")
const docs = fs.readFileSync(path.join(repo, "docs/analytics.md"), "utf8")

const checkFixture = (t, analyticsDocs) => {
  const fixture = fs.mkdtempSync(path.join(os.tmpdir(), "ga4-events-"))
  t.after(() => fs.rmSync(fixture, { recursive: true, force: true }))
  for (const rel of ["main/src/utils/analytics.js", "main/src/App.test.jsx", "README.md"]) {
    fs.mkdirSync(path.dirname(path.join(fixture, rel)), { recursive: true })
    fs.copyFileSync(path.join(repo, rel), path.join(fixture, rel))
  }
  fs.mkdirSync(path.join(fixture, "docs"))
  fs.writeFileSync(path.join(fixture, "docs/analytics.md"), analyticsDocs)
  return spawnSync(process.execPath, [checker, fixture], { encoding: "utf8" })
}

test("accepts documented recommendations without public analytics metadata", (t) => {
  const result = checkFixture(t, docs)
  assert.equal(result.status, 0, result.stderr)
  assert.match(result.stdout, /GA4 analytics check passed/)
})

test("rejects a key event documented only as a diagnostic", (t) => {
  const row = docs.match(/^\| `resume_download`[^\n]*\n/m)[0]
  const changedDocs = docs.replace(row, "").replace(
    "| `project_details_open`",
    `${row}| \`project_details_open\``
  )
  const result = checkFixture(t, changedDocs)
  assert.equal(result.status, 1)
  assert.match(result.stderr, /Recommended Key Events table missing resume_download/)
})

test("rejects recommendations outside the designated section", (t) => {
  const result = checkFixture(t, docs.replace("## Recommended Key Events", "## Other Events"))
  assert.equal(result.status, 1)
  assert.match(result.stderr, /Recommended Key Events table missing/)
})

test("retains documentation checks for diagnostic events", (t) => {
  const result = checkFixture(t, docs.replace(/^\| `contact_email_click`[^\n]*\n/m, ""))
  assert.equal(result.status, 1)
  assert.match(result.stderr, /docs\/analytics.md missing contact_email_click/)
})
