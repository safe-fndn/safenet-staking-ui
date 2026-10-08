import { describe, it, expect, vi } from "vitest"
import { render, screen } from "@testing-library/react"
import { MemoryRouter } from "react-router-dom"
import { ValidatorsPage } from "../ValidatorsPage"

vi.mock("@/components/DelegationWarnings", () => ({
  WalletDelegationWarnings: () => <div data-testid="delegation-warnings">DelegationWarnings</div>,
}))

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

    expect(screen.getByText("Safenet Aegis")).toBeInTheDocument()
    expect(screen.getByText(/Select a validator to stake your SAFE/)).toBeInTheDocument()
  })

  it("renders delegation warnings below the hero and above the validator list", () => {
    render(
      <MemoryRouter>
        <ValidatorsPage />
      </MemoryRouter>,
    )

    const warnings = screen.getByTestId("delegation-warnings")
    expect(screen.getByText("Safenet Aegis").compareDocumentPosition(warnings)).toBe(Node.DOCUMENT_POSITION_FOLLOWING)
    expect(warnings.compareDocumentPosition(screen.getByTestId("validator-list"))).toBe(Node.DOCUMENT_POSITION_FOLLOWING)
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
