import React from "react"
import {
  cleanup,
  fireEvent,
  render,
  screen,
  act,
  waitFor,
  within,
} from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { BrowserRouter, MemoryRouter } from "react-router"
import { execFileSync } from "node:child_process"
import { readFileSync } from "node:fs"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import App, { DelayedRoutePendingIndicator } from "./App.jsx"
import { caseStudies } from "./data/caseStudies.js"
import { projects } from "./data/projects.js"
import { publicPortfolio } from "./data/publicPortfolio.js"
import { resume, socialLinks } from "./data/profile.js"
import { currentEmployment } from "./data/siteIdentity.js"
import {
  defaultRouteMetadata,
  getRouteMetadata,
  routeMetadata,
  sitemapRoutes,
  toCanonicalRoutePath,
  toCanonicalRouteUrl,
} from "./data/seo.js"

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
const routePreloadMock = vi.hoisted(() => vi.fn(() => Promise.resolve()))

vi.mock("@formspree/react", () => ({
  useForm: () => [
    formspreeMockState.current,
    formspreeSubmitMock,
  ],
  ValidationError: () => null,
}))

vi.mock("./utils/routePrefetch.js", () => ({
  preloadRoute: routePreloadMock,
  createRouteIntentHandlers: (pathname) => ({
    onPointerEnter: () => routePreloadMock(pathname),
    onPointerDown: () => routePreloadMock(pathname),
    onFocus: () => routePreloadMock(pathname),
  }),
}))

const renderRoute = (route) =>
  render(
    <MemoryRouter initialEntries={[route]}>
      <App />
    </MemoryRouter>
  )

const renderBrowserRoute = (route) => {
  window.history.replaceState({}, "", route)

  return render(
    <BrowserRouter>
      <App />
    </BrowserRouter>
  )
}

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

const expectImagePolicy = (image, { loading, fetchPriority }) => {
  expect(image).toHaveAttribute("loading", loading)
  expect(image).toHaveAttribute("decoding", "async")

  if (fetchPriority) {
    expect(image).toHaveAttribute("fetchpriority", fetchPriority)
  }
}

const relativeLuminance = (hexColor) => {
  const normalized = hexColor.replace("#", "")
  const channels = [0, 2, 4].map((offset) => {
    const channel = Number.parseInt(normalized.slice(offset, offset + 2), 16) / 255

    return channel <= 0.04045
      ? channel / 12.92
      : ((channel + 0.055) / 1.055) ** 2.4
  })

  return (0.2126 * channels[0]) + (0.7152 * channels[1]) + (0.0722 * channels[2])
}

const contrastRatio = (foreground, background) => {
  const lighter = Math.max(
    relativeLuminance(foreground),
    relativeLuminance(background)
  )
  const darker = Math.min(
    relativeLuminance(foreground),
    relativeLuminance(background)
  )

  return (lighter + 0.05) / (darker + 0.05)
}

const expectNormalTextContrast = (foreground, background) => {
  expect(contrastRatio(foreground, background)).toBeGreaterThanOrEqual(4.5)
}

beforeEach(() => {
  formspreeSubmitMock.mockClear()
  routePreloadMock.mockClear()
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
  window.history.replaceState({}, "", "/")
})

describe("App routes", () => {
  it("renders the home route", async () => {
    renderRoute("/")

    expect(
      await screen.findByRole("heading", { name: /waffy ahmed/i })
    ).toBeInTheDocument()
    expect(
      screen.getByRole("link", { name: /download resume/i })
    ).toHaveAttribute("href", "/waffyAhmedResume.pdf")
    expect(
      screen.getByText(/^software engineer ii focused on kubernetes/i)
    ).toBeInTheDocument()
    const profileImage = screen.getByRole("img", { name: /waffy ahmed/i })
    const profileWebpSource = profileImage
      .closest("picture")
      ?.querySelector('source[type="image/webp"]')

    expectImagePolicy(profileImage, {
      loading: "eager",
      fetchPriority: "high",
    })
    expect(profileImage).toHaveAttribute("width", "675")
    expect(profileImage).toHaveAttribute("height", "900")
    expect(profileWebpSource).toHaveAttribute(
      "srcset",
      expect.stringMatching(
        /profilePic-450\.webp 450w, .*profilePic-675\.webp 675w/
      )
    )
    expect(profileWebpSource).toHaveAttribute(
      "sizes",
      "(min-width: 640px) 448px, calc(100vw - 5rem)"
    )
  })

  it("preloads lazy routes when primary navigation shows intent", async () => {
    renderRoute("/")

    await screen.findByRole("heading", { name: /waffy ahmed/i })
    const navigation = screen.getByRole("navigation", {
      name: /primary navigation/i,
    })
    const projectsLink = within(navigation).getByRole("link", {
      name: /projects/i,
    })

    expect(routePreloadMock).not.toHaveBeenCalled()

    fireEvent.pointerEnter(projectsLink)
    expect(routePreloadMock).toHaveBeenCalledWith("/projects/")

    routePreloadMock.mockClear()
    fireEvent.focus(projectsLink)
    expect(routePreloadMock).toHaveBeenCalledWith("/projects/")
  })

  it("preloads internal case-study links only after pointer, press, or focus intent", async () => {
    const caseStudiesRender = renderRoute("/case-studies")

    const [caseStudyLink] = await screen.findAllByRole("link", { name: /read case study/i })
    fireEvent.pointerEnter(caseStudyLink)
    expect(routePreloadMock).toHaveBeenLastCalledWith(
      "/case-studies/kubernetes-autoscaling/"
    )

    routePreloadMock.mockClear()
    caseStudiesRender.unmount()
    renderRoute("/case-studies/kubernetes-autoscaling")
    const backLink = (await screen.findAllByRole("link", { name: /^case studies$/i }))
      .find((link) => link.className.includes("mb-5"))
    const relatedLink = screen.getByRole("link", { name: /view related experience/i })

    expect(backLink).toBeDefined()
    fireEvent.pointerDown(backLink)
    fireEvent.focus(relatedLink)
    expect(routePreloadMock).toHaveBeenNthCalledWith(1, "/case-studies/")
    expect(routePreloadMock).toHaveBeenNthCalledWith(2, "/experience/")
  })

  it("announces a pending route only after the transition remains pending", async () => {
    vi.useFakeTimers()
    const { rerender } = render(<DelayedRoutePendingIndicator pending />)

    expect(screen.queryByRole("status")).not.toBeInTheDocument()
    await act(async () => {
      await vi.advanceTimersByTimeAsync(249)
    })
    expect(screen.queryByRole("status")).not.toBeInTheDocument()

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1)
    })
    expect(screen.getAllByRole("status")).toHaveLength(1)
    expect(screen.getByRole("status")).toHaveTextContent(/loading next page/i)

    rerender(<DelayedRoutePendingIndicator pending={false} />)
    expect(screen.queryByRole("status")).not.toBeInTheDocument()
    vi.useRealTimers()
  })

  it("uses accessible shared contrast treatments on the home route", async () => {
    renderRoute("/")

    await screen.findByRole("heading", { name: /waffy ahmed/i })

    expect(screen.getByText("Explore")).toHaveClass("mc-eyebrow")
    expect(
      screen.getByText("Featured case study", { selector: "span.inline-flex" })
    ).toHaveClass("text-[#FFB077]", "border-[#FFB077]/40")

    const stylesheet = readFileSync("src/index.css", "utf8")
    const eyebrowRule = stylesheet.match(/\.mc-eyebrow\s*\{[^}]+\}/)?.[0]

    expect(eyebrowRule).toContain("text-[#1D4ED8]")
    expectNormalTextContrast("#1D4ED8", "#E8EDF2")
    expectNormalTextContrast("#FFB077", "#10254A")
  })

  it("renders the projects route", async () => {
    renderRoute("/projects")

    expect(
      await screen.findByRole("heading", {
        name: /practical builds for real workflows/i,
      })
    ).toBeInTheDocument()
    expect(
      screen.getAllByRole("heading", { name: /cdc data reconciliation/i })
    ).not.toHaveLength(0)
    const projectLogo = document.querySelector(`img[src="${projects[0].logo}"]`)
    expectImagePolicy(projectLogo, {
      loading: "lazy",
    })
    expect(projectLogo.closest("picture")?.querySelector('source[type="image/webp"]')).toHaveAttribute(
      "srcset",
      projects[0].logoWebp
    )
  })

  it("renders the experience route", async () => {
    renderRoute("/experience")

    expect(
      await screen.findByRole("heading", { name: /work experience/i })
    ).toBeInTheDocument()
  })

  it("renders the case studies route", async () => {
    renderRoute("/case-studies")

    expect(
      await screen.findByRole("heading", { name: /selected engineering case studies/i })
    ).toBeInTheDocument()
    const [firstCaseStudyLink] = screen.getAllByRole("link", {
      name: /read case study/i,
    })
    expect(firstCaseStudyLink).toHaveAttribute(
      "href",
      "/case-studies/kubernetes-autoscaling/"
    )
  })

  it("renders a case study detail route", async () => {
    renderRoute("/case-studies/kubernetes-autoscaling")

    expect(
      await screen.findByRole("heading", {
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
      "https://waffy.dev/case-studies/kubernetes-autoscaling/"
    )
    expect(document.querySelector('meta[property="og:title"]')).toHaveAttribute(
      "content",
      "Kubernetes Autoscaling for Transaction-Critical Services | Waffy Ahmed"
    )
  })

  it("preserves route-level SEO metadata on trailing-slash direct loads", async () => {
    renderRoute("/projects/")

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
      "https://waffy.dev/projects/"
    )
    expect(document.querySelector('meta[name="robots"]')).toHaveAttribute(
      "content",
      "index, follow"
    )
  })

  it("keeps route lookup slashless while publishing one canonical trailing slash", () => {
    for (const route of routeMetadata) {
      expect(route.canonicalPath).toBe(toCanonicalRoutePath(route.path))
      expect(toCanonicalRoutePath(route.canonicalPath)).toBe(
        route.canonicalPath
      )

      if (route.path !== "/") {
        expect(getRouteMetadata(route.canonicalPath)).toBe(route)
      }
    }

    expect(getRouteMetadata("/missing-page/")).toBe(defaultRouteMetadata)
    expect(sitemapRoutes).toEqual(
      routeMetadata.map((route) => route.canonicalPath)
    )
    expect(toCanonicalRouteUrl("/projects///")).toBe(
      "https://waffy.dev/projects/"
    )
  })

  it("sends analytics page views when analytics is configured", async () => {
    vi.stubEnv("VITE_GA_MEASUREMENT_ID", "G-TEST123")
    renderRoute("/projects/")

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
              page_path: "/projects/",
              send_to: "G-TEST123",
            }),
          ],
        ])
      )
    )
  })

  it("sends exactly one page view for an in-app navigation", async () => {
    const user = userEvent.setup()
    vi.stubEnv("VITE_GA_MEASUREMENT_ID", "G-TEST123")
    renderBrowserRoute("/")

    await screen.findByRole("heading", { name: /waffy ahmed/i })
    await waitFor(() => expect(getAnalyticsEvents("page_view")).toHaveLength(1))
    const projectsLink = within(
      screen.getByRole("navigation", { name: /primary navigation/i })
    ).getByRole("link", { name: /projects/i })

    await user.click(projectsLink)
    await screen.findByRole("heading", {
      name: /practical builds for real workflows/i,
    })
    await waitFor(() => expect(getAnalyticsEvents("page_view")).toHaveLength(2))
    expect(getAnalyticsEvents("page_view").map(([, , params]) => params.page_path)).toEqual([
      "/",
      "/projects/",
    ])
  })

  it("excludes query strings and fragments from analytics page views", async () => {
    vi.stubEnv("VITE_GA_MEASUREMENT_ID", "G-TEST123")
    renderBrowserRoute(
      "/projects/?email=alice%40example.com&token=reset-secret#access_token=fragment-secret"
    )

    await waitFor(() => expect(getAnalyticsEvents("page_view")).toHaveLength(1))

    const [[, , pageViewParams]] = getAnalyticsEvents("page_view")

    expect(pageViewParams).toEqual(
      expect.objectContaining({
        page_location: "http://localhost:3000/projects/",
        page_path: "/projects/",
        send_to: "G-TEST123",
      })
    )
    expect(JSON.stringify(pageViewParams)).not.toMatch(
      /alice|reset-secret|fragment-secret/
    )
  })

  it("tracks project source and details interactions", async () => {
    const user = userEvent.setup()
    vi.stubEnv("VITE_GA_MEASUREMENT_ID", "G-TEST123")
    renderRoute("/projects")

    await screen.findByRole("heading", {
      name: /practical builds for real workflows/i,
    })
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

    const downloadResumeLink = await screen.findByRole("link", {
      name: /download resume/i,
    })
    await waitFor(() =>
      expect(document.getElementById("google-analytics-script")).toBeInTheDocument()
    )

    await clickWithoutNavigation(user, downloadResumeLink)
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

    const firstNameInput = await screen.findByLabelText(/first name/i)
    await waitFor(() =>
      expect(document.getElementById("google-analytics-script")).toBeInTheDocument()
    )

    await user.type(firstNameInput, "Waffy")
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

    const firstNameInput = await screen.findByLabelText(/first name/i)
    await waitFor(() =>
      expect(document.getElementById("google-analytics-script")).toBeInTheDocument()
    )

    await user.type(firstNameInput, "Waffy")
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

    await screen.findByText(/thank you for your message/i)
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

    const submissionAlert = await screen.findByRole("alert")

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
    const person = jsonLd["@graph"].find((item) => item["@type"] === "Person")

    expect(profilePage.mainEntity).toEqual({
      "@id": "https://waffy.dev/#person",
    })
    expect(person.jobTitle).toBe("Software Engineer II")
  })

  it("publishes structured portfolio JSON for AI-readable profile data", () => {
    const portfolioJson = readJsonFile("public/portfolio.json")

    expect(portfolioJson.person.name).toBe("Waffy Ahmed")
    expect(portfolioJson.schemaVersion).toBe("1.1")
    expect(portfolioJson.person.currentRole).toMatchObject({
      title: "Software Engineer II",
      organization: "The Home Depot",
      startDate: "2026-07",
    })
    expect(portfolioJson.person.roleHistory).toEqual([
      {
        title: "Software Engineer II",
        organization: "The Home Depot",
        startDate: "2026-07",
        endDate: null,
      },
      {
        title: "Software Engineer I",
        organization: "The Home Depot",
        startDate: "2025-01",
        endDate: "2026-07",
      },
    ])
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
      ["React Router", "react-router"],
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
    expect(portfolioJson.person.currentRole).toEqual(
      publicPortfolio.person.currentRole
    )
    expect(portfolioJson.person.roleHistory).toEqual(
      publicPortfolio.person.roleHistory
    )
    expect(llms).toContain(
      `${currentEmployment.currentTitle} at ${currentEmployment.organization}`
    )
    expect(aiSummary).toContain(
      `${currentEmployment.currentTitle} at ${currentEmployment.organization}`
    )
    expect(aiSummary).toContain(
      "Productionized daily order reconciliation"
    )
    expect(aiSummary).toContain(
      "Re-architected order reconciliation from Cloud SQL to Cloud Spanner"
    )
    expect(portfolioJson.skills).toContain("Cloud Spanner")
    expect(
      portfolioJson.technicalDomains.find(
        (domain) => domain.label === "Platform reliability"
      )?.items
    ).toEqual(
      expect.arrayContaining([
        "Kubernetes CronJobs",
        "Workload Identity",
        "Secret Manager / External Secrets",
      ])
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
      const caseStudyUrl = `https://waffy.dev/case-studies/${caseStudy.slug}/`

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

  it("renders the resume route", async () => {
    renderRoute("/resume")

    expect(await screen.findByRole("link", { name: /open pdf/i })).toHaveAttribute(
      "href",
      "/waffyAhmedResume.pdf"
    )
    const resumePreview = screen.getByRole("img", {
      name: /preview of waffy ahmed's resume/i,
    })
    const resumePreviewSource = resumePreview
      .closest("picture")
      ?.querySelector('source[type="image/webp"]')

    expect(resumePreview).toHaveAttribute("src", "/resume-preview.png")
    expect(resumePreviewSource).toHaveAttribute("srcset", "/resume-preview.webp")
    expect(resumePreview).toHaveAttribute("width", "960")
    expect(resumePreview).toHaveAttribute("height", "1244")
    expectImagePolicy(resumePreview, {
      loading: "eager",
      fetchPriority: "high",
    })
    expect(
      screen.queryByText(/your browser cannot display this pdf inline/i)
    ).not.toBeInTheDocument()
  })

  it("renders the contact route", async () => {
    renderRoute("/contact")

    expect(
      await screen.findByRole("heading", { name: /let's connect/i })
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

  it("uses accessible dark-surface, action, and navigation contrast treatments", async () => {
    renderRoute("/contact")

    await screen.findByRole("heading", { name: /let's connect/i })

    expect(screen.getByText("Open channel", { selector: "p" })).toHaveClass(
      "mc-eyebrow-dark"
    )
    expect(
      screen.getByText("Open channel", { selector: "span.inline-flex" })
    ).toHaveClass("text-[#86EFAC]", "border-[#86EFAC]/40")
    expect(screen.getByText("Platform reliability engineer")).toHaveClass(
      "text-slate-600"
    )
    expect(screen.getByText("WA")).toHaveClass("group-hover:text-[#0B1220]")

    const submitButton = screen.getByRole("button", { name: /send message/i })
    const stylesheet = readFileSync("src/index.css", "utf8")
    const darkEyebrowRule = stylesheet.match(
      /\.mc-eyebrow-dark\s*\{[^}]+\}/
    )?.[0]
    const primaryButtonRule = stylesheet.match(
      /\.mc-button-primary\s*\{[^}]+\}/
    )?.[0]

    expect(darkEyebrowRule).toContain("text-[#93B4FF]")
    expect(submitButton).toHaveClass("mc-button-primary")
    expect(submitButton).not.toHaveClass("disabled:opacity-60")
    expect(primaryButtonRule).toContain("text-[#0B1220]")
    expect(primaryButtonRule).toContain("hover:bg-[#FFB077]")
    expect(primaryButtonRule).toContain("disabled:bg-[#CBD5E1]")
    expect(primaryButtonRule).toContain("disabled:text-[#334155]")
    expect(primaryButtonRule).toContain("focus:ring-[#F96302]")
    expect(primaryButtonRule).toContain("focus:ring-offset-[#0B1220]")

    expectNormalTextContrast("#93B4FF", "#0B1220")
    expectNormalTextContrast("#86EFAC", "#0B1220")
    expectNormalTextContrast("#0B1220", "#F96302")
    expectNormalTextContrast("#0B1220", "#FFB077")
    expectNormalTextContrast("#334155", "#CBD5E1")
    expectNormalTextContrast("#475569", "#F4F1EA")
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
      "https://waffy.dev/projects/"
    )
  })

  it("renders a not found route with non-indexable metadata", async () => {
    renderRoute("/missing-page")

    expect(
      await screen.findByRole("heading", { name: /page not found/i })
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
    expect(redirectLines).toContain("/Projects /projects/ 301")
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

    await screen.findByRole("heading", { name: /work experience/i })
    expect(
      screen.queryByRole("region", { name: /experience details/i })
    ).not.toBeInTheDocument()

    expect(screen.getByText("July 2026 - Present")).toBeInTheDocument()
    expect(screen.getByText("January 2025 - July 2026")).toBeInTheDocument()

    const detailsButton = screen.getByRole("button", {
      name: /view details for software engineer ii at the home depot/i,
    })
    await user.click(detailsButton)

    const detailsRegion = screen.getByRole("region", {
      name: /experience details/i,
    })
    const backButton = screen.getByRole("button", {
      name: /hide details for software engineer ii at the home depot/i,
    })
    const copyButton = screen.getByRole("button", {
      name: /copy software engineer ii details/i,
    })

    expect(detailsRegion).toBeInTheDocument()
    expect(
      screen.getByText(/productionized daily order reconciliation/i)
    ).toBeInTheDocument()
    expect(
      screen.getByText(
        /re-architected order reconciliation from cloud sql to cloud spanner/i
      )
    ).toBeInTheDocument()
    expect(screen.getByText(/7 weekly runs via kubernetes cronjob/i)).toBeInTheDocument()
    expect(screen.getByText(/nodeport usage/i)).toBeInTheDocument()
    await waitFor(() => expect(backButton).toHaveFocus())

    await user.click(copyButton)

    expect(clipboardWriteMock).toHaveBeenCalledWith(
      expect.stringContaining("Productionized daily order reconciliation")
    )
    expect(screen.getByRole("status")).toHaveTextContent(
      /software engineer ii details copied/i
    )

    await user.keyboard("{Escape}")

    await waitFor(() => expect(detailsButton).toHaveFocus())
    expect(
      screen.queryByRole("region", { name: /experience details/i })
    ).not.toBeInTheDocument()
  })

  it("places Software Engineer I above Fintech and expands its full accomplishments", async () => {
    const user = userEvent.setup()
    renderRoute("/experience")

    await screen.findByRole("heading", { name: /work experience/i })
    const softwareEngineerOneHeading = screen.getByRole("heading", {
      name: "Software Engineer I",
    })
    const fintechHeading = screen.getByRole("heading", {
      name: "Frontend Engineer",
    })
    const softwareEngineerOneEntry = softwareEngineerOneHeading.closest("article")

    expect(
      softwareEngineerOneHeading.compareDocumentPosition(fintechHeading) &
        Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy()
    expect(within(softwareEngineerOneEntry).getAllByRole("listitem")).toHaveLength(5)

    const expandButton = within(softwareEngineerOneEntry).getByRole("button", {
      name: /view all accomplishments for software engineer i at the home depot/i,
    })
    expect(expandButton).toHaveAttribute("aria-expanded", "false")

    await user.click(expandButton)

    expect(within(softwareEngineerOneEntry).getAllByRole("listitem")).toHaveLength(12)
    expect(expandButton).toHaveAttribute("aria-expanded", "true")
    expect(expandButton).toHaveTextContent(/show fewer accomplishments/i)

    await user.click(expandButton)

    expect(within(softwareEngineerOneEntry).getAllByRole("listitem")).toHaveLength(5)
    expect(expandButton).toHaveAttribute("aria-expanded", "false")
  })
})
