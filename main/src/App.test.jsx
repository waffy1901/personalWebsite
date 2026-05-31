import React from "react"
import { cleanup, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { MemoryRouter } from "react-router-dom"
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

  it("renders the resume route", () => {
    renderRoute("/resume")

    expect(screen.getByRole("link", { name: /open pdf/i })).toHaveAttribute(
      "href",
      "/waffyAhmedResume.pdf"
    )
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
  })

  it("redirects legacy uppercase routes to lowercase pages", async () => {
    renderRoute("/Projects")

    expect(
      await screen.findByRole("heading", {
        name: /practical builds for real workflows/i,
      })
    ).toBeInTheDocument()
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
