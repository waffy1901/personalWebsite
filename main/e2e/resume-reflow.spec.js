const { test, expect } = require("./support/telemetry-safe-test")

const profiles = [
  { width: 320, enlargement: "root-font" },
  { width: 390, enlargement: "root-font" },
  { width: 320, enlargement: "text-only" },
  { width: 390, enlargement: "text-only" },
  { width: 390, enlargement: "none" },
  { width: 1440, enlargement: "none" },
]

// Inspect the actual painted text before focus can scroll an overflow ancestor.
// Document scrollWidth alone misses text clipped by the page's overflow:hidden.
async function inspectTextBounds(article) {
  return article.evaluate((documentArticle) => {
    const tolerance = 1
    const failures = []
    const articleBounds = documentArticle.getBoundingClientRect()
    const walker = globalThis.document.createTreeWalker(documentArticle, globalThis.NodeFilter.SHOW_TEXT)
    let checkedTextNodes = 0
    let node

    while ((node = walker.nextNode())) {
      const parent = node.parentElement
      if (!node.textContent.trim() || parent.closest(".sr-only")) continue
      const range = globalThis.document.createRange()
      range.selectNodeContents(node)
      const rectangles = [...range.getClientRects()].filter((rect) => rect.width && rect.height)
      if (!rectangles.length) continue
      checkedTextNodes += 1

      for (const rect of rectangles) {
        const report = (boundary) => failures.push({
          text: node.textContent.trim(),
          boundary,
          left: rect.left,
          right: rect.right,
        })
        if (rect.left < articleBounds.left - tolerance || rect.right > articleBounds.right + tolerance) {
          report("article content")
        }

        let checkedContentBox = false
        for (let ancestor = parent; ancestor; ancestor = ancestor.parentElement) {
          const style = globalThis.getComputedStyle(ancestor)
          const bounds = ancestor.getBoundingClientRect()
          const left = bounds.left + ancestor.clientLeft
          const top = bounds.top + ancestor.clientTop
          const right = left + ancestor.clientWidth
          const bottom = top + ancestor.clientHeight

          // The nearest block's content box catches overflow into local padding,
          // including education cards and indented experience/project lists.
          if (!checkedContentBox && style.display !== "inline" && style.display !== "contents") {
            checkedContentBox = true
            if (rect.left < left + parseFloat(style.paddingLeft) - tolerance ||
                rect.right > right - parseFloat(style.paddingRight) + tolerance) {
              report(`${ancestor.tagName.toLowerCase()} content`)
            }
          }

          if (/hidden|clip|scroll|auto/.test(style.overflowX) &&
              (rect.left < left - tolerance || rect.right > right + tolerance)) {
            report(`${ancestor.tagName.toLowerCase()} overflow-x:${style.overflowX}`)
          }
          if (/hidden|clip/.test(style.overflowY) &&
              (rect.top < top - tolerance || rect.bottom > bottom + tolerance)) {
            report(`${ancestor.tagName.toLowerCase()} overflow-y:${style.overflowY}`)
          }
        }
      }
    }
    return { checkedTextNodes, failures }
  })
}

for (const profile of profiles) {
  test(`HTML resume reflows at ${profile.width}px with ${profile.enlargement} enlargement`, async ({
    page, baseURL, browserName, externalRequests,
  }, testInfo) => {
    // These simulations are deliberately local-only; neither is native browser zoom.
    expect(baseURL).toBe("http://127.0.0.1:4173")
    test.skip(testInfo.project.name.startsWith("mobile-"), "Explicit widths run once per engine")
    await page.setViewportSize({ width: profile.width, height: 1000 })
    await page.goto("/resume/", { waitUntil: "networkidle" })
    const article = page.getByRole("article", { name: "Waffy Ahmed" })
    await expect(article).toBeVisible()
    await page.evaluate(async () => { await globalThis.document.fonts.ready })

    if (profile.enlargement === "root-font") {
      await page.evaluate(() => { globalThis.document.documentElement.style.fontSize = "200%" })
    } else if (profile.enlargement === "text-only") {
      await article.evaluate((element) => {
        const sizes = [element, ...element.querySelectorAll("*")].map((item) => {
          const style = globalThis.getComputedStyle(item)
          return { item, font: parseFloat(style.fontSize), line: parseFloat(style.lineHeight) }
        })
        for (const { item, font, line } of sizes) {
          item.style.fontSize = `${font * 2}px`
          if (Number.isFinite(line)) item.style.lineHeight = `${line * 2}px`
        }
      })
    }

    expect(await page.evaluate(() => globalThis.document.activeElement === globalThis.document.body)).toBe(true)
    const geometry = await inspectTextBounds(article)
    expect(geometry.checkedTextNodes).toBeGreaterThan(50)
    // Screenshot the initial unfocused layout even when the geometry assertion fails.
    await page.screenshot({ path: testInfo.outputPath("resume-before-focus.png"), fullPage: true })
    await testInfo.attach("pre-focus-text-geometry", {
      body: JSON.stringify(geometry, null, 2), contentType: "application/json",
    })
    expect(geometry.failures.length, JSON.stringify(geometry.failures.slice(0, 12), null, 2)).toBe(0)
    expect(await page.evaluate(() => globalThis.document.documentElement.scrollWidth <= globalThis.innerWidth)).toBe(true)

    const contacts = article.getByRole("list", { name: "Contact information" }).getByRole("link")
    expect(await contacts.allTextContents()).toEqual([
      "Phone: 404-740-7870", "Email: waffyahmed@gmail.com",
      "LinkedIn: linkedin.com/in/wa24", "Portfolio: waffy.dev",
    ])
    expect(await contacts.evaluateAll((links) => links.map((link) => link.getAttribute("href")))).toEqual([
      "tel:+14047407870", "mailto:waffyahmed@gmail.com",
      "https://www.linkedin.com/in/wa24/", "https://waffy.dev/",
    ])
    // Selection preserves copyable text, including wrapped contact strings.
    expect(await contacts.nth(1).evaluate((link) => {
      const range = globalThis.document.createRange()
      range.selectNodeContents(link)
      const selection = globalThis.window.getSelection()
      selection.removeAllRanges()
      selection.addRange(range)
      const text = selection.toString()
      selection.removeAllRanges()
      return text
    })).toContain("waffyahmed@gmail.com")
    await contacts.first().focus()
    await page.keyboard.press(browserName === "webkit" && process.platform === "darwin" ? "Alt+Tab" : "Tab")
    await expect(contacts.nth(1)).toBeFocused()
    expect(await contacts.nth(1).evaluate((link) => globalThis.getComputedStyle(link).boxShadow)).not.toBe("none")
    expect(externalRequests.analytics).toEqual([])
    expect(externalRequests.formspree).toEqual([])
  })
}
