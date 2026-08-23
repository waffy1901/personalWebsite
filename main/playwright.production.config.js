const { defineConfig } = require("@playwright/test")

const localPreviewBaseURL = "http://127.0.0.1:4173"
const useLocalPreview = process.env.PLAYWRIGHT_LOCAL_PREVIEW === "1"
const productionBaseURL =
  process.env.PLAYWRIGHT_PRODUCTION_BASE_URL?.trim()
const baseURL = useLocalPreview
  ? localPreviewBaseURL
  : productionBaseURL || "https://waffy.dev"

module.exports = defineConfig({
  testDir: "./e2e",
  testMatch: "production-smoke.spec.js",
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  timeout: 45_000,
  expect: {
    timeout: 10_000,
  },
  outputDir: "test-results",
  reporter: [
    ["line"],
    ["html", { open: "never", outputFolder: "playwright-report" }],
  ],
  webServer: useLocalPreview
    ? {
        command:
          "npm run preview -- --host 127.0.0.1 --port 4173 --strictPort",
        url: localPreviewBaseURL,
        reuseExistingServer: false,
        timeout: 120_000,
      }
    : undefined,
  use: {
    baseURL,
    browserName: "chromium",
    serviceWorkers: "block",
    screenshot: "only-on-failure",
    trace: "on-first-retry",
    navigationTimeout: 30_000,
  },
  projects: [
    {
      name: "desktop-chromium",
      use: {
        viewport: { width: 1440, height: 1000 },
      },
    },
    {
      name: "mobile-chromium",
      use: {
        viewport: { width: 390, height: 844 },
        deviceScaleFactor: 1,
        hasTouch: true,
        isMobile: true,
      },
    },
  ],
})
