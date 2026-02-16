import { describe, it, expect, vi } from "vitest"
import { render, screen } from "@testing-library/react"
import { MemoryRouter } from "react-router-dom"
import { Layout } from "../layout/Layout"

vi.mock("../layout/Header", () => ({
  Header: () => <div data-testid="header">Header</div>,
}))

vi.mock("../layout/Footer", () => ({
  Footer: () => <div data-testid="footer">Footer</div>,
}))

describe("Layout", () => {
  it("renders header, main content area, and footer", () => {
    render(
      <MemoryRouter>
        <Layout />
      </MemoryRouter>,
    )

    expect(screen.getByTestId("header")).toBeInTheDocument()
    expect(screen.getByTestId("footer")).toBeInTheDocument()
    expect(screen.getByText("Skip to main content")).toBeInTheDocument()
  })
})
