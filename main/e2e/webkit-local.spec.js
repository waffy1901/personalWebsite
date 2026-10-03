const {
  expect,
  test,
} = require("./support/telemetry-safe-test")

const localPreviewBaseURL = "http://127.0.0.1:4173"

const expectLocalPreview = (baseURL) => {
  expect(baseURL).toBe(localPreviewBaseURL)
}

async function fillValidContactForm(page) {
  await page.getByLabel("First Name").fill("Synthetic")
  await page.getByLabel("Last Name").fill("Visitor")
  await page.getByLabel("Email", { exact: true }).fill("synthetic@example.test")
  await page
    .getByLabel("Message")
    .fill("Synthetic browser validation message with no real recipient.")
}

test("native contact validation blocks provider requests", async ({
  page,
  baseURL,
  externalRequests,
}) => {
  expectLocalPreview(baseURL)
  await page.goto("/contact/", { waitUntil: "domcontentloaded" })
  await page.getByLabel("First Name").fill("Synthetic")
  await page.getByLabel("Last Name").fill("Visitor")
  const email = page.getByLabel("Email", { exact: true })
  const message = page.getByLabel("Message")

  await email.fill("invalid-address")
  await message.fill("short")
  await page.getByRole("button", { name: "Send Message" }).click()

  await expect(email).toBeFocused()
  expect(
    await email.evaluate((field) => ({
      valid: field.validity.valid,
      typeMismatch: field.validity.typeMismatch,
      validationMessage: field.validationMessage,
    }))
  ).toEqual({
    valid: false,
    typeMismatch: true,
    validationMessage: expect.stringMatching(/.+/),
  })
  expect(await message.evaluate((field) => field.validity.tooShort)).toBe(true)
  expect(externalRequests.formspree).toEqual([])
})

test("mocked provider errors remain actionable without a real submission", async ({
  page,
  baseURL,
  externalRequests,
}) => {
  expectLocalPreview(baseURL)
  const mockedRequests = []

  await page.route("https://formspree.io/f/**", async (route) => {
    mockedRequests.push({
      method: route.request().method(),
      url: route.request().url(),
      body: route.request().postData() || "",
    })
    await route.fulfill({
      status: 422,
      contentType: "application/json",
      body: JSON.stringify({
        errors: [
          { message: "Synthetic provider outage." },
          {
            field: "email",
            code: "TYPE_EMAIL",
            message: "Use a synthetic valid email address.",
          },
        ],
      }),
    })
  })

  await page.goto("/contact/", { waitUntil: "domcontentloaded" })
  await fillValidContactForm(page)
  await page.getByRole("button", { name: "Send Message" }).click()

  const alert = page.getByRole("alert")
  await expect(alert).toBeVisible()
  await expect(alert).toBeFocused()
  await expect(alert).toContainText(
    "Please correct the highlighted fields, try again, or email me directly."
  )
  const email = page.getByLabel("Email", { exact: true })
  await expect(email).toHaveAttribute("aria-invalid", "true")
  await expect(page.locator("#email-error")).toContainText(
    "Use a synthetic valid email address."
  )
  await expect(
    page.getByRole("link", { name: "Open an email draft" })
  ).toHaveAttribute("href", "mailto:waffyahmed@gmail.com")

  expect(mockedRequests).toHaveLength(1)
  expect(mockedRequests[0]).toEqual(
    expect.objectContaining({
      method: "POST",
      url: "https://formspree.io/f/synthetic-webkit-smoke-key",
      body: expect.stringContaining("synthetic@example.test"),
    })
  )
  expect(externalRequests.formspree).toEqual([])
})

test("resume download stays on the local preview artifact", async ({
  page,
  baseURL,
  externalRequests,
}) => {
  expectLocalPreview(baseURL)
  await page.goto("/resume/", { waitUntil: "domcontentloaded" })
  const downloadLink = page.getByRole("link", { name: "Download Resume" })

  await expect(downloadLink).toHaveAttribute("href", "/waffyAhmedResume.pdf")
  await expect(downloadLink).toHaveAttribute("download", "")
  const [download] = await Promise.all([
    page.waitForEvent("download"),
    downloadLink.click(),
  ])

  expect(download.url()).toBe(
    `${localPreviewBaseURL}/waffyAhmedResume.pdf`
  )
  expect(download.suggestedFilename()).toBe("waffyAhmedResume.pdf")
  expect(await download.failure()).toBeNull()

  const downloadStream = await download.createReadStream()
  const firstChunk = await new Promise((resolve, reject) => {
    downloadStream.once("data", resolve)
    downloadStream.once("error", reject)
  })
  expect(firstChunk.subarray(0, 4).toString()).toBe("%PDF")
  expect(externalRequests.analytics).toEqual([])
  expect(externalRequests.formspree).toEqual([])
})
