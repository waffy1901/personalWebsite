const {
  expect,
  telemetryGuardMarker,
  test,
} = require("./support/telemetry-safe-test")
const useLocalPreview = process.env.PLAYWRIGHT_LOCAL_PREVIEW === "1"

// This is an automated discovery and containment check. Unaided human reading
// within 60 seconds and conversion improvement remain separate evidence gaps.
async function expectContentContained(container) {
  const failures = await container.evaluate((element) => {
    const bounds = element.getBoundingClientRect()
    const failures = []
    const contained = (rect) =>
      rect.left >= bounds.left - 1 && rect.right <= bounds.right + 1 &&
      rect.top >= bounds.top - 1 && rect.bottom <= bounds.bottom + 1

    for (const child of element.querySelectorAll("h1, h2, h3, p, li, a, button, img")) {
      if (child.closest('[aria-hidden="true"], .sr-only, [role="group"]')) continue
      if (!contained(child.getBoundingClientRect())) failures.push(child.textContent || child.tagName)
    }
    // Element boxes alone can miss text painting outside a clipped container.
    const walker = globalThis.document.createTreeWalker(element, globalThis.NodeFilter.SHOW_TEXT)
    while (walker.nextNode()) {
      const node = walker.currentNode
      if (!node.textContent.trim() || node.parentElement.closest('[aria-hidden="true"], .sr-only, [role="group"]')) continue
      const range = globalThis.document.createRange()
      range.selectNodeContents(node)
      for (const rect of range.getClientRects()) {
        if (!contained(rect)) failures.push(node.textContent.trim())
      }
    }
    return failures
  })
  expect(failures, "visible text and controls must fit their active container").toEqual([])
}

async function enlargeText(page) {
  await page.evaluate(() => {
    // Enlarge text independently of spacing and images, like text-only zoom.
    const sizes = Array.from(globalThis.document.querySelectorAll("body *"), (element) =>
      [element, parseFloat(globalThis.getComputedStyle(element).fontSize)]
    )
    for (const [element, size] of sizes) element.style.fontSize = `${size * 2}px`
  })
}

async function expectProofTextWithinClippingPanel(proof, panelSelector) {
  const geometry = await proof.evaluate((element, expectedPanelSelector) => {
    let panel = element.parentElement
    while (panel) {
      const style = globalThis.getComputedStyle(panel)
      if ([style.overflowX, style.overflowY].some((overflow) => ["hidden", "clip"].includes(overflow))) break
      panel = panel.parentElement
    }
    if (!panel) return null
    const bounds = panel.getBoundingClientRect()
    const range = globalThis.document.createRange()
    range.selectNodeContents(element)
    const rects = Array.from(range.getClientRects())
    return {
      matchesExpectedPanel: panel.matches(expectedPanelSelector),
      paintedRects: rects.length,
      overflow: Math.max(0, ...rects.flatMap((rect) => [
        bounds.left - rect.left, rect.right - bounds.right,
        bounds.top - rect.top, rect.bottom - bounds.bottom,
      ])),
    }
  }, panelSelector)
  expect(geometry, "Proof text should have a clipping ancestor").not.toBeNull()
  expect(geometry.matchesExpectedPanel, "Check the actual clipping panel, including Home's PresentationPanel").toBe(true)
  expect(geometry.paintedRects, "Proof text should paint readable lines before interaction").toBeGreaterThan(0)
  expect(geometry.overflow, `Proof text must remain inside its clipping panel: ${await proof.textContent()}`).toBeLessThanOrEqual(1)
}

for (const width of [320, 390]) {
  test(`new proof text stays within clipping panels at ${width}px / 200% root font`, async ({ page }, testInfo) => {
    test.skip(!useLocalPreview, "Root-font proof checks run only against the isolated loopback build")
    test.skip(testInfo.project.metadata.viewportClass !== "desktop", "Explicit width profiles run once per browser engine")
    await page.setViewportSize({ width, height: 1000 })
    await page.emulateMedia({ reducedMotion: "reduce" })

    // Root-font enlargement also grows rem padding. Keep this focused on the
    // added proof text; existing badge/control/detail clipping is issue 242.
    for (const route of ["/", "/experience/", "/projects/"]) {
      await page.goto(route, { waitUntil: "domcontentloaded" })
      const highlights = page.getByRole("list", { name: "Recent engineering outcomes" })
      const buttons = page.locator('button[aria-label^="View details for "]')
      if (route === "/projects/") await expect(buttons).toHaveCount(3)
      else await expect(highlights).toBeVisible()
      await page.evaluate(() => globalThis.document.fonts.ready)
      await page.evaluate(() => globalThis.document.documentElement.style.setProperty("font-size", "200%", "important"))
      await expect(page.locator("html")).toHaveCSS("font-size", "32px")

      if (route !== "/projects/") {
        const proof = highlights.locator("li > span:last-child")
        await expect(proof).toHaveCount(3)
        for (let index = 0; index < 3; index += 1) {
          await expectProofTextWithinClippingPanel(proof.nth(index), route === "/" ? ".mc-presentation-panel" : '[aria-hidden="false"]')
        }
        if (route === "/experience/") await expect(buttons).toHaveAttribute("aria-expanded", "false")
      } else {
        for (let index = 0; index < 3; index += 1) {
          const button = buttons.nth(index)
          await expect(button).toHaveAttribute("aria-expanded", "false")
          const face = button.locator("xpath=ancestor::article").locator('[aria-hidden="false"]').first()
          const proof = face.locator(":scope > p")
          await expect(proof).toHaveCount(2)
          for (let proofIndex = 0; proofIndex < 2; proofIndex += 1) {
            await expectProofTextWithinClippingPanel(proof.nth(proofIndex), '[aria-hidden="false"]')
          }
        }
      }
    }
  })
}

async function cardLogoGeometry(card) {
  return card.evaluate((element) => {
    const cardBounds = element.getBoundingClientRect()
    const buttonBounds = element.querySelector('button[aria-label^="View details for "]').getBoundingClientRect()
    const image = element.querySelector("picture img")
    const imageBounds = image.getBoundingClientRect()
    return {
      cardHeight: cardBounds.height,
      buttonTop: buttonBounds.top + globalThis.scrollY,
      imageWidth: imageBounds.width,
      imageHeight: imageBounds.height,
      loaded: image.complete && image.naturalWidth > 0,
    }
  })
}

for (const width of [320, 390]) {
  for (const route of ["/projects/", "/experience/"]) {
    test(`delayed card logos preserve geometry and normal-motion Details activation on ${route} at ${width}px`, async ({ page }, testInfo) => {
      test.skip(!useLocalPreview, "Delayed-logo checks run only against the isolated loopback build")
      test.skip(testInfo.project.metadata.viewportClass !== "desktop", "Explicit width profiles run once per browser engine")
      await page.setViewportSize({ width, height: 1000 })
      await page.emulateMedia({ reducedMotion: "no-preference" })

      let releaseLogos
      let delayedLogos = 0
      const logoGate = new Promise((resolve) => { releaseLogos = resolve })
      await page.route(/\/assets\/(?:cdcLogo|jobSearchLogo|discoveryServiceLogo|hdLogo)-[^/]+\.(?:webp|png)$/, async (requestRoute) => {
        delayedLogos += 1
        await logoGate
        await requestRoute.continue()
      })

      try {
        await page.goto(route, { waitUntil: "domcontentloaded" })
        const buttons = page.locator('button[aria-label^="View details for "]')
        const cardCount = route === "/projects/" ? 3 : 1
        await expect(buttons).toHaveCount(cardCount)
        await page.evaluate(() => globalThis.document.fonts.ready)
        const cards = []
        const before = []
        for (let index = 0; index < cardCount; index += 1) {
          const button = buttons.nth(index)
          const card = button.locator("xpath=ancestor::article")
          await button.scrollIntoViewIfNeeded()
          cards.push(card)
          before.push(await cardLogoGeometry(card))
        }
        await expect.poll(() => delayedLogos).toBe(cardCount)
        for (const geometry of before) {
          expect(geometry.loaded, "Logo bytes should still be withheld during the initial measurement").toBe(false)
          expect(geometry.imageWidth, "The unloaded logo should reserve its width").toBeGreaterThan(0)
          expect(geometry.imageHeight, "The unloaded logo should reserve its height").toBeGreaterThan(0)
        }
        expect(await page.evaluate(() => globalThis.matchMedia("(prefers-reduced-motion: reduce)").matches)).toBe(false)
        await expect(cards[0].locator(":scope > div")).toHaveCSS("transition-duration", "0.5s")

        // Release image bytes between pointer down and up: a shifting button
        // previously discarded this activation in WebKit at narrow widths.
        await buttons.first().scrollIntoViewIfNeeded()
        const pressedBounds = await buttons.first().boundingBox()
        await page.mouse.move(pressedBounds.x + pressedBounds.width / 2, pressedBounds.y + pressedBounds.height / 2)
        await page.mouse.down()
        releaseLogos()
        for (const card of cards) {
          await expect.poll(() => card.locator("picture img").evaluate((image) => image.complete && image.naturalWidth > 0)).toBe(true)
        }
        await page.evaluate(() => new Promise((resolve) => globalThis.requestAnimationFrame(() => globalThis.requestAnimationFrame(resolve))))
        for (let index = 0; index < cardCount; index += 1) {
          const after = await cardLogoGeometry(cards[index])
          for (const metric of ["cardHeight", "buttonTop", "imageWidth", "imageHeight"]) {
            expect(Math.abs(after[metric] - before[index][metric]), `${route} card ${index + 1} ${metric} should remain stable when its logo arrives`).toBeLessThan(1)
          }
        }
        const releasedBounds = await buttons.first().boundingBox()
        expect(Math.abs(releasedBounds.y - pressedBounds.y), "The pressed button should retain its viewport position").toBeLessThan(1)
        await page.mouse.up()

        for (let index = 0; index < cardCount; index += 1) {
          const button = buttons.nth(index)
          if (index > 0) await button.click()
          await expect(button).toHaveAttribute("aria-expanded", "true")
          const back = cards[index].getByRole("button", { name: /^Back to summary for / })
          await expect(back).toBeFocused()
          await back.click()
          await expect(button).toHaveAttribute("aria-expanded", "false")
          await expect(button).toBeFocused()
        }
      } finally {
        releaseLogos()
        await page.mouse.up()
      }
    })
  }
}

for (const width of [320, 390, 640, 1024, 1440]) {
  for (const textScale of [1, 2]) {
    test(`visible outcomes remain discoverable and contained at ${width}px / ${textScale * 100}% text`, async ({ page }, testInfo) => {
      test.skip(!useLocalPreview, "Issue 264 layout checks run only against the isolated loopback build")
      test.skip(testInfo.project.metadata.viewportClass !== "desktop", "Explicit width profiles run once per browser engine")
      await page.setViewportSize({ width, height: 1000 })
      await page.emulateMedia({ reducedMotion: "reduce" })

      await page.goto("/", { waitUntil: "domcontentloaded" })
      const outcomes = page.getByRole("list", { name: "Recent engineering outcomes" })
      await expect(outcomes).toBeVisible()
      await page.evaluate(() => globalThis.document.fonts.ready)
      if (textScale === 2) await enlargeText(page)
      await expect(outcomes).toContainText("Led 4 engineers through stakeholder validation and handoff")
      await expect(outcomes).toContainText("7 payment applications")
      await expect(outcomes).toContainText("JFrog OIDC tokens across 2 teams and 20 repositories")
      const hero = outcomes.locator("xpath=ancestor::section[1]")
      await expect(hero).toContainText("Software Engineer II at The Home Depot")
      await expectContentContained(hero)
      await expect(hero.getByRole("link", { name: "Download Resume" })).toBeVisible()
      await expect(hero.getByRole("link", { name: "Contact", exact: true })).toBeVisible()

      for (const route of ["/experience/", "/projects/"]) {
        await page.goto(route, { waitUntil: "domcontentloaded" })
        const buttons = page.locator('button[aria-label^="View details for "]')
        await expect(buttons).toHaveCount(route === "/experience/" ? 1 : 3)
        await page.evaluate(() => globalThis.document.fonts.ready)
        if (textScale === 2) await enlargeText(page)

        for (let index = 0; index < await buttons.count(); index += 1) {
          const button = buttons.nth(index)
          const card = button.locator("xpath=ancestor::article")
          const face = card.locator('[aria-hidden="false"]').first()
          await expectContentContained(face)
          await expect(button).toBeVisible()
          if (route === "/experience/") {
            await expect(card.getByRole("list", { name: "Recent engineering outcomes" })).toContainText("7 payment applications")
            await expect(card).toContainText("JFrog OIDC tokens across 2 teams and 20 repositories")
          } else {
            const projectProof = [
              ["Automated infectious-disease case-count reconciliation", "Saved 5000+ hours"],
              ["Android job-search support application", "Fetches Adzuna jobs"],
              ["Campus event discovery and registration", "event capacities, details, and waitlists"],
            ][index]
            for (const proof of projectProof) await expect(face).toContainText(proof)
            await expect(card.getByRole("link", { name: "Source Code" })).toBeVisible()
          }
          await button.click()
          const back = card.getByRole("button", { name: /^Back to summary for / })
          await expect(back).toBeFocused()
          await expectContentContained(card.getByRole("region"))
          await expect(button).toHaveAttribute("tabindex", "-1")
          const group = card.getByRole("group")
          await expect(group).toHaveAttribute("tabindex", "0")
          await group.focus()
          await page.keyboard.press("End")
          const finalItem = group.locator("li").last()
          await expect.poll(async () => {
            const lastBounds = await finalItem.boundingBox()
            const groupBounds = await group.boundingBox()
            return lastBounds.y + lastBounds.height - (groupBounds.y + groupBounds.height)
          }, { message: "End should expose the final accomplishment or technical note" }).toBeLessThanOrEqual(1)
          await page.keyboard.press("Escape")
          await expect(button).toBeFocused()
          await expect(button).toHaveAttribute("aria-expanded", "false")
        }
      }
    })
  }
}

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

const delayedLazyRouteExpectations = [
  { path: "/projects/", heading: "Practical builds for real workflows", chunk: "Projects" },
  { path: "/experience/", heading: "Work Experience", chunk: "Experience" },
  { path: "/case-studies/", heading: "Selected engineering case studies", chunk: "CaseStudies" },
  { path: "/resume/", heading: "Resume", chunk: "Resume" },
  { path: "/contact/", heading: "Let's connect", chunk: "Contact" },
]

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

for (const profile of [
  { name: "desktop 1x", width: 1440, height: 1000, dpr: 1, source: "/resume-preview.webp" },
  { name: "desktop 2x", width: 1440, height: 1000, dpr: 2, source: "/resume-preview-1920.webp" },
  { name: "mobile 1x", width: 390, height: 844, dpr: 1, source: "/resume-preview-640.webp" },
  { name: "mobile 3x", width: 390, height: 844, dpr: 3, source: "/resume-preview.webp" },
]) {
  test.describe(`responsive resume ${profile.name}`, () => {
    test.use({ viewport: { width: profile.width, height: profile.height }, deviceScaleFactor: profile.dpr, isMobile: profile.width === 390, hasTouch: profile.width === 390 })
    test("selects a sharp source and preserves image space while it loads", async ({ page }, testInfo) => {
      // Each profile sets its own viewport/DPR; don't duplicate across projects.
      test.skip(
        testInfo.project.metadata.viewportClass !== "desktop",
        "Explicit resume profiles run once per browser engine"
      )
      await page.addInitScript(() => {
        globalThis.__resumeLayoutShift = 0
        globalThis.__resumeLayoutShiftSupported =
          typeof PerformanceObserver !== "undefined" &&
          PerformanceObserver.supportedEntryTypes?.includes("layout-shift")
        if (!globalThis.__resumeLayoutShiftSupported) return
        new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            if (!entry.hadRecentInput) globalThis.__resumeLayoutShift += entry.value
          }
        }).observe({ type: "layout-shift", buffered: true })
      })
      let releaseImage
      const imageGate = new Promise((resolve) => { releaseImage = resolve })
      await page.route("**/resume-preview*.webp", async (route) => {
        await imageGate
        await route.continue()
      })
      await page.goto("/resume/", { waitUntil: "domcontentloaded" })
      const preview = page.getByRole("img", { name: "Preview of Waffy Ahmed's resume" })
      await expect(preview).toBeVisible()
      await page.evaluate(() => globalThis.document.fonts.ready)
      await page.evaluate(() => new Promise((resolve) => globalThis.requestAnimationFrame(() => globalThis.requestAnimationFrame(resolve))))
      const before = await preview.boundingBox()
      // Scope this guard to image arrival, after the existing lazy route mounts.
      await page.evaluate(() => { globalThis.__resumeLayoutShift = 0 })
      releaseImage()
      await expect.poll(() => preview.evaluate((image) => image.complete && image.naturalWidth > 0)).toBe(true)
      await page.evaluate(() => new Promise((resolve) => globalThis.requestAnimationFrame(() => globalThis.requestAnimationFrame(resolve))))
      const metrics = await preview.evaluate((image) => ({
        source: new URL(image.currentSrc).pathname,
        width: image.getBoundingClientRect().width,
        height: image.getBoundingClientRect().height,
        top: image.getBoundingClientRect().top,
        overflow: globalThis.document.documentElement.scrollWidth > globalThis.innerWidth,
        cls: globalThis.__resumeLayoutShift,
        clsSupported: globalThis.__resumeLayoutShiftSupported,
      }))
      expect(metrics.source).toBe(profile.source)
      expect(metrics.width).toBeCloseTo(profile.width === 390 ? 306 : 882, 0)
      expect(metrics.overflow).toBe(false)
      expect(Math.abs(metrics.height - before.height)).toBeLessThan(1)
      expect(Math.abs(metrics.top - before.y)).toBeLessThan(1)
      if (testInfo.project.metadata.browserEngine === "chromium") {
        expect(
          metrics.clsSupported,
          "Chromium should expose layout-shift PerformanceObserver entries"
        ).toBe(true)
      }
      if (metrics.clsSupported) {
        expect(metrics.cls).toBeLessThan(0.001)
      } else {
        expect(testInfo.project.metadata.browserEngine).toBe("webkit")
        testInfo.annotations.push({
          type: "unsupported",
          description:
            "This WebKit runtime does not expose layout-shift PerformanceObserver entries; geometry assertions still ran.",
        })
      }
    })
  })
}

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

async function installWholeNavigationClsObserver(page) {
  await page.addInitScript(() => {
    const supported =
      typeof PerformanceObserver !== "undefined" &&
      PerformanceObserver.supportedEntryTypes?.includes("layout-shift")
    globalThis.__wholeNavigationCls = { supported, value: 0 }
    if (!supported) return

    let sessionValue = 0
    let sessionStartTime = 0
    let lastEntryTime = 0
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        if (entry.hadRecentInput) continue

        const startsNewSession =
          sessionStartTime === 0 ||
          entry.startTime - lastEntryTime > 1000 ||
          entry.startTime - sessionStartTime > 5000
        if (startsNewSession) {
          sessionValue = entry.value
          sessionStartTime = entry.startTime
        } else {
          sessionValue += entry.value
        }
        lastEntryTime = entry.startTime
        globalThis.__wholeNavigationCls.value = Math.max(
          globalThis.__wholeNavigationCls.value,
          sessionValue
        )
      }
    }).observe({ type: "layout-shift", buffered: true })
  })
}

async function routeShellGeometry(page) {
  return page.locator("[data-route-shell]").evaluate((shell) => ({
    footerTop: shell.nextElementSibling?.getBoundingClientRect().top ?? -1,
    shellBottom: shell.getBoundingClientRect().bottom,
    viewportHeight: globalThis.innerHeight,
  }))
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

for (const route of delayedLazyRouteExpectations) {
  test(`${route.path} keeps the footer below the mobile viewport through lazy mount`, async ({
    page,
  }, testInfo) => {
    test.skip(
      testInfo.project.metadata.viewportClass !== "mobile",
      "mobile viewport covers every affected lazy route; representative desktop checks run separately"
    )

    await installWholeNavigationClsObserver(page)
    let releaseChunk
    let chunkWasDelayed = false
    const chunkGate = new Promise((resolve) => { releaseChunk = resolve })
    await page.route("**/assets/*.js", async (requestRoute) => {
      const pathname = new URL(requestRoute.request().url()).pathname
      if (pathname.includes(`/assets/${route.chunk}-`)) {
        chunkWasDelayed = true
        await chunkGate
      }
      await requestRoute.continue()
    })

    await page.goto(route.path, { waitUntil: "domcontentloaded" })
    try {
      await expect(page.locator("[data-route-loading-fallback]")).toBeVisible()
      expect(chunkWasDelayed, `${route.chunk} lazy chunk should be delayed`).toBe(true)
      const fallbackGeometry = await routeShellGeometry(page)
      expect(fallbackGeometry.shellBottom).toBeGreaterThanOrEqual(
        fallbackGeometry.viewportHeight - 1
      )
      expect(fallbackGeometry.footerTop).toBeGreaterThanOrEqual(
        fallbackGeometry.viewportHeight - 1
      )
    } finally {
      releaseChunk()
    }

    await expectHydratedRoute(page, route)
    await page.evaluate(() => globalThis.document.fonts.ready)
    await page.evaluate(() => new Promise((resolve) =>
      globalThis.requestAnimationFrame(() => globalThis.requestAnimationFrame(resolve))
    ))
    const mountedGeometry = await routeShellGeometry(page)
    expect(mountedGeometry.shellBottom).toBeGreaterThanOrEqual(
      mountedGeometry.viewportHeight - 1
    )
    expect(mountedGeometry.footerTop).toBeGreaterThanOrEqual(
      mountedGeometry.viewportHeight - 1
    )

    const cls = await page.evaluate(() => globalThis.__wholeNavigationCls)
    if (testInfo.project.metadata.browserEngine === "chromium") {
      expect(
        cls.supported,
        "Chromium should expose layout-shift PerformanceObserver entries"
      ).toBe(true)
      expect(cls.value).toBeLessThanOrEqual(0.1)
    } else {
      expect(testInfo.project.metadata.browserEngine).toBe("webkit")
      if (cls.supported) {
        expect(cls.value).toBeLessThanOrEqual(0.1)
      } else {
        testInfo.annotations.push({
          type: "unsupported",
          description:
            "This WebKit runtime does not expose layout-shift PerformanceObserver entries; fallback and mounted geometry assertions still ran.",
        })
      }
    }
  })
}

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
    testInfo.project.metadata.viewportClass !== "mobile",
    "mobile viewport coverage only"
  )
  const usesMacWebKitTraversal =
    testInfo.project.metadata.browserEngine === "webkit" &&
    process.platform === "darwin"
  const focusTraversalKey = usesMacWebKitTraversal ? "Alt+Tab" : "Tab"
  testInfo.annotations.push({
    type: "keyboardTraversal",
    description: usesMacWebKitTraversal
      ? "Alt+Tab (macOS WebKit Option-Tab link traversal)"
      : "Tab",
  })

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
  await page.keyboard.press(focusTraversalKey)
  await expect(
    page.getByRole("link", { name: "Skip to main content" })
  ).toBeFocused()
  await page.keyboard.press(focusTraversalKey)
  await expect(
    page.getByRole("link", {
      name: "WA Waffy Ahmed Platform reliability engineer",
      exact: true,
    })
  ).toBeFocused()
  await page.keyboard.press(focusTraversalKey)

  for (let index = 0; index < (await navLinks.count()); index += 1) {
    if (index > 0) {
      await page.keyboard.press(focusTraversalKey)
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

test("resume preview retains its PNG fallback when the source format is unsupported", async ({ page, baseURL }) => {
  const monitor = monitorPage(page, baseURL)
  await page.goto("/resume/", { waitUntil: "domcontentloaded" })
  const preview = page.getByRole("img", { name: "Preview of Waffy Ahmed's resume" })
  await expect(preview).toBeVisible()
  // Exercise picture format selection; a failed WebP request does not trigger
  // the browser's unsupported-format fallback behavior.
  await preview.evaluate((image) => {
    image.closest("picture").querySelector("source").type = "image/unsupported-test-format"
  })
  await expect.poll(() => preview.evaluate((image) => ({
    source: image.currentSrc ? new URL(image.currentSrc).pathname : "",
    // Browsers density-correct natural dimensions after picture reselection.
    loaded: image.complete && image.naturalWidth > 0 && image.naturalHeight > 0,
  }))).toEqual({ source: "/resume-preview.png", loaded: true })
  await expectNoHorizontalOverflow(page)
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
  const contactFields = page.locator(".mc-field")
  await expect(contactFields).toHaveCount(4)
  expect(
    await contactFields.evaluateAll((fields) =>
      fields.map((field) => {
        const canvas = globalThis.document.createElement("canvas")
        canvas.width = 1
        canvas.height = 1
        const context = canvas.getContext("2d")

        context.fillStyle = globalThis.getComputedStyle(
          field,
          "::placeholder"
        ).color
        context.fillRect(0, 0, 1, 1)

        return Array.from(context.getImageData(0, 0, 1, 1).data)
      })
    )
  ).toEqual(Array.from({ length: 4 }, () => [144, 161, 185, 255]))
  expect(externalRequests.formspree).toEqual([])
  monitor.assertClean()
})
