import fs from "node:fs"
import path from "node:path"

export function webpDimensions(buffer) {
  if (buffer.length < 20 || buffer.toString("ascii", 0, 4) !== "RIFF" || buffer.toString("ascii", 8, 12) !== "WEBP" || buffer.readUInt32LE(4) + 8 !== buffer.length) {
    throw new Error("Invalid WebP RIFF container")
  }
  for (let offset = 12; offset + 8 <= buffer.length;) {
    const type = buffer.toString("ascii", offset, offset + 4)
    const length = buffer.readUInt32LE(offset + 4)
    const start = offset + 8
    if (start + length > buffer.length) throw new Error("Truncated WebP chunk")
    if (type === "VP8L" && length >= 5 && buffer[start] === 0x2f) {
      const bits = buffer.readUInt32LE(start + 1)
      return { width: (bits & 0x3fff) + 1, height: ((bits >>> 14) & 0x3fff) + 1, lossless: true }
    }
    if (type === "VP8 " && length >= 10 && buffer.toString("hex", start + 3, start + 6) === "9d012a") {
      return { width: buffer.readUInt16LE(start + 6) & 0x3fff, height: buffer.readUInt16LE(start + 8) & 0x3fff, lossless: false }
    }
    // Continue through optional VP8X/metadata chunks to the actual image bitstream.
    offset = start + length + (length % 2)
  }
  throw new Error("WebP image bitstream is missing")
}

export function checkResumePreviews(publicRoot, variants) {
  const errors = []
  for (const variant of variants) {
    const file = path.join(publicRoot, variant.src)
    if (!fs.existsSync(file)) {
      errors.push(`${variant.src} is required for the optimized resume preview`)
      continue
    }
    const buffer = fs.readFileSync(file)
    if (buffer.length > variant.maxBytes) errors.push(`${variant.src} must not exceed ${variant.maxBytes} bytes`)
    try {
      const dimensions = webpDimensions(buffer)
      if (dimensions.width !== variant.width || dimensions.height !== variant.height) errors.push(`${variant.src} dimensions must be ${variant.width}x${variant.height}`)
      if (!dimensions.lossless) errors.push(`${variant.src} must use lossless WebP encoding`)
    } catch (error) {
      errors.push(`${variant.src}: ${error.message}`)
    }
  }
  return errors
}
