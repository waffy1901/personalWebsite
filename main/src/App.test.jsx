import React from "react"
import { cleanup, render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { MemoryRouter } from "react-router-dom"
import { readFileSync } from "node:fs"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import App from "./App.jsx"

vi.mock("@formspree/react", () => ({
  useForm: () => [
    {
      errors: [],
      submitting: false,
      succeeded: false,
    },
    vi.fn((event) => event?.preventDefault?.()),
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

const clickWithoutNavigation = async (user, element) => {
  element.addEventListener("click", (event) => event.preventDefault(), {
    once: true,
  })
  await user.click(element)
}

beforeEach(() => {
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
      screen.getByRole("heading", { name: /cdc data reconciliation/i })
    ).toBeInTheDocument()
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
      "https://waffy.netlify.app/case-studies/kubernetes-autoscaling"
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
    await clickWithoutNavigation(user, sourceCodeLink)
    await user.click(
      screen.getByRole("button", {
        name: /show details for cdc data reconciliation/i,
      })
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
      "@id": "https://waffy.netlify.app/#person",
    })
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
    expect(screen.getByLabelText(/email/i)).toBeRequired()
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
      "https://waffy.netlify.app/projects"
    )
  })

  it("renders a not found route", () => {
    renderRoute("/missing-page")

    expect(
      screen.getByRole("heading", { name: /page not found/i })
    ).toBeInTheDocument()
    expect(screen.getByRole("link", { name: /go home/i })).toHaveAttribute(
      "href",
      "/"
    )
  })

  it("reveals experience details with an accessible control", async () => {
    const user = userEvent.setup()
    renderRoute("/experience")

    expect(
      screen.queryByRole("region", { name: /experience details/i })
    ).not.toBeInTheDocument()

    await user.click(
      screen.getByRole("button", {
        name: /show details for software engineer at the home depot/i,
      })
    )

    expect(
      screen.getByRole("region", { name: /experience details/i })
    ).toBeInTheDocument()
    expect(
      screen.getByRole("button", { name: /copy software engineer details/i })
    ).toBeInTheDocument()
  })
})
