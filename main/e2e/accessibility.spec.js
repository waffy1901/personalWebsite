const { routeMetadata } = require("../src/data/seo.js")
const {
  expectNoBlockingAccessibilityViolations,
} = require("./support/accessibility-scan")
const {
  expect,
  telemetryGuardMarker,
  test,
} = require("./support/telemetry-safe-test")

const localPreviewBaseURL = "http://127.0.0.1:4173"
const canonicalRoutes = routeMetadata.map(({ canonicalPath }) => canonicalPath)

if (process.env.PLAYWRIGHT_LOCAL_PREVIEW !== "1") {
  throw new Error(
    "Accessibility scans require PLAYWRIGHT_LOCAL_PREVIEW=1 and the loopback preview."
  )
}

test.beforeEach(({ baseURL }) => {
  expect(baseURL, "accessibility scans must target the fixed loopback preview").toBe(
    localPreviewBaseURL
  )
  expect(new URL(baseURL).hostname).toBe("127.0.0.1")
})

async function expectRenderedRoute(page, route) {
  expect(
    await page.evaluate(
      (guardMarker) => globalThis[guardMarker] === true,
      telemetryGuardMarker
    ),
    "telemetry interception must initialize before app code"
  ).toBe(true)
  await expect(page.locator("[data-route-ready]")).toHaveAttribute(
    "data-route-ready",
    route
  )
  await expect(page.locator("h1")).toHaveCount(1)
  await expect(page.locator("h1")).toBeVisible()
  await page.waitForLoadState("load")
  await page.evaluate(() => globalThis.document.fonts.ready)
  await page.evaluate(
    () =>
      new Promise((resolve) =>
        globalThis.requestAnimationFrame(() =>
          globalThis.requestAnimationFrame(resolve)
        )
      )
  )
}

async function openRoute(page, route) {
  await page.goto(route, { waitUntil: "domcontentloaded" })
  await expectRenderedRoute(page, route)
}

async function fillValidContactForm(page) {
  await page.getByLabel("First Name").fill("Synthetic")
  await page.getByLabel("Last Name").fill("Visitor")
  await page
    .getByLabel("Email", { exact: true })
    .fill("synthetic@example.test")
  await page
    .getByLabel("Message")
    .fill("Synthetic accessibility validation with no real recipient.")
}

async function focusByKeyboard(page, locator, { reverse = false, maxSteps = 100 } = {}) {
  await expect(locator).toBeVisible()

  for (let step = 0; step <= maxSteps; step += 1) {
    if (await locator.evaluate((element) => element === globalThis.document.activeElement)) {
      return
    }
    await page.keyboard.press(reverse ? "Shift+Tab" : "Tab")
  }

  expect(
    await locator.evaluate((element) => element === globalThis.document.activeElement),
    `keyboard traversal should reach ${await locator.getAttribute("aria-label")}`
  ).toBe(true)
}

async function exerciseOverflowingExpandedRegion(page, regions) {
  const overflowingIndexes = await regions.evaluateAll((elements) =>
    elements.flatMap((element, index) =>
      element.scrollHeight > element.clientHeight ? [index] : []
    )
  )

  if (overflowingIndexes.length === 0) {
    return false
  }

  const region = regions.nth(overflowingIndexes.at(-1))
  const card = region.locator("xpath=ancestor::article")
  const detailsButton = card.locator(
    'button[aria-label^="View details for "]'
  )
  await expect(region).toHaveAttribute("tabindex", "0")
  await focusByKeyboard(page, region, { reverse: true })

  const initialScrollTop = await region.evaluate((element) => element.scrollTop)
  await page.keyboard.press("ArrowDown")
  await expect
    .poll(() => region.evaluate((element) => element.scrollTop))
    .toBeGreaterThan(initialScrollTop)

  await page.keyboard.press("Escape")
  await expect(detailsButton).toHaveAttribute("aria-expanded", "false")
  await expect(detailsButton).toBeFocused()

  await page.keyboard.press("Enter")
  await expect(detailsButton).toHaveAttribute("aria-expanded", "true")
  return true
}

for (const route of canonicalRoutes) {
  test(`${route} has no critical or serious accessibility violations`, async ({
    page,
  }, testInfo) => {
    await openRoute(page, route)
    await expectNoBlockingAccessibilityViolations({
      page,
      route,
      state: "default",
      testInfo,
    })
  })
}

test("expanded project details remain accessible", async ({ page }, testInfo) => {
  const route = "/projects/"
  await openRoute(page, route)

  const detailButtons = page.locator(
    'button[aria-label^="View details for "]'
  )
  const detailCount = await detailButtons.count()
  expect(detailCount, "projects should expose detail controls").toBeGreaterThan(0)

  await focusByKeyboard(page, detailButtons.first())
  await page.keyboard.press("Enter")
  await expect(detailButtons.first()).toHaveAttribute("aria-expanded", "true")

  for (let index = 1; index < detailCount; index += 1) {
    const button = detailButtons.nth(index)
    await button.click()
    await expect(button).toHaveAttribute("aria-expanded", "true")
  }

  const backButtons = page.locator('button[aria-label^="Hide details for "]')
  await expect(backButtons).toHaveCount(detailCount)
  for (let index = 0; index < detailCount; index += 1) {
    await expect(backButtons.nth(index)).toBeVisible()
  }

  const projectScrollRegions = page.locator(
    '[role="group"][aria-label$=" technical details"]'
  )
  await expect(projectScrollRegions).toHaveCount(detailCount)
  const exercisedOverflow = await exerciseOverflowingExpandedRegion(
    page,
    projectScrollRegions
  )
  if (page.viewportSize().width <= 390) {
    expect(
      exercisedOverflow,
      "mobile project details should include an overflowing keyboard-scrollable region"
    ).toBe(true)
  }

  await expectNoBlockingAccessibilityViolations({
    page,
    route,
    state: "all-project-details-expanded",
    testInfo,
  })
})

test("expanded experience content remains accessible", async ({
  page,
}, testInfo) => {
  const route = "/experience/"
  await openRoute(page, route)

  const experienceDetails = page.locator(
    'button[aria-label^="View details for "][aria-label*=" at "]'
  )
  await expect(experienceDetails).toHaveCount(1)
  await focusByKeyboard(page, experienceDetails)
  await page.keyboard.press("Enter")
  await expect(experienceDetails).toHaveAttribute("aria-expanded", "true")

  const experienceScrollRegion = page.getByRole("group", {
    name: / accomplishments at /,
    includeHidden: true,
  })
  await expect(experienceScrollRegion).toHaveCount(1)
  expect(
    await exerciseOverflowingExpandedRegion(page, experienceScrollRegion),
    "experience details should expose an overflowing keyboard-scrollable region"
  ).toBe(true)

  const accomplishmentButtons = page.locator(
    'button[aria-label^="View all accomplishments for "]'
  )
  const accomplishmentCount = await accomplishmentButtons.count()
  expect(
    accomplishmentCount,
    "experience should expose expandable accomplishments"
  ).toBeGreaterThan(0)

  for (let index = accomplishmentCount - 1; index >= 0; index -= 1) {
    await accomplishmentButtons.nth(index).click()
  }
  await expect(
    page.locator('button[aria-label^="Show fewer accomplishments for "]')
  ).toHaveCount(accomplishmentCount)

  await expectNoBlockingAccessibilityViolations({
    page,
    route,
    state: "details-and-accomplishments-expanded",
    testInfo,
  })
})

test("native-invalid contact state remains accessible without a provider request", async ({
  page,
  externalRequests,
}, testInfo) => {
  const route = "/contact/"
  await openRoute(page, route)
  await page.getByLabel("First Name").fill("Synthetic")
  await page.getByLabel("Last Name").fill("Visitor")
  const email = page.getByLabel("Email", { exact: true })
  const message = page.getByLabel("Message")
  await email.fill("invalid-address")
  await message.fill("short")
  await page.getByRole("button", { name: "Send Message" }).click()

  await expect(email).toBeFocused()
  expect(await email.evaluate((field) => field.validity.typeMismatch)).toBe(true)
  expect(await message.evaluate((field) => field.validity.tooShort)).toBe(true)
  expect(externalRequests.formspree).toEqual([])

  await expectNoBlockingAccessibilityViolations({
    page,
    route,
    state: "native-invalid",
    testInfo,
  })
})

test("mocked contact provider states remain accessible and never reach Formspree", async ({
  page,
  externalRequests,
}, testInfo) => {
  const route = "/contact/"
  const mockedRequests = []
  const mockedResponses = [
    {
      status: 422,
      body: {
        errors: [
          {
            field: "email",
            code: "TYPE_EMAIL",
            message: "Use a synthetic valid email address.",
          },
        ],
      },
    },
    {
      status: 422,
      body: { errors: [{ message: "Synthetic service error." }] },
    },
    {
      status: 422,
      body: {
        errors: [
          { message: "Synthetic provider outage." },
          {
            field: "email",
            code: "TYPE_EMAIL",
            message: "Use a synthetic valid email address.",
          },
        ],
      },
    },
    {
      status: 200,
      body: { next: "/synthetic-success" },
    },
  ]

  await page.route("https://formspree.io/f/**", async (requestRoute) => {
    const response = mockedResponses[mockedRequests.length]
    if (!response) {
      throw new Error("Unexpected extra synthetic Formspree request")
    }
    mockedRequests.push({
      method: requestRoute.request().method(),
      url: requestRoute.request().url(),
      body: requestRoute.request().postData() || "",
    })
    await requestRoute.fulfill({
      status: response.status,
      contentType: "application/json",
      body: JSON.stringify(response.body),
    })
  })

  await openRoute(page, route)
  await fillValidContactForm(page)
  const submit = page.getByRole("button", { name: "Send Message" })

  await submit.click()
  await expect(page.locator("#email-error")).toContainText(
    "Use a synthetic valid email address."
  )
  await expectNoBlockingAccessibilityViolations({
    page,
    route,
    state: "provider-field-error",
    testInfo,
  })

  await submit.click()
  await expect(page.getByRole("alert")).toContainText(
    "The message could not be sent."
  )
  await expect(page.getByLabel("Email", { exact: true })).not.toHaveAttribute(
    "aria-invalid"
  )
  await expectNoBlockingAccessibilityViolations({
    page,
    route,
    state: "provider-service-error",
    testInfo,
  })

  await submit.click()
  await expect(page.getByRole("alert")).toContainText(
    "Please correct the highlighted fields, try again, or email me directly."
  )
  await expect(
    page.getByRole("link", { name: "Open an email draft" })
  ).toHaveAttribute("href", "mailto:waffyahmed@gmail.com")
  await expectNoBlockingAccessibilityViolations({
    page,
    route,
    state: "provider-combined-error-recovery",
    testInfo,
  })

  await submit.click()
  const success = page.getByRole("status")
  await expect(success).toContainText("Thank you for your message!")
  await expect(success).toBeFocused()
  await expectNoBlockingAccessibilityViolations({
    page,
    route,
    state: "provider-success",
    testInfo,
  })

  expect(mockedRequests).toHaveLength(mockedResponses.length)
  for (const request of mockedRequests) {
    expect(request).toEqual(
      expect.objectContaining({
        method: "POST",
        url: "https://formspree.io/f/synthetic-premerge-test-key",
        body: expect.stringContaining("synthetic@example.test"),
      })
    )
  }
  expect(externalRequests.formspree).toEqual([])
})

test("serious-rule negative control fails with actionable diagnostics", async ({
  page,
}, testInfo) => {
  const route = "/"
  await openRoute(page, route)
  await expectNoBlockingAccessibilityViolations({
    page,
    route,
    state: "negative-control-baseline",
    testInfo,
  })

  await page.evaluate(() => {
    const unnamedLink = globalThis.document.createElement("a")
    unnamedLink.id = "a11y-negative-control"
    unnamedLink.href = "#a11y-negative-control-target"
    unnamedLink.style.cssText =
      "position:fixed;left:1rem;bottom:1rem;width:2rem;height:2rem;background:#fff;z-index:9999"
    globalThis.document.body.append(unnamedLink)
  })
  await expect(page.locator("#a11y-negative-control")).toBeVisible()

  let expectedFailure
  try {
    await expectNoBlockingAccessibilityViolations({
      page,
      route,
      state: "injected-unnamed-link",
      testInfo,
    })
  } catch (error) {
    expectedFailure = error
  }

  expect(expectedFailure, "injected serious violation should fail the gate").toBeTruthy()
  expect(expectedFailure.message).toContain(
    "route=/ state=injected-unnamed-link"
  )
  expect(expectedFailure.message).toContain("rule=link-name impact=serious")
  expect(expectedFailure.message).toContain("affected node 1")
  expect(expectedFailure.message).toContain("html:")
  expect(expectedFailure.message).toContain("remediation:")
  expect(expectedFailure.message).toContain("remediation URL:")

  await page.locator("#a11y-negative-control").evaluate((element) => element.remove())
  await expectNoBlockingAccessibilityViolations({
    page,
    route,
    state: "negative-control-recovered",
    testInfo,
  })
})
