import React from "react"
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { MemoryRouter } from "react-router-dom"
import { execFileSync } from "node:child_process"
import { readFileSync } from "node:fs"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import App from "./App.jsx"
import { caseStudies } from "./data/caseStudies.js"
import { projects } from "./data/projects.js"
import { publicPortfolio } from "./data/publicPortfolio.js"
import { resume, socialLinks } from "./data/profile.js"
import { routeMetadata } from "./data/seo.js"

const formspreeSubmitMock = vi.hoisted(() =>
  vi.fn((event) => event?.preventDefault?.())
)
const formspreeMockState = vi.hoisted(() => ({
  current: {
    errors: null,
    submitting: false,
    succeeded: false,
  },
}))

vi.mock("@formspree/react", () => ({
  useForm: () => [
    formspreeMockState.current,
    formspreeSubmitMock,
  ],
  ValidationError: () => null,
}))

const renderRoute = (route) =>
  render(
    <MemoryRouter initialEntries={[route]}>
      <App />
    </MemoryRouter>
  )

const getAnalyticsCalls = () =>
  (window.dataLayer || []).map((call) => Array.from(call))

const getAnalyticsEvents = (eventName) =>
  getAnalyticsCalls().filter(
    ([command, trackedEventName]) =>
      command === "event" && trackedEventName === eventName
  )

const readJsonFile = (filePath) => JSON.parse(readFileSync(filePath, "utf8"))

const packageMajor = (packageJson, packageName) => {
  const rawVersion =
    packageJson.dependencies?.[packageName] ??
    packageJson.devDependencies?.[packageName] ??
    ""

  return rawVersion.match(/\d+/)?.[0]
}

const caseStudyMetricLabels = (caseStudy) =>
  caseStudy.metrics.map((metric) => `${metric.value} ${metric.label}`)

const clickWithoutNavigation = async (user, element) => {
  element.addEventListener("click", (event) => event.preventDefault(), {
    once: true,
  })
  await user.click(element)
}

beforeEach(() => {
  formspreeSubmitMock.mockClear()
  formspreeMockState.current = {
    errors: null,
    submitting: false,
    succeeded: false,
  }
  vi.stubEnv("VITE_FORMSPREE_KEY", "test-form-key")
  vi.stubGlobal(
    "ResizeObserver",
    class ResizeObserver {
      observe() {}
      disconnect() {}
    }
  )
})

afterEach(() => {
  cleanup()
  document.getElementById("google-analytics-script")?.remove()
  delete window.__portfolioGaInitialized
  delete window.dataLayer
  delete window.gtag
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
})

describe("App routes", () => {
  it("renders the home route", () => {
    renderRoute("/")

    expect(
      screen.getByRole("heading", { name: /waffy ahmed/i })
    ).toBeInTheDocument()
    expect(
      screen.getByRole("link", { name: /download resume/i })
    ).toHaveAttribute("href", "/waffyAhmedResume.pdf")
  })

  it("renders the projects route", () => {
    renderRoute("/projects")

    expect(
      screen.getByRole("heading", {
        name: /practical builds for real workflows/i,
      })
    ).toBeInTheDocument()
    expect(
      screen.getAllByRole("heading", { name: /cdc data reconciliation/i })
    ).not.toHaveLength(0)
  })

  it("renders the experience route", () => {
    renderRoute("/experience")

    expect(
      screen.getByRole("heading", { name: /work experience/i })
    ).toBeInTheDocument()
  })

  it("renders the case studies route", () => {
    renderRoute("/case-studies")

    expect(
      screen.getByRole("heading", { name: /selected engineering case studies/i })
    ).toBeInTheDocument()
    const [firstCaseStudyLink] = screen.getAllByRole("link", {
      name: /read case study/i,
    })
    expect(firstCaseStudyLink).toHaveAttribute(
      "href",
      "/case-studies/kubernetes-autoscaling"
    )
  })

  it("renders a case study detail route", () => {
    renderRoute("/case-studies/kubernetes-autoscaling")

    expect(
      screen.getByRole("heading", {
        name: /kubernetes autoscaling for transaction-critical services/i,
      })
    ).toBeInTheDocument()
    expect(
      screen.getByRole("heading", { name: /engineering path/i })
    ).toBeInTheDocument()
  })

  it("updates route-level SEO metadata", async () => {
    renderRoute("/case-studies/kubernetes-autoscaling")

    await waitFor(() =>
      expect(document.title).toBe(
        "Kubernetes Autoscaling for Transaction-Critical Services | Waffy Ahmed"
      )
    )
    expect(document.querySelector('link[rel="canonical"]')).toHaveAttribute(
      "href",
      "https://waffy.dev/case-studies/kubernetes-autoscaling"
    )
    expect(document.querySelector('meta[property="og:title"]')).toHaveAttribute(
      "content",
      "Kubernetes Autoscaling for Transaction-Critical Services | Waffy Ahmed"
    )
  })

  it("sends analytics page views when analytics is configured", async () => {
    vi.stubEnv("VITE_GA_MEASUREMENT_ID", "G-TEST123")
    renderRoute("/projects")

    await waitFor(() =>
      expect(document.getElementById("google-analytics-script")).toHaveAttribute(
        "src",
        "https://www.googletagmanager.com/gtag/js?id=G-TEST123"
      )
    )
    await waitFor(() =>
      expect(getAnalyticsCalls()).toEqual(
        expect.arrayContaining([
          ["config", "G-TEST123", { send_page_view: false }],
          [
            "event",
            "page_view",
            expect.objectContaining({
              page_path: "/projects",
              send_to: "G-TEST123",
            }),
          ],
        ])
      )
    )
  })

  it("tracks project source and details interactions", async () => {
    const user = userEvent.setup()
    vi.stubEnv("VITE_GA_MEASUREMENT_ID", "G-TEST123")
    renderRoute("/projects")

    await waitFor(() =>
      expect(document.getElementById("google-analytics-script")).toBeInTheDocument()
    )

    const [sourceCodeLink] = screen.getAllByRole("link", {
      name: /source code/i,
    })
    expect(screen.queryByText(/details available/i)).not.toBeInTheDocument()
    expect(
      screen.getAllByRole("button", { name: /view details/i })
    ).toHaveLength(3)

    await clickWithoutNavigation(user, sourceCodeLink)
    await user.click(
      screen.getByRole("button", {
        name: /view details for cdc data reconciliation/i,
      })
    )

    await waitFor(() =>
      expect(
        screen.getByRole("button", {
          name: /hide details for cdc data reconciliation/i,
        })
      ).toHaveFocus()
    )

    expect(getAnalyticsEvents("project_source_click")).toEqual([
      [
        "event",
        "project_source_click",
        expect.objectContaining({
          link_domain: "github.com",
          project_id: "cdc-data-reconciliation",
          send_to: "G-TEST123",
        }),
      ],
    ])
    expect(getAnalyticsEvents("project_details_open")).toEqual([
      [
        "event",
        "project_details_open",
        expect.objectContaining({
          project_id: "cdc-data-reconciliation",
          project_title: "CDC Data Reconciliation",
          send_to: "G-TEST123",
        }),
      ],
    ])

    await user.keyboard("{Escape}")

    await waitFor(() =>
      expect(
        screen.getByRole("button", {
          name: /view details for cdc data reconciliation/i,
        })
      ).toHaveFocus()
    )
  })

  it("tracks resume and social link interactions", async () => {
    const user = userEvent.setup()
    vi.stubEnv("VITE_GA_MEASUREMENT_ID", "G-TEST123")
    renderRoute("/")

    await waitFor(() =>
      expect(document.getElementById("google-analytics-script")).toBeInTheDocument()
    )

    await clickWithoutNavigation(
      user,
      screen.getByRole("link", { name: /download resume/i })
    )
    await clickWithoutNavigation(
      user,
      screen.getByRole("link", { name: /linkedin/i })
    )

    expect(getAnalyticsEvents("resume_download")).toEqual([
      [
        "event",
        "resume_download",
        expect.objectContaining({
          placement: "home_header",
          send_to: "G-TEST123",
        }),
      ],
    ])
    expect(getAnalyticsEvents("social_link_click")).toEqual([
      [
        "event",
        "social_link_click",
        expect.objectContaining({
          link_domain: "www.linkedin.com",
          placement: "home",
          social_platform: "linkedin",
          send_to: "G-TEST123",
        }),
      ],
    ])
  })

  it("tracks contact form submissions", async () => {
    const user = userEvent.setup()
    vi.stubEnv("VITE_GA_MEASUREMENT_ID", "G-TEST123")
    renderRoute("/contact")

    await waitFor(() =>
      expect(document.getElementById("google-analytics-script")).toBeInTheDocument()
    )

    await user.type(screen.getByLabelText(/first name/i), "Waffy")
    await user.type(screen.getByLabelText(/last name/i), "Ahmed")
    await user.type(screen.getByLabelText(/email/i), "waffy@example.com")
    await user.type(screen.getByLabelText(/message/i), "Hello from the test.")
    await user.click(screen.getByRole("button", { name: /send message/i }))

    expect(getAnalyticsEvents("contact_form_submit")).toEqual([
      [
        "event",
        "contact_form_submit",
        expect.objectContaining({
          placement: "contact_form",
          send_to: "G-TEST123",
        }),
      ],
    ])
    expect(formspreeSubmitMock).toHaveBeenCalledTimes(1)
  })

  it("blocks honeypot-filled contact form submissions", async () => {
    const user = userEvent.setup()
    vi.stubEnv("VITE_GA_MEASUREMENT_ID", "G-TEST123")
    renderRoute("/contact")

    await waitFor(() =>
      expect(document.getElementById("google-analytics-script")).toBeInTheDocument()
    )

    await user.type(screen.getByLabelText(/first name/i), "Waffy")
    await user.type(screen.getByLabelText(/last name/i), "Ahmed")
    await user.type(screen.getByLabelText(/email/i), "waffy@example.com")
    await user.type(
      screen.getByLabelText(/message/i),
      "Hello from a real visitor."
    )
    fireEvent.change(document.querySelector('input[name="_gotcha"]'), {
      target: { value: "Acme" },
    })
    await user.click(screen.getByRole("button", { name: /send message/i }))

    expect(formspreeSubmitMock).not.toHaveBeenCalled()
    expect(getAnalyticsEvents("contact_form_submit")).toEqual([])
  })

  it("announces and focuses successful contact submissions", async () => {
    formspreeMockState.current = {
      errors: null,
      submitting: false,
      succeeded: true,
    }
    renderRoute("/contact")

    const successStatus = screen.getByRole("status")

    expect(successStatus).toHaveAttribute("aria-live", "polite")
    expect(successStatus).toHaveAttribute("aria-atomic", "true")
    expect(successStatus).toHaveAttribute("tabindex", "-1")
    expect(successStatus).toHaveTextContent(/thank you for your message/i)
    await waitFor(() => expect(successStatus).toHaveFocus())
  })

  it("renders and focuses a general contact form submission error", async () => {
    formspreeMockState.current = {
      errors: {
        getFieldErrors: () => [],
        getFormErrors: () => [{ message: "Submission failed" }],
      },
      submitting: false,
      succeeded: false,
    }
    renderRoute("/contact")

    const submissionAlert = screen.getByRole("alert")

    expect(submissionAlert).toHaveTextContent(/message could not be sent/i)
    expect(submissionAlert).toHaveAttribute("tabindex", "-1")
    await waitFor(() => expect(submissionAlert).toHaveFocus())
  })

  it("publishes ProfilePage structured data with a main entity", () => {
    const indexHtml = readFileSync("index.html", "utf8")
    const indexDocument = new DOMParser().parseFromString(indexHtml, "text/html")
    const jsonLd = JSON.parse(
      indexDocument.querySelector("#portfolio-jsonld").textContent
    )
    const profilePage = jsonLd["@graph"].find(
      (item) => item["@type"] === "ProfilePage"
    )

    expect(profilePage.mainEntity).toEqual({
      "@id": "https://waffy.dev/#person",
    })
  })

  it("publishes structured portfolio JSON for AI-readable profile data", () => {
    const portfolioJson = readJsonFile("public/portfolio.json")

    expect(portfolioJson.person.name).toBe("Waffy Ahmed")
    expect(portfolioJson.links.resume).toBe(
      "https://waffy.dev/waffyAhmedResume.pdf"
    )
    expect(portfolioJson.analyticsEvents.keyEventCandidates).toEqual([
      "resume_download",
      "contact_form_success",
      "project_source_click",
      "case_study_link_click",
    ])
    expect(portfolioJson.caseStudies.map((caseStudy) => caseStudy.slug)).toEqual([
      "kubernetes-autoscaling",
      "legacy-deployment-recovery",
      "cdc-data-reconciliation",
    ])
  })

  it("keeps generated public artifacts current", () => {
    const output = execFileSync(
      "node",
      ["scripts/generate-public-artifacts.mjs", "--check"],
      {
        encoding: "utf8",
      }
    )

    expect(output).toContain("Generated public artifacts are current")
  })

  it("aligns generated public artifacts with canonical data", () => {
    const portfolioJson = readJsonFile("public/portfolio.json")
    const packageJson = readJsonFile("package.json")
    const sitemap = readFileSync("public/sitemap.xml", "utf8")
    const llms = readFileSync("public/llms.txt", "utf8")
    const aiSummary = readFileSync("public/ai-summary.txt", "utf8")
    const rootReadme = readFileSync("../README.md", "utf8")
    const appReadme = readFileSync("README.md", "utf8")
    const generatedDocs = `${rootReadme}\n${appReadme}`
    const socialById = Object.fromEntries(
      socialLinks.map((link) => [link.id, link.href])
    )
    const frameworkExpectations = [
      ["React", "react"],
      ["React Router", "react-router-dom"],
      ["Vite", "vite"],
      ["Tailwind CSS", "tailwindcss"],
      ["Vitest", "vitest"],
      ["ESLint", "eslint"],
    ]

    expect(portfolioJson.contentLastReviewed).toBe(
      publicPortfolio.contentLastReviewed
    )
    expect(portfolioJson.links.resume).toBe(
      `https://waffy.dev${resume.pdf}`
    )
    expect(portfolioJson.links.linkedin).toBe(socialById.linkedin)
    expect(portfolioJson.links.github).toBe(socialById.github)
    expect(portfolioJson.links.email).toBe(socialById.email)
    expect(portfolioJson.links.aiSummary).toBe("https://waffy.dev/ai-summary.txt")
    expect(portfolioJson.links.llms).toBe("https://waffy.dev/llms.txt")
    expect(portfolioJson.links.sitemap).toBe("https://waffy.dev/sitemap.xml")
    expect(portfolioJson.analyticsEvents).toEqual(
      publicPortfolio.analyticsEvents
    )
    expect(portfolioJson.caseStudies.map((caseStudy) => caseStudy.slug)).toEqual(
      caseStudies.map((caseStudy) => caseStudy.slug)
    )
    expect(portfolioJson.caseStudies.map((caseStudy) => caseStudy.metrics)).toEqual(
      caseStudies.map(caseStudyMetricLabels)
    )
    expect(portfolioJson.projects.map((project) => project.id)).toEqual(
      projects.map((project) => project.id)
    )
    expect(portfolioJson.projects.map((project) => project.summary)).toEqual(
      projects.map((project) => project.summary)
    )

    for (const caseStudy of caseStudies) {
      const caseStudyUrl = `https://waffy.dev/case-studies/${caseStudy.slug}`

      expect(sitemap).toContain(caseStudyUrl)
      expect(llms).toContain(caseStudyUrl)
      expect(aiSummary).toContain(caseStudyUrl)
    }

    for (const url of [
      portfolioJson.links.aiSummary,
      portfolioJson.links.llms,
      portfolioJson.links.sitemap,
      portfolioJson.links.resume,
    ]) {
      expect(llms).toContain(url)
    }

    for (const [label, packageName] of frameworkExpectations) {
      expect(generatedDocs).toContain(
        `${label} ${packageMajor(packageJson, packageName)}`
      )
    }
  })

  it("renders the resume route", () => {
    renderRoute("/resume")

    expect(screen.getByRole("link", { name: /open pdf/i })).toHaveAttribute(
      "href",
      "/waffyAhmedResume.pdf"
    )
    expect(
      screen.getByRole("img", { name: /preview of waffy ahmed's resume/i })
    ).toHaveAttribute("src", "/resume-preview.png")
    expect(
      screen.queryByText(/your browser cannot display this pdf inline/i)
    ).not.toBeInTheDocument()
  })

  it("renders the contact route", () => {
    renderRoute("/contact")

    expect(
      screen.getByRole("heading", { name: /let's connect/i })
    ).toBeInTheDocument()
    expect(
      screen.getByRole("heading", { name: /contact form/i })
    ).toBeInTheDocument()
    expect(
      screen.getByRole("link", { name: /^email$/i })
    ).toHaveAttribute("href", "mailto:waffyahmed@gmail.com")
    expect(screen.queryByText("waffyahmed@gmail.com")).not.toBeInTheDocument()
    expect(screen.queryByRole("button", { name: /copy email/i })).not.toBeInTheDocument()
    expect(screen.getByLabelText(/email/i)).toBeRequired()
    expect(screen.getByLabelText(/email/i)).toHaveAttribute("maxlength", "254")
    expect(screen.getByLabelText(/message/i)).toHaveAttribute("minlength", "10")
    expect(screen.getByLabelText(/message/i)).toHaveValue("")
  })

  it("redirects legacy uppercase routes to lowercase pages", async () => {
    renderRoute("/Projects")

    expect(
      await screen.findByRole("heading", {
        name: /practical builds for real workflows/i,
      })
    ).toBeInTheDocument()
    await waitFor(() =>
      expect(document.title).toBe("Projects | Waffy Ahmed")
    )
    expect(document.querySelector('link[rel="canonical"]')).toHaveAttribute(
      "href",
      "https://waffy.dev/projects"
    )
  })

  it("renders a not found route with non-indexable metadata", async () => {
    renderRoute("/missing-page")

    expect(
      screen.getByRole("heading", { name: /page not found/i })
    ).toBeInTheDocument()
    expect(screen.getByRole("link", { name: /go home/i })).toHaveAttribute(
      "href",
      "/"
    )
    await waitFor(() =>
      expect(document.title).toBe("Page Not Found | Waffy Ahmed")
    )
    expect(document.querySelector('meta[name="robots"]')).toHaveAttribute(
      "content",
      "noindex, nofollow"
    )
    expect(document.querySelector('link[rel="canonical"]')).toHaveAttribute(
      "href",
      "https://waffy.dev/"
    )
  })

  it("publishes Netlify redirects for app routes and a real 404", () => {
    const redirectLines = readFileSync("public/_redirects", "utf8")
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith("#"))

    expect(redirectLines).not.toContain("/* /index.html 200")
    routeMetadata
      .filter((route) => route.path !== "/")
      .forEach((route) => {
        expect(redirectLines).toContain(
          `${route.path} ${route.path}/index.html 200`
        )
      })
    expect(redirectLines).toContain("/Projects /projects 301")
    expect(redirectLines.at(-1)).toBe("/* /404.html 404")

    const notFoundHtml = readFileSync("public/404.html", "utf8")

    expect(notFoundHtml).toContain(
      '<meta name="robots" content="noindex, nofollow" />'
    )
    expect(notFoundHtml).toContain(
      '<link rel="canonical" href="https://waffy.dev/" />'
    )
  })

  it("reveals experience details with an accessible control", async () => {
    const user = userEvent.setup()
    const clipboardWriteMock = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: {
        writeText: clipboardWriteMock,
      },
    })
    renderRoute("/experience")

    expect(
      screen.queryByRole("region", { name: /experience details/i })
    ).not.toBeInTheDocument()

    const detailsButton = screen.getByRole("button", {
      name: /view details for software engineer at the home depot/i,
    })
    await user.click(detailsButton)

    const detailsRegion = screen.getByRole("region", {
      name: /experience details/i,
    })
    const backButton = screen.getByRole("button", {
      name: /hide details for software engineer at the home depot/i,
    })
    const copyButton = screen.getByRole("button", {
      name: /copy software engineer details/i,
    })

    expect(detailsRegion).toBeInTheDocument()
    await waitFor(() => expect(backButton).toHaveFocus())

    await user.click(copyButton)

    expect(clipboardWriteMock).toHaveBeenCalledWith(
      expect.stringContaining("Improved scalability")
    )
    expect(screen.getByRole("status")).toHaveTextContent(
      /software engineer details copied/i
    )

    await user.keyboard("{Escape}")

    await waitFor(() => expect(detailsButton).toHaveFocus())
    expect(
      screen.queryByRole("region", { name: /experience details/i })
    ).not.toBeInTheDocument()
  })
})
