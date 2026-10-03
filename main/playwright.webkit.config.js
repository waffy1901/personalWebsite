const path = require("node:path")
const { defineConfig } = require("@playwright/test")

const localPreviewBaseURL = "http://127.0.0.1:4173"
const evidenceDir = path.join(__dirname, "webkit-results", "current")

if (process.env.PLAYWRIGHT_PRODUCTION_BASE_URL?.trim()) {
  throw new Error(
    "The WebKit smoke suite is local-only and rejects PLAYWRIGHT_PRODUCTION_BASE_URL."
  )
}

module.exports = defineConfig({
  testDir: "./e2e",
  testMatch: ["production-smoke.spec.js", "webkit-local.spec.js"],
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  timeout: 45_000,
  expect: {
    timeout: 10_000,
  },
  outputDir: path.join(evidenceDir, "test-results"),
  reporter: [
    ["line"],
    [
      path.join(__dirname, "e2e", "reporters", "webkit-summary-reporter.js"),
      { outputDir: evidenceDir },
    ],
    ["html", { open: "never", outputFolder: path.join(evidenceDir, "html") }],
  ],
  webServer: {
    command: "npm run preview -- --host 127.0.0.1 --port 4173 --strictPort",
    url: localPreviewBaseURL,
    reuseExistingServer: false,
    timeout: 120_000,
  },
  use: {
    baseURL: localPreviewBaseURL,
    browserName: "webkit",
    serviceWorkers: "block",
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
    navigationTimeout: 30_000,
  },
  projects: [
    {
      name: "desktop-webkit",
      metadata: {
        browserEngine: "webkit",
        viewportClass: "desktop",
      },
      use: {
        viewport: { width: 1440, height: 1000 },
      },
    },
    {
      name: "mobile-webkit",
      metadata: {
        browserEngine: "webkit",
        viewportClass: "mobile",
      },
      use: {
        viewport: { width: 390, height: 844 },
        deviceScaleFactor: 1,
        hasTouch: true,
        isMobile: true,
      },
    },
  ],
})
