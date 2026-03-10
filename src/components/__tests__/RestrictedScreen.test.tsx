import { describe, it, expect, vi } from "vitest"
import { render, screen } from "@testing-library/react"
import { RestrictedScreen } from "../RestrictedScreen"

vi.mock("@/components/layout/Footer", () => ({
  Footer: () => <div data-testid="footer">Footer</div>,
}))

describe("RestrictedScreen", () => {
  it("renders title and description", () => {
    render(<RestrictedScreen title="Access Restricted" description="Your region is blocked" />)

    expect(screen.getByText("Access Restricted")).toBeInTheDocument()
    expect(screen.getByText("Your region is blocked")).toBeInTheDocument()
  })

  it("renders footer", () => {
    render(<RestrictedScreen title="Blocked" description="Desc" />)

    expect(screen.getByTestId("footer")).toBeInTheDocument()
  })
})
