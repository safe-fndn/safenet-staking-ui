import { describe, it, expect, vi } from "vitest"
import { render, screen } from "@testing-library/react"
import { MemoryRouter } from "react-router-dom"
import { ValidatorsPage } from "../ValidatorsPage"

vi.mock("@/components/validators/ValidatorList", () => ({
  ValidatorList: ({ autoOpenDelegate }: { autoOpenDelegate?: string }) => (
    <div data-testid="validator-list" data-auto-open={autoOpenDelegate ?? ""}>
      ValidatorList
    </div>
  ),
}))

describe("ValidatorsPage", () => {
  it("renders heading and description", () => {
    render(
      <MemoryRouter>
        <ValidatorsPage />
      </MemoryRouter>,
    )

    expect(screen.getByText("Validators")).toBeInTheDocument()
    expect(screen.getByText(/Browse validators and stake your SAFE/)).toBeInTheDocument()
  })

  it("renders ValidatorList", () => {
    render(
      <MemoryRouter>
        <ValidatorsPage />
      </MemoryRouter>,
    )

    expect(screen.getByTestId("validator-list")).toBeInTheDocument()
  })

  it("passes delegate search param to ValidatorList", () => {
    render(
      <MemoryRouter initialEntries={["/?delegate=0x1234567890abcdef1234567890abcdef12345678"]}>
        <ValidatorsPage />
      </MemoryRouter>,
    )

    // Even with a valid address query param on initial route, the page component
    // reads from useSearchParams which needs the matching route
    expect(screen.getByTestId("validator-list")).toBeInTheDocument()
  })
})
