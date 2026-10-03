const { test: base, expect } = require("@playwright/test")

const telemetryGuardMarker = "__playwrightTelemetryGuardActive"

function isAnalyticsHost(hostname) {
  return (
    hostname === "www.googletagmanager.com" ||
    hostname === "stats.g.doubleclick.net" ||
    hostname === "google-analytics.com" ||
    hostname.endsWith(".google-analytics.com") ||
    hostname === "analytics.google.com" ||
    hostname.endsWith(".analytics.google.com")
  )
}

function isFormspreeHost(hostname) {
  return hostname === "formspree.io" || hostname.endsWith(".formspree.io")
}

const test = base.extend({
  externalRequests: [
    async ({ context }, use) => {
      const externalRequests = {
        analytics: [],
        formspree: [],
      }

      await context.addInitScript((guardMarker) => {
        globalThis[guardMarker] = true
        globalThis.dataLayer = []
        globalThis.gtag = () => undefined
      }, telemetryGuardMarker)

      await context.route("**/*", async (route) => {
        const request = route.request()
        const { hostname } = new URL(request.url())

        if (isAnalyticsHost(hostname)) {
          externalRequests.analytics.push(request.url())
          await route.fulfill({
            status: 200,
            contentType:
              request.resourceType() === "script"
                ? "application/javascript"
                : "text/plain",
            body: "",
          })
          return
        }

        if (isFormspreeHost(hostname)) {
          externalRequests.formspree.push(request.url())
          await route.abort("blockedbyclient")
          return
        }

        await route.continue()
      })

      await use(externalRequests)
    },
    { auto: true },
  ],
  runtimeEvidence: [
    async ({ browser, page }, use, testInfo) => {
      const viewport = page.viewportSize()

      testInfo.annotations.push({
        type: "browser",
        description: `${browser.browserType().name()} ${browser.version()}`,
      })
      testInfo.annotations.push({
        type: "viewport",
        description: viewport ? `${viewport.width}x${viewport.height}` : "none",
      })

      try {
        await use()
      } finally {
        const url = page.url()
        let route = "not-navigated"

        if (url && url !== "about:blank") {
          route = new URL(url).pathname
        }
        testInfo.annotations.push({ type: "route", description: route })
      }
    },
    { auto: true },
  ],
})

module.exports = {
  expect,
  telemetryGuardMarker,
  test,
}
