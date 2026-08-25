const { test: base, expect } = require("@playwright/test")

const telemetryGuardMarker = "__playwrightTelemetryGuardActive"
const useLocalPreview = process.env.PLAYWRIGHT_LOCAL_PREVIEW === "1"

const canonicalRouteExpectations = [
  { path: "/", heading: "Waffy Ahmed" },
  { path: "/projects/", heading: "Practical builds for real workflows" },
  { path: "/experience/", heading: "Work Experience" },
  { path: "/case-studies/", heading: "Selected engineering case studies" },
  {
    path: "/case-studies/kubernetes-autoscaling/",
    heading: "Kubernetes Autoscaling for Transaction-Critical Services",
  },
  {
    path: "/case-studies/legacy-deployment-recovery/",
    heading: "Legacy Deployment Recovery and Credential Rotation",
  },
  {
    path: "/case-studies/cdc-data-reconciliation/",
    heading: "CDC Data Reconciliation Platform",
  },
  { path: "/resume/", heading: "Resume" },
  { path: "/contact/", heading: "Let's connect" },
]

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

function isExpectedAnalyticsCspError(message) {
  return (
    message.startsWith(
      "Connecting to 'https://stats.g.doubleclick.net/g/collect"
    ) &&
    message.includes(
      'violates the following Content Security Policy directive: "connect-src'
    ) &&
    message.endsWith("The action has been blocked.")
  )
}

function isExpectedProductionNotFoundResponse(response, siteOrigin) {
  return (
    !useLocalPreview &&
    response.request().resourceType() === "document" &&
    response.status() === 404 &&
    response.url() === new URL("/not-a-real-route/", siteOrigin).href
  )
}

function isExpectedProductionNotFoundConsoleError(message, page, siteOrigin) {
  const expectedNotFoundUrl = new URL("/not-a-real-route/", siteOrigin).href

  return (
    !useLocalPreview &&
    message.text() ===
      "Failed to load resource: the server responded with a status of 404 ()" &&
    page.url() === expectedNotFoundUrl &&
    message.location().url === expectedNotFoundUrl
  )
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
})

function monitorPage(page, baseURL) {
  const siteOrigin = new URL(baseURL).origin
  const pageErrors = []
  const consoleErrors = []
  const failedFirstPartyRequests = []
  const badFirstPartyResponses = []

  page.on("pageerror", (error) => {
    pageErrors.push(error.message)
  })
  page.on("console", (message) => {
    const text = message.text()

    if (
      message.type() === "error" &&
      !isExpectedAnalyticsCspError(text) &&
      !isExpectedProductionNotFoundConsoleError(message, page, siteOrigin)
    ) {
      consoleErrors.push(text)
    }
  })
  page.on("requestfailed", (request) => {
    if (new URL(request.url()).origin === siteOrigin) {
      failedFirstPartyRequests.push(
        `${request.method()} ${request.url()}: ${request.failure()?.errorText || "failed"}`
      )
    }
  })
  page.on("response", (response) => {
    if (
      new URL(response.url()).origin === siteOrigin &&
      response.status() >= 400 &&
      !isExpectedProductionNotFoundResponse(response, siteOrigin)
    ) {
      badFirstPartyResponses.push(`${response.status()} ${response.url()}`)
    }
  })

  return {
    assertClean() {
      expect(pageErrors, "unexpected page errors").toEqual([])
      expect(consoleErrors, "unexpected console errors").toEqual([])
      expect(
        failedFirstPartyRequests,
        "failed first-party requests"
      ).toEqual([])
      expect(badFirstPartyResponses, "HTTP errors from first-party URLs").toEqual(
        []
      )
    },
  }
}

async function expectHydratedRoute(page, route) {
  expect(
    await page.evaluate(
      (guardMarker) => globalThis[guardMarker] === true,
      telemetryGuardMarker
    ),
    "automatic telemetry interception fixture should initialize before app code"
  ).toBe(true)
  await expect(
    page.getByRole("heading", { level: 1, name: route.heading })
  ).toBeVisible()
  await expect(
    page.locator("[data-route-ready]")
  ).toHaveAttribute("data-route-ready", route.path)
  await expect(
    page.getByRole("navigation", { name: "Primary navigation" })
  ).toBeVisible()
}

async function expectNoHorizontalOverflow(page) {
  const documentWidth = await page.evaluate(() => ({
    clientWidth: globalThis.document.documentElement.clientWidth,
    scrollWidth: globalThis.document.documentElement.scrollWidth,
  }))
  expect(documentWidth.scrollWidth).toBeLessThanOrEqual(
    documentWidth.clientWidth + 1
  )
}

const getViewportScrollY = (page) => page.evaluate(() => globalThis.scrollY)

const setViewportScrollY = (page, scrollY) =>
  page.evaluate((top) => {
    globalThis.scrollTo({ top, left: 0, behavior: "instant" })
  }, scrollY)

for (const route of canonicalRouteExpectations) {
  test(`${route.path} hydrates without horizontal overflow`, async ({
    page,
    baseURL,
  }) => {
    const monitor = monitorPage(page, baseURL)

    await page.goto(route.path, { waitUntil: "domcontentloaded" })
    await expectHydratedRoute(page, route)
    await page.waitForLoadState("load")

    await expectNoHorizontalOverflow(page)
    monitor.assertClean()
  })
}

test("mobile keyboard navigation keeps every primary-nav focus ring visible", async ({
  page,
  baseURL,
}, testInfo) => {
  test.skip(
    testInfo.project.name !== "mobile-chromium",
    "mobile viewport coverage only"
  )

  const monitor = monitorPage(page, baseURL)

  await page.goto("/", { waitUntil: "domcontentloaded" })
  await expectHydratedRoute(page, canonicalRouteExpectations[0])

  const navigation = page.getByRole("navigation", {
    name: "Primary navigation",
  })
  const navLinks = navigation.getByRole("link")

  await expect(page.getByText("More ->", { exact: true })).toBeVisible()
  await expect(navLinks).toHaveCount(6)
  await expect(navLinks.first()).toHaveAttribute("aria-current", "page")
  await expect(navLinks.first()).toHaveClass(/active/)
  await page.keyboard.press("Tab")
  await expect(
    page.getByRole("link", { name: "Skip to main content" })
  ).toBeFocused()
  await page.keyboard.press("Tab")
  await expect(
    page.getByRole("link", { name: "Waffy Ahmed home" })
  ).toBeFocused()
  await page.keyboard.press("Tab")

  for (let index = 0; index < (await navLinks.count()); index += 1) {
    if (index > 0) {
      await page.keyboard.press("Tab")
    }

    const focusedLink = navLinks.nth(index)
    await expect(focusedLink).toBeFocused()
    const bounds = await navigation.evaluate((nav) => {
      const link = nav.querySelector("a:focus")
      const navRect = nav.getBoundingClientRect()
      const linkRect = link?.getBoundingClientRect()

      return linkRect
        ? {
            navLeft: navRect.left,
            navRight: navRect.right,
            navTop: navRect.top,
            navBottom: navRect.bottom,
            linkLeft: linkRect.left,
            linkRight: linkRect.right,
            linkTop: linkRect.top,
            linkBottom: linkRect.bottom,
          }
        : null
    })

    expect(bounds, "a primary navigation link should retain focus").not.toBeNull()
    expect(bounds.linkLeft).toBeGreaterThanOrEqual(bounds.navLeft + 5)
    expect(bounds.linkRight).toBeLessThanOrEqual(bounds.navRight - 5)
    expect(bounds.linkTop).toBeGreaterThanOrEqual(bounds.navTop + 5)
    expect(bounds.linkBottom).toBeLessThanOrEqual(bounds.navBottom - 5)
  }

  await navLinks.nth(1).tap()
  await expect(page).toHaveURL(/\/projects\/$/)
  const projectsLink = page
    .getByRole("navigation", { name: "Primary navigation" })
    .getByRole("link", { name: "Projects" })
  await expect(projectsLink).toHaveAttribute("aria-current", "page")
  await expect(projectsLink).toHaveClass(/active/)
  await expectNoHorizontalOverflow(page)
  monitor.assertClean()
})

test("unknown route renders the target-aware 404 and returns home", async ({
  page,
  baseURL,
}) => {
  const monitor = monitorPage(page, baseURL)

  const response = await page.goto("/not-a-real-route/", {
    waitUntil: "domcontentloaded",
  })

  expect(response?.status(), "unknown-route document response").toBe(
    useLocalPreview ? 200 : 404
  )

  if (useLocalPreview) {
    await expectHydratedRoute(page, {
      path: "/not-a-real-route/",
      heading: "Page not found",
    })
  } else {
    await expect(
      page.getByRole("heading", { level: 1, name: "Page not found" })
    ).toBeVisible()
  }

  await expect(page.locator('meta[name="robots"]')).toHaveAttribute(
    "content",
    "noindex, nofollow"
  )
  await expectNoHorizontalOverflow(page)

  await page.getByRole("link", { name: "Go home" }).click()
  await expect(page).toHaveURL(/\/$/)
  await expectHydratedRoute(page, canonicalRouteExpectations[0])
  monitor.assertClean()
})

test("client navigation resets forward scroll and preserves history scroll restoration", async ({
  page,
  baseURL,
}) => {
  const monitor = monitorPage(page, baseURL)
  const documentRequests = []
  const lazyScriptRequests = []

  page.on("request", (request) => {
    if (request.resourceType() === "document") {
      documentRequests.push(request.url())
    }
    if (
      request.resourceType() === "script" &&
      new URL(request.url()).origin === new URL(baseURL).origin
    ) {
      lazyScriptRequests.push(request.url())
    }
  })

  await page.goto("/", { waitUntil: "domcontentloaded" })
  await expect(
    page.getByRole("heading", { level: 1, name: "Waffy Ahmed" })
  ).toBeVisible()
  await setViewportScrollY(page, 600)
  await expect
    .poll(() => getViewportScrollY(page), {
      message: "Home route should be scrollable for history restoration",
    })
    .toBeGreaterThan(0)
  const sourceScrollY = await getViewportScrollY(page)
  lazyScriptRequests.length = 0

  const projectsLink = page
    .getByRole("navigation", { name: "Primary navigation" })
    .getByRole("link", { name: "Projects" })
  await projectsLink.focus()
  await page.keyboard.press("Enter")
  await expect(page).toHaveURL(/\/projects\/$/)
  await expect(
    page.getByRole("heading", {
      level: 1,
      name: "Practical builds for real workflows",
    })
  ).toBeVisible()
  await expect.poll(() => getViewportScrollY(page)).toBe(0)
  await expect(page.locator("#main-content")).toBeFocused()
  await expect(page.locator("#main-content")).toHaveAttribute("tabindex", "-1")
  expect(
    lazyScriptRequests.some((url) => /\/assets\/.*\.js(?:\?|$)/.test(url)),
    "Projects navigation should load a first-party lazy JavaScript chunk"
  ).toBe(true)

  await setViewportScrollY(page, 300)
  await expect
    .poll(() => getViewportScrollY(page), {
      message: "Projects route should be scrollable for history restoration",
    })
    .toBeGreaterThan(0)
  const destinationScrollY = await getViewportScrollY(page)
  expect(destinationScrollY).not.toBe(sourceScrollY)

  await page.goBack()
  await expect(page).toHaveURL(/\/$/)
  await expect(
    page.getByRole("heading", { level: 1, name: "Waffy Ahmed" })
  ).toBeVisible()
  await expect.poll(() => getViewportScrollY(page)).toBe(sourceScrollY)

  await page.goForward()
  await expect(page).toHaveURL(/\/projects\/$/)
  await expect(
    page.getByRole("heading", {
      level: 1,
      name: "Practical builds for real workflows",
    })
  ).toBeVisible()
  await expect.poll(() => getViewportScrollY(page)).toBe(destinationScrollY)
  expect(documentRequests).toHaveLength(1)
  monitor.assertClean()
})

test("resume preview loads with real image dimensions", async ({ page, baseURL }) => {
  const monitor = monitorPage(page, baseURL)

  await page.goto("/resume/", { waitUntil: "domcontentloaded" })
  const preview = page.getByRole("img", {
    name: "Preview of Waffy Ahmed's resume",
  })
  await expect(preview).toBeVisible()
  await expect
    .poll(() =>
      preview.evaluate((image) => ({
        complete: image.complete,
        naturalHeight: image.naturalHeight,
        naturalWidth: image.naturalWidth,
      }))
    )
    .toEqual({
      complete: true,
      naturalHeight: expect.any(Number),
      naturalWidth: expect.any(Number),
    })

  const dimensions = await preview.evaluate((image) => ({
    naturalHeight: image.naturalHeight,
    naturalWidth: image.naturalWidth,
  }))
  expect(dimensions.naturalWidth).toBeGreaterThan(0)
  expect(dimensions.naturalHeight).toBeGreaterThan(0)
  monitor.assertClean()
})

test("contact form renders without submitting to Formspree", async ({
  page,
  baseURL,
  externalRequests,
}) => {
  const monitor = monitorPage(page, baseURL)

  await page.goto("/contact/", { waitUntil: "domcontentloaded" })
  await expect(page.getByRole("heading", { name: "Contact Form" })).toBeVisible()
  await expect(page.locator("form")).toBeVisible()
  expect(externalRequests.formspree).toEqual([])
  monitor.assertClean()
})
