import { describe, it, expect } from "vitest"
import { render, screen } from "@testing-library/react"
import { Footer } from "../layout/Footer"

describe("Footer", () => {
  it("renders documentation link", () => {
    render(<Footer />)

    expect(screen.getByText("Documentation")).toBeInTheDocument()
  })
})
