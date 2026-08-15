import React from "react"
import { cleanup, render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { MemoryRouter } from "react-router"
import { afterEach, expect, it, vi } from "vitest"

vi.mock("./pages/Projects.jsx", () => {
  throw new Error("simulated route chunk failure")
})

import App from "./App.jsx"

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

it("preserves the shell and recovers from a rejected lazy route", async () => {
  const user = userEvent.setup()

  vi.spyOn(console, "error").mockImplementation(() => {})

  render(
    <MemoryRouter initialEntries={["/projects"]}>
      <App />
    </MemoryRouter>
  )

  expect(
    screen.getByRole("navigation", { name: /primary navigation/i })
  ).toBeInTheDocument()

  const alert = await screen.findByRole("alert")
  const retryLink = within(alert).getByRole("link", {
    name: /try this page again/i,
  })
  const homeLink = within(alert).getByRole("link", { name: /return home/i })

  expect(within(alert).getByRole("heading", {
    name: /this page didn’t load/i,
  })).toBeInTheDocument()
  expect(retryLink).toHaveAttribute("href", "/projects")
  expect(homeLink).toHaveAttribute("href", "/")
  await waitFor(() => expect(alert).toHaveFocus())

  await user.click(homeLink)

  expect(
    await screen.findByRole("heading", { name: /waffy ahmed/i })
  ).toBeInTheDocument()
  expect(screen.queryByRole("alert")).not.toBeInTheDocument()
})
