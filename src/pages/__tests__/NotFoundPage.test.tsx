import { describe, it, expect } from "vitest"
import { render, screen } from "@testing-library/react"
import { MemoryRouter } from "react-router-dom"
import { NotFoundPage } from "../NotFoundPage"

describe("NotFoundPage", () => {
  it("renders 404 heading and link to dashboard", () => {
    render(
      <MemoryRouter>
        <NotFoundPage />
      </MemoryRouter>,
    )

    expect(screen.getByText("404")).toBeInTheDocument()
    expect(screen.getByText("Page not found")).toBeInTheDocument()
    expect(screen.getByText("Back to Dashboard")).toBeInTheDocument()
  })
})
