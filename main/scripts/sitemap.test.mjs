import { afterEach, describe, expect, it, vi } from "vitest"
import * as model from "../src/data/seo.js"
import { buildSitemap, sitemapUrls, validateSitemap } from "./sitemap.mjs"

const resource = "https://waffy.dev/portfolio.json"
const entry = (url) => `<url><loc>${url}</loc></url>`
const replaceResource = (xml, replacement) => xml.replace(resource, replacement)

afterEach(() => vi.unstubAllEnvs())

describe("sitemap XML and canonical inventory", () => {
  it("preserves every canonical route and discovery resource with URL-only entries", () => {
    const xml = buildSitemap(model)
    const expected = [
      ...model.routeMetadata.map((route) => model.toCanonicalRouteUrl(route.path)),
      "https://waffy.dev/llms.txt",
      "https://waffy.dev/ai-summary.txt",
      resource,
    ]
    expect(validateSitemap(xml, model)).toEqual(expected)
    expect(xml).not.toMatch(/<(?:priority|changefreq|lastmod)\b/)
  })

  it("does not derive freshness from build or deployment date environments", () => {
    vi.stubEnv("VITE_DEPLOY_DATE", "2020-01-01T00:00:00Z")
    vi.stubEnv("SOURCE_DATE_EPOCH", "1577836800")
    const first = buildSitemap(model)
    vi.stubEnv("VITE_DEPLOY_DATE", "2030-12-31T23:59:59Z")
    vi.stubEnv("SOURCE_DATE_EPOCH", "1924991999")
    expect(buildSitemap(model)).toBe(first)
  })

  it.each([
    ["unclosed root", (xml) => xml.replace("</urlset>", "")],
    ["mismatched tag", (xml) => xml.replace("</loc>", "</location>")],
    ["bare ampersand", (xml) => replaceResource(xml, `${resource}?a=1&b=2`)],
    ["multiple roots", (xml) => `${xml}<urlset/>`],
  ])("rejects malformed XML: %s", (_label, change) => {
    expect(() => validateSitemap(change(buildSitemap(model)), model)).toThrow("Malformed sitemap XML")
  })

  it.each([
    ["wrong namespace", (xml) => xml.replace("http://www.sitemaps.org/schemas/sitemap/0.9", "https://example.com/schema")],
    ["missing namespace", (xml) => xml.replace(' xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"', "")],
    ["wrong root", (xml) => xml.replaceAll("urlset", "sitemapindex")],
    ["foreign loc", (xml) => xml.replace("<loc>", '<loc xmlns="urn:foreign">')],
    ["nested loc markup", (xml) => xml.replace(resource, `<nested>${resource}</nested>`)],
    ["extra loc", (xml) => xml.replace("</url>", "<loc>https://waffy.dev/</loc></url>")],
    ["missing loc", (xml) => xml.replace(`<loc>${resource}</loc>`, "")],
    ["url attribute", (xml) => xml.replace("<url>", '<url modified="today">')],
    ["unexpected text", (xml) => xml.replace("</urlset>", "unexpected</urlset>")],
    ["DTD", (xml) => xml.replace("<urlset", '<!DOCTYPE urlset SYSTEM "https://example.com/external.dtd"><urlset')],
  ])("rejects unsupported XML structure: %s", (_label, change) => {
    expect(() => validateSitemap(change(buildSitemap(model)), model)).toThrow()
  })

  it.each(["priority", "changefreq", "lastmod"])("rejects unsupported %s metadata", (field) => {
    const xml = buildSitemap(model).replace("</url>", `<${field}>2026-10-14</${field}></url>`)
    expect(() => validateSitemap(xml, model)).toThrow("freshness metadata is unsupported")
  })

  it.each([
    "not a URL",
    "http://waffy.dev/portfolio.json",
    "https://example.com/portfolio.json",
    "https://www.waffy.dev/portfolio.json",
    "https://WAFFY.dev/portfolio.json",
    "https://waffy.dev:443/portfolio.json",
    "https://user:pass@waffy.dev/portfolio.json",
    "https://waffy.dev/Portfolio.json",
    "https://waffy.dev/portfolio.json/",
    "https://waffy.dev/portfolio.json?fresh=1",
    "https://waffy.dev/portfolio.json#section",
    "https://waffy.dev/%70ortfolio.json",
    "https://waffy.dev/a/../portfolio.json",
    " https://waffy.dev/portfolio.json ",
    "https://waffy.dev//portfolio.json",
  ])("rejects invalid or noncanonical URL %s", (url) => {
    expect(() => validateSitemap(replaceResource(buildSitemap(model), url), model)).toThrow(/(?:Invalid|Noncanonical) sitemap URL/)
  })

  it.each(["https://waffy.dev/contact", "https://waffy.dev/Contact/", "https://waffy.dev/%63ontact/"])(
    "rejects noncanonical HTML route %s",
    (url) => expect(() => validateSitemap(buildSitemap(model).replace("https://waffy.dev/contact/", url), model)).toThrow("Noncanonical sitemap URL"),
  )

  it("rejects duplicate, missing and extra canonical URLs", () => {
    const xml = buildSitemap(model)
    expect(() => validateSitemap(xml.replace("</urlset>", `${entry(resource)}</urlset>`), model)).toThrow("Duplicate sitemap URL")
    expect(() => validateSitemap(xml.replace(/\s*<url>\s*<loc>https:\/\/waffy.dev\/portfolio.json<\/loc>\s*<\/url>/, ""), model)).toThrow("Missing sitemap URLs")
    expect(() => validateSitemap(xml.replace("</urlset>", `${entry("https://waffy.dev/unlisted/")}</urlset>`), model)).toThrow("Unexpected sitemap URL")
  })

  it("rejects invalid or duplicate canonical inputs before generating output", () => {
    expect(() => buildSitemap({ ...model, toAbsoluteUrl: () => "http://waffy.dev/llms.txt" })).toThrow("Noncanonical sitemap URL")
    expect(() => sitemapUrls({ ...model, routeMetadata: [...model.routeMetadata, model.routeMetadata[0]] })).toThrow("Duplicate canonical sitemap URL inventory")
  })
})
