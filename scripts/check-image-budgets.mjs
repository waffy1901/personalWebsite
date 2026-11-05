#!/usr/bin/env node
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { resumePreviewVariants } from "../main/src/data/resume-preview.mjs"
import { webpDimensions } from "../main/scripts/resume-preview-assets.mjs"

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const rasterExtension = /\.(?:png|jpe?g|webp|avif|gif|bmp)$/i
const formats = { png: /\.png$/i, jpeg: /\.jpe?g$/i, webp: /\.webp$/i }
const requireThat = (condition, message) => {
  if (!condition) throw new Error(message)
}

// Read container headers, not pixels. Visual quality still requires browser QA.
export function imageMetadata(buffer) {
  if (buffer.length >= 33 && buffer.subarray(0, 8).equals(Buffer.from("89504e470d0a1a0a", "hex"))) {
    requireThat(buffer.readUInt32BE(8) === 13 && buffer.toString("ascii", 12, 16) === "IHDR", "Invalid PNG IHDR")
    return { format: "png", width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) }
  }
  if (buffer.toString("ascii", 0, 4) === "RIFF") return { format: "webp", ...webpDimensions(buffer) }
  if (buffer.length >= 4 && buffer[0] === 0xff && buffer[1] === 0xd8) {
    requireThat(buffer.readUInt16BE(buffer.length - 2) === 0xffd9, "Truncated JPEG (missing end marker)")
    for (let offset = 2; offset < buffer.length - 2;) {
      requireThat(buffer[offset] === 0xff, "Invalid JPEG segment marker")
      while (buffer[offset] === 0xff) offset += 1
      const marker = buffer[offset++]
      if (marker === 0xda || marker === 0xd9) break
      requireThat(offset + 2 <= buffer.length, "Truncated JPEG segment")
      const length = buffer.readUInt16BE(offset)
      requireThat(length >= 2 && offset + length <= buffer.length, "Truncated JPEG segment")
      if ([0xc0, 0xc1, 0xc2].includes(marker)) {
        requireThat(length >= 8, "Invalid JPEG frame header")
        return { format: "jpeg", height: buffer.readUInt16BE(offset + 3), width: buffer.readUInt16BE(offset + 5) }
      }
      offset += length
    }
    throw new Error("JPEG frame dimensions are missing or unsupported")
  }
  throw new Error("Unsupported or invalid image format (expected PNG, JPEG, or WebP)")
}

function insideRoot(root, relativePath) {
  requireThat(typeof relativePath === "string" && relativePath.length > 0
    && !path.isAbsolute(relativePath) && !relativePath.includes("\\")
    && relativePath.split("/").every((part) => part && part !== "." && part !== ".."),
  `Invalid repository image path: ${relativePath}`)
  const absolute = path.join(root, relativePath)
  if (fs.existsSync(absolute)) {
    const real = fs.realpathSync(absolute)
    requireThat(real.startsWith(`${fs.realpathSync(root)}${path.sep}`), `Image path escapes repository: ${relativePath}`)
    requireThat(!fs.lstatSync(absolute).isSymbolicLink(), `Image paths must not be symlinks: ${relativePath}`)
  }
  return absolute
}

function inventory(root, directory) {
  const absolute = insideRoot(root, directory)
  requireThat(fs.existsSync(absolute) && fs.statSync(absolute).isDirectory(), `Missing image directory: ${directory}`)
  return fs.readdirSync(absolute, { withFileTypes: true }).flatMap((entry) => {
    const relative = `${directory}/${entry.name}`
    requireThat(!entry.isSymbolicLink(), `Image inventory must not contain symlinks: ${relative}`)
    if (entry.isDirectory()) return inventory(root, relative)
    return entry.isFile() && rasterExtension.test(entry.name) ? [relative] : []
  })
}

export function checkImageBudgets({ root = repositoryRoot, configPath = path.join(root, "config/image-budgets.json") } = {}) {
  let config
  try {
    config = JSON.parse(fs.readFileSync(configPath, "utf8"))
  } catch (error) {
    throw new Error(`Cannot read image budget config: ${error.message}`)
  }
  requireThat(config?.version === 1 && Array.isArray(config.assets) && config.assets.length > 0
    && Array.isArray(config.imageDirectories) && config.imageDirectories.length > 0
    && typeof config.resumePreviews === "boolean", "Invalid image budget config: expected version 1, assets, imageDirectories, and resumePreviews")
  const assets = [...config.assets]
  if (config.resumePreviews) {
    assets.push(...resumePreviewVariants.map(({ src, ...variant }) => ({
      path: `main/public${src}`, format: "webp", lossless: true, ...variant,
    })))
  }
  const paths = new Set()
  for (const asset of assets) {
    requireThat(asset && typeof asset === "object", "Invalid image budget entry")
    insideRoot(root, asset.path)
    requireThat(!paths.has(asset.path), `Duplicate image budget: ${asset.path}`)
    paths.add(asset.path)
    requireThat(Object.hasOwn(formats, asset.format) && formats[asset.format].test(asset.path), `Invalid image format or extension for ${asset.path}`)
    requireThat([asset.width, asset.height, asset.maxBytes].every((value) => Number.isSafeInteger(value) && value > 0), `Invalid positive dimensions or byte budget for ${asset.path}`)
    requireThat(asset.lossless === undefined || (asset.format === "webp" && typeof asset.lossless === "boolean"), `Invalid lossless policy for ${asset.path}`)
  }
  const errors = []
  for (const directory of config.imageDirectories) {
    for (const file of inventory(root, directory)) {
      if (!paths.has(file)) errors.push(`Unbudgeted image: ${file}; add an intentional budget before shipping it`)
    }
  }
  const rows = []
  for (const asset of assets) {
    try {
      const absolute = insideRoot(root, asset.path)
      requireThat(fs.existsSync(absolute), `Missing budgeted image: ${asset.path}`)
      requireThat(fs.statSync(absolute).isFile(), `Budgeted image is not a file: ${asset.path}`)
      const buffer = fs.readFileSync(absolute)
      if (buffer.length > asset.maxBytes) errors.push(`${asset.path}: ${buffer.length} bytes exceeds budget ${asset.maxBytes} by ${buffer.length - asset.maxBytes} bytes`)
      const metadata = imageMetadata(buffer)
      if (metadata.format !== asset.format) errors.push(`${asset.path}: expected ${asset.format} format, got ${metadata.format}`)
      if (metadata.width !== asset.width || metadata.height !== asset.height) errors.push(`${asset.path}: expected dimensions ${asset.width}x${asset.height}, got ${metadata.width}x${metadata.height}`)
      if (asset.lossless !== undefined && metadata.lossless !== asset.lossless) errors.push(`${asset.path}: expected ${asset.lossless ? "lossless" : "lossy"} WebP encoding`)
      rows.push({ path: asset.path, bytes: buffer.length, maxBytes: asset.maxBytes, ...metadata })
    } catch (error) {
      errors.push(`${asset.path}: ${error.message}`)
    }
  }
  return { rows, errors }
}

export function formatReport({ rows, errors }) {
  return ["Image budgets (encoded file bytes):", ...rows.map((row) =>
    `${row.path}: ${row.bytes}/${row.maxBytes} B; ${row.format} ${row.width}x${row.height}`),
  ...errors.map((error) => `[error] ${error}`), `Image budgets ${errors.length ? "FAIL" : "PASS"}`].join("\n")
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const options = {}
    for (let index = 2; index < process.argv.length; index += 1) {
      const flag = process.argv[index]
      requireThat(["--root", "--config"].includes(flag) && process.argv[index + 1], `Unknown or incomplete option: ${flag}`)
      options[flag === "--root" ? "root" : "configPath"] = path.resolve(process.argv[++index])
    }
    const result = checkImageBudgets(options)
    console.log(formatReport(result))
    if (result.errors.length) process.exitCode = 1
  } catch (error) {
    console.error(`Image budgets FAIL: ${error.message}`)
    process.exitCode = 1
  }
}
