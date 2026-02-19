import { describe, it, expect } from "vitest"
import { render, screen } from "@testing-library/react"
import { MemoryRouter } from "react-router-dom"
import { Footer } from "../layout/Footer"

describe("Footer", () => {
  it("renders footer links", () => {
    render(<MemoryRouter><Footer /></MemoryRouter>)

    expect(screen.getByText("Terms of Use")).toBeInTheDocument()
    expect(screen.getByText("Documentation")).toBeInTheDocument()
    expect(screen.getByText("FAQ")).toBeInTheDocument()
  })
})
