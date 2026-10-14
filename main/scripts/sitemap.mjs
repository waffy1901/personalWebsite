import { JSDOM } from "jsdom"

const SITEMAP_NAMESPACE = "http://www.sitemaps.org/schemas/sitemap/0.9"
const PUBLIC_RESOURCES = ["/llms.txt", "/ai-summary.txt", "/portfolio.json"]

const escapeXml = (value) => value
  .replaceAll("&", "&amp;")
  .replaceAll("<", "&lt;")
  .replaceAll(">", "&gt;")
  .replaceAll('"', "&quot;")
  .replaceAll("'", "&apos;")

const assertCanonicalUrl = (value, origin) => {
  let parsed
  try {
    parsed = new URL(value)
  } catch {
    throw new Error(`Invalid sitemap URL: ${value}`)
  }
  const isResource = PUBLIC_RESOURCES.includes(parsed.pathname)
  const isRoute = /^\/(?:[a-z0-9-]+\/)*$/.test(parsed.pathname)
  if (parsed.protocol !== "https:" || parsed.origin !== origin ||
      parsed.username || parsed.password || parsed.search || parsed.hash ||
      parsed.href !== value || (!isResource && !isRoute)) {
    throw new Error(`Noncanonical sitemap URL: ${value}`)
  }
}

export const sitemapUrls = (model) => {
  const origin = new URL(model.siteMetadata.siteUrl).origin
  const urls = [
    ...model.routeMetadata.map((route) => model.toCanonicalRouteUrl(route.path)),
    ...PUBLIC_RESOURCES.map((resource) => model.toAbsoluteUrl(resource)),
  ]
  for (const url of urls) assertCanonicalUrl(url, origin)
  if (new Set(urls).size !== urls.length) {
    throw new Error("Duplicate canonical sitemap URL inventory")
  }
  return urls
}

const assertElement = (element, name, allowNamespace = false) => {
  if (element.localName !== name || element.namespaceURI !== SITEMAP_NAMESPACE ||
      [...element.attributes].some((attribute) =>
        !(allowNamespace && attribute.name === "xmlns" && attribute.value === SITEMAP_NAMESPACE))) {
    throw new Error(`Invalid sitemap structure: expected ${name} in sitemap namespace`)
  }
}

const assertWhitespaceBetweenElements = (element) => {
  for (const node of element.childNodes) {
    if (node.nodeType === 1 || node.nodeType === 8) continue
    if (node.nodeType === 3 && !node.textContent.trim()) continue
    throw new Error(`Invalid sitemap content inside ${element.localName}`)
  }
}

// Parse XML without loading resources or executing scripts. DTDs are unnecessary
// for this sitemap and rejected before parsing, including entity declarations.
export const validateSitemap = (xml, model) => {
  const expected = new Set(sitemapUrls(model))
  const origin = new URL(model.siteMetadata.siteUrl).origin
  if (/<!DOCTYPE/i.test(xml)) throw new Error("Sitemap DTDs are unsupported")
  let dom
  try {
    dom = new JSDOM(xml, { contentType: "application/xml" })
  } catch (error) {
    throw new Error(`Malformed sitemap XML: ${error.message}`)
  }
  try {
    const root = dom.window.document.documentElement
    assertElement(root, "urlset", true)
    assertWhitespaceBetweenElements(root)
    const seen = new Set()
    for (const entry of root.children) {
      assertElement(entry, "url")
      assertWhitespaceBetweenElements(entry)
      if (entry.children.length !== 1) {
        throw new Error("Sitemap url must contain only loc; freshness metadata is unsupported")
      }
      const loc = entry.children[0]
      assertElement(loc, "loc")
      if ([...loc.childNodes].some((node) => node.nodeType !== 3)) {
        throw new Error("Sitemap loc must contain only URL text")
      }
      const value = loc.textContent
      assertCanonicalUrl(value, origin)
      if (seen.has(value)) throw new Error(`Duplicate sitemap URL: ${value}`)
      if (!expected.has(value)) throw new Error(`Unexpected sitemap URL: ${value}`)
      seen.add(value)
    }
    const missing = [...expected].filter((url) => !seen.has(url))
    if (missing.length) throw new Error(`Missing sitemap URLs: ${missing.join(", ")}`)
    return [...seen]
  } finally {
    dom.window.close()
  }
}

export const buildSitemap = (model) => {
  const xml = `${[
    '<?xml version="1.0" encoding="UTF-8"?>',
    `<urlset xmlns="${SITEMAP_NAMESPACE}">`,
    ...sitemapUrls(model).flatMap((url) => [
      "  <url>",
      `    <loc>${escapeXml(url)}</loc>`,
      "  </url>",
    ]),
    "</urlset>",
  ].join("\n")}\n`
  validateSitemap(xml, model)
  return xml
}
