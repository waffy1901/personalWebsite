import assert from "node:assert/strict"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { spawnSync } from "node:child_process"
import { fileURLToPath } from "node:url"
import test from "node:test"
import { checkImageBudgets, imageMetadata } from "./check-image-budgets.mjs"
import { resumePreviewVariants } from "../main/src/data/resume-preview.mjs"

const cli = fileURLToPath(new URL("./check-image-budgets.mjs", import.meta.url))
function png(width = 12, height = 8) {
  const buffer = Buffer.alloc(33)
  Buffer.from("89504e470d0a1a0a", "hex").copy(buffer)
  buffer.writeUInt32BE(13, 8)
  buffer.write("IHDR", 12)
  buffer.writeUInt32BE(width, 16)
  buffer.writeUInt32BE(height, 20)
  return buffer
}
function jpeg(width = 12, height = 8, marker = 0xc0) {
  const buffer = Buffer.from([0xff, 0xd8, 0xff, marker, 0, 8, 8, 0, 0, 0, 0, 1, 0xff, 0xd9])
  buffer.writeUInt16BE(height, 7)
  buffer.writeUInt16BE(width, 9)
  return buffer
}
function webp(width = 12, height = 8) {
  const buffer = Buffer.alloc(26)
  buffer.write("RIFF")
  buffer.writeUInt32LE(18, 4)
  buffer.write("WEBPVP8L", 8)
  buffer.writeUInt32LE(5, 16)
  buffer[20] = 0x2f
  buffer.writeUInt32LE(((width - 1) | ((height - 1) << 14)) >>> 0, 21)
  return buffer
}
function lossyWebp(width = 12, height = 8) {
  const buffer = Buffer.alloc(30)
  buffer.write("RIFF")
  buffer.writeUInt32LE(22, 4)
  buffer.write("WEBPVP8 ", 8)
  buffer.writeUInt32LE(10, 16)
  Buffer.from("9d012a", "hex").copy(buffer, 23)
  buffer.writeUInt16LE(width, 26)
  buffer.writeUInt16LE(height, 28)
  return buffer
}

function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "image-budget-"))
  t.after(() => fs.rmSync(root, { recursive: true, force: true }))
  fs.mkdirSync(path.join(root, "images"))
  const config = { version: 1, imageDirectories: ["images"], resumePreviews: false, assets: [] }
  const configPath = path.join(root, "budgets.json")
  const write = (relative, bytes) => {
    const absolute = path.join(root, relative)
    fs.mkdirSync(path.dirname(absolute), { recursive: true })
    fs.writeFileSync(absolute, bytes)
  }
  for (const [format, bytes] of [["png", png()], ["jpeg", jpeg()], ["webp", webp()]]) {
    const imagePath = `images/image.${format}`
    write(imagePath, bytes)
    config.assets.push({ path: imagePath, format, width: 12, height: 8, maxBytes: bytes.length })
  }
  const save = () => fs.writeFileSync(configPath, JSON.stringify(config))
  const check = () => { save(); return checkImageBudgets({ root, configPath }) }
  const run = (...args) => { save(); return spawnSync(process.execPath, [cli, "--root", root, "--config", configPath, ...args], { encoding: "utf8" }) }
  return { root, configPath, config, write, check, run }
}

test("accepts PNG, baseline/progressive JPEG and lossless WebP header dimensions", () => {
  assert.deepEqual(imageMetadata(png()), { format: "png", width: 12, height: 8 })
  for (const marker of [0xc0, 0xc1, 0xc2]) assert.deepEqual(imageMetadata(jpeg(12, 8, marker)), { format: "jpeg", width: 12, height: 8 })
  assert.deepEqual(imageMetadata(webp()), { format: "webp", width: 12, height: 8, lossless: true })
})

test("byte ceilings are inclusive and fail clearly at one byte over", (t) => {
  const f = fixture(t)
  assert.deepEqual(f.check().errors, [])
  f.write("images/image.png", Buffer.concat([png(), Buffer.alloc(1)]))
  assert.match(f.check().errors.join("\n"), /34 bytes exceeds budget 33 by 1 bytes/)
})

test("reports missing files and requires every inventoried image to have a budget", (t) => {
  const f = fixture(t)
  fs.unlinkSync(path.join(f.root, "images/image.png"))
  assert.match(f.check().errors.join("\n"), /Missing budgeted image: images\/image.png/)
  f.write("images/new.png", png())
  assert.match(f.check().errors.join("\n"), /Unbudgeted image: images\/new.png/)
  f.config.assets.pop()
  assert.match(f.check().errors.join("\n"), /Unbudgeted image: images\/image.webp/)
})

for (const [format, encode] of [["png", png], ["jpeg", jpeg], ["webp", webp]]) {
  test(`checks ${format} dimensions independently of the byte ceiling`, (t) => {
    const f = fixture(t)
    f.write(`images/image.${format}`, encode(24, 16))
    assert.match(f.check().errors.join("\n"), /expected dimensions 12x8, got 24x16/)
  })
}

test("detects a renamed image with the wrong format", (t) => {
  const f = fixture(t)
  f.write("images/image.png", jpeg())
  assert.match(f.check().errors.join("\n"), /expected png format, got jpeg/)
})

test("rejects malformed and truncated headers instead of trusting extensions", () => {
  for (const bytes of [Buffer.from("not an image"), png().subarray(0, 20), jpeg().subarray(0, 12), webp().subarray(0, 24)]) {
    assert.throws(() => imageMetadata(bytes), /Invalid|invalid|Truncated|Unsupported/)
  }
  const badPng = png(); badPng.write("NOPE", 12)
  assert.throws(() => imageMetadata(badPng), /PNG IHDR/)
  const badJpeg = jpeg(); badJpeg.writeUInt16BE(1000, 4)
  assert.throws(() => imageMetadata(badJpeg), /Truncated JPEG segment/)
})

test("uses the existing resume variant ceilings once and enforces lossless encoding", (t) => {
  const f = fixture(t)
  f.config.resumePreviews = true
  for (const variant of resumePreviewVariants) f.write(`main/public${variant.src}`, webp(variant.width, variant.height))
  const result = f.check()
  assert.deepEqual(result.errors, [])
  for (const variant of resumePreviewVariants) {
    const row = result.rows.find((entry) => entry.path === `main/public${variant.src}`)
    assert.equal(row.maxBytes, variant.maxBytes)
    assert.equal(row.lossless, true)
  }
  // Independent VP8 header fixture; valid logo re-encodings cannot change this test.
  const lossy = lossyWebp()
  f.config.assets.push({ path: "images/lossy.webp", format: "webp", width: 12, height: 8, maxBytes: lossy.length, lossless: true })
  f.write("images/lossy.webp", lossy)
  assert.match(f.check().errors.join("\n"), /expected lossless WebP encoding/)
  f.config.assets.push({ path: "main/public/resume-preview.webp", format: "webp", width: 960, height: 1243, maxBytes: 1 })
  assert.throws(f.check, /Duplicate image budget/)
})

for (const [label, mutate, expected] of [
  ["version", (c) => { c.version = 2 }, /Invalid image budget config/],
  ["empty inventory", (c) => { c.imageDirectories = [] }, /Invalid image budget config/],
  ["negative ceiling", (c) => { c.assets[0].maxBytes = -1 }, /Invalid positive/],
  ["fractional dimensions", (c) => { c.assets[0].width = 1.5 }, /Invalid positive/],
  ["unknown format", (c) => { c.assets[0].format = "avif" }, /Invalid image format/],
  ["mismatched extension", (c) => { c.assets[0].format = "jpeg" }, /Invalid image format/],
  ["duplicate", (c) => { c.assets.push(c.assets[0]) }, /Duplicate image budget/],
  ["traversal", (c) => { c.assets[0].path = "../outside.png" }, /Invalid repository image path/],
  ["absolute path", (c) => { c.assets[0].path = "/tmp/image.png" }, /Invalid repository image path/],
  ["missing directory", (c) => { c.imageDirectories = ["missing"] }, /Missing image directory/],
]) {
  test(`rejects invalid config: ${label}`, (t) => {
    const f = fixture(t)
    mutate(f.config)
    assert.throws(f.check, expected)
  })
}

test("refuses images that escape the repository via symlinks", (t) => {
  const f = fixture(t)
  const outside = fs.mkdtempSync(path.join(os.tmpdir(), "image-budget-outside-"))
  t.after(() => fs.rmSync(outside, { recursive: true, force: true }))
  fs.writeFileSync(path.join(outside, "image.png"), png())
  fs.unlinkSync(path.join(f.root, "images/image.png"))
  fs.symlinkSync(path.join(outside, "image.png"), path.join(f.root, "images/image.png"))
  assert.throws(f.check, /escapes repository/)
})

test("CLI succeeds, propagates budget failures, and reports configuration errors", (t) => {
  const f = fixture(t)
  assert.equal(f.run().status, 0)
  f.config.assets[0].maxBytes -= 1
  const failure = f.run()
  assert.equal(failure.status, 1)
  assert.match(failure.stdout, /Image budgets FAIL/)
  assert.match(failure.stdout, /exceeds budget/)
  const unknown = f.run("--unknown")
  assert.equal(unknown.status, 1)
  assert.match(unknown.stderr, /Unknown or incomplete option/)
  for (const contents of ["not JSON", null]) {
    if (contents === null) fs.unlinkSync(f.configPath)
    else fs.writeFileSync(f.configPath, contents)
    const run = spawnSync(process.execPath, [cli, "--config", f.configPath], { encoding: "utf8" })
    assert.equal(run.status, 1)
    assert.match(run.stderr, /Cannot read image budget config/)
  }
})
