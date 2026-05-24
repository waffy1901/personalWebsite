import React from "react"
import { cleanup, render, screen } from "@testing-library/react"
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
    renderRoute("/Projects")

    expect(
      screen.getByRole("heading", { name: /cdc data reconciliation/i })
    ).toBeInTheDocument()
  })

  it("renders the experience route", () => {
    renderRoute("/Experience")

    expect(
      screen.getByRole("heading", { name: /work experience/i })
    ).toBeInTheDocument()
  })

  it("renders the resume route", () => {
    renderRoute("/Resume")

    expect(screen.getByRole("link", { name: /open pdf/i })).toHaveAttribute(
      "href",
      "/waffyAhmedResume.pdf"
    )
  })

  it("renders the contact route", () => {
    renderRoute("/Contact")

    expect(
      screen.getByRole("heading", { name: /contact form/i })
    ).toBeInTheDocument()
    expect(screen.getByLabelText(/email/i)).toBeRequired()
  })
})
