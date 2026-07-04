#!/usr/bin/env node
import { mkdir, readFile, writeFile } from "node:fs/promises"
import path from "node:path"
import { fileURLToPath } from "node:url"
import {
  routeMetadata,
  siteMetadata,
  toAbsoluteUrl,
} from "../src/data/seo.js"

const scriptDir = path.dirname(fileURLToPath(import.meta.url))
const appRoot = path.resolve(scriptDir, "..")
const distDir = path.join(appRoot, "dist")
const indexPath = path.join(distDir, "index.html")

const escapeAttribute = (value) =>
  String(value)
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")

const escapeText = (value) =>
  String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")

const replaceRequired = (html, label, pattern, replacement) => {
  if (!pattern.test(html)) {
    throw new Error(`Missing required ${label} in dist/index.html`)
  }

  return html.replace(pattern, replacement)
}

const updateTitle = (html, title) =>
  replaceRequired(
    html,
    "title element",
    /<title>[\s\S]*?<\/title>/i,
    `<title>${escapeText(title)}</title>`
  )

const updateMetaContent = (html, attributeName, attributeValue, content) => {
  const tagPattern = new RegExp(
    `<meta\\b(?=[^>]*\\b${attributeName}="${attributeValue}")[^>]*>`,
    "i"
  )
  const match = html.match(tagPattern)

  if (!match) {
    throw new Error(
      `Missing required meta ${attributeName}="${attributeValue}" in dist/index.html`
    )
  }

  const [tag] = match
  if (!/\bcontent="[^"]*"/i.test(tag)) {
    throw new Error(
      `Missing content attribute on meta ${attributeName}="${attributeValue}"`
    )
  }

  return html.replace(
    tag,
    tag.replace(/\bcontent="[^"]*"/i, `content="${escapeAttribute(content)}"`)
  )
}

const updateLinkHref = (html, rel, href) => {
  const tagPattern = new RegExp(
    `<link\\b(?=[^>]*\\brel="${rel}")[^>]*>`,
    "i"
  )
  const match = html.match(tagPattern)

  if (!match) {
    throw new Error(`Missing required link rel="${rel}" in dist/index.html`)
  }

  const [tag] = match
  if (!/\bhref="[^"]*"/i.test(tag)) {
    throw new Error(`Missing href attribute on link rel="${rel}"`)
  }

  return html.replace(
    tag,
    tag.replace(/\bhref="[^"]*"/i, `href="${escapeAttribute(href)}"`)
  )
}

const validateRoute = (route) => {
  if (!route.path || !route.path.startsWith("/")) {
    throw new Error(`Invalid route metadata path: ${route.path}`)
  }

  if (!route.title) {
    throw new Error(`Missing title for route ${route.path}`)
  }

  if (!route.description) {
    throw new Error(`Missing description for route ${route.path}`)
  }
}

const renderRouteHtml = (templateHtml, route) => {
  validateRoute(route)

  const canonicalUrl = toAbsoluteUrl(route.path)
  const imageUrl = toAbsoluteUrl(siteMetadata.imagePath)

  let html = templateHtml
  html = updateTitle(html, route.title)
  html = updateLinkHref(html, "canonical", canonicalUrl)
  html = updateMetaContent(html, "name", "description", route.description)
  html = updateMetaContent(html, "name", "author", siteMetadata.author)
  html = updateMetaContent(html, "name", "keywords", siteMetadata.keywords.join(", "))
  html = updateMetaContent(html, "property", "og:url", canonicalUrl)
  html = updateMetaContent(html, "property", "og:title", route.title)
  html = updateMetaContent(html, "property", "og:description", route.description)
  html = updateMetaContent(html, "property", "og:image", imageUrl)
  html = updateMetaContent(html, "property", "og:image:secure_url", imageUrl)
  html = updateMetaContent(html, "name", "twitter:title", route.title)
  html = updateMetaContent(html, "name", "twitter:description", route.description)
  html = updateMetaContent(html, "name", "twitter:image", imageUrl)

  return html
}

const routeOutputPaths = (routePath) => {
  if (routePath === "/") {
    return [indexPath]
  }

  const relativeRoute = routePath.replace(/^\//, "")

  return [path.join(distDir, relativeRoute, "index.html")]
}

const writeRouteHtml = async (route, html) => {
  for (const outputPath of routeOutputPaths(route.path)) {
    await mkdir(path.dirname(outputPath), { recursive: true })
    await writeFile(outputPath, html)
  }
}

const run = async () => {
  if (routeMetadata.length === 0) {
    throw new Error("No route metadata found")
  }

  const templateHtml = await readFile(indexPath, "utf8")

  for (const route of routeMetadata) {
    await writeRouteHtml(route, renderRouteHtml(templateHtml, route))
  }

  console.log(`Pre-rendered metadata shells for ${routeMetadata.length} routes`)
}

run().catch((error) => {
  console.error(error.message)
  process.exit(1)
})
