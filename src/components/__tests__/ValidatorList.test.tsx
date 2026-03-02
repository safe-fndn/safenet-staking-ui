import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen } from "@testing-library/react"
import { MemoryRouter } from "react-router-dom"
import { ValidatorList } from "../validators/ValidatorList"
import { TEST_ACCOUNTS, MOCK_VALIDATORS } from "@/__tests__/test-data"

const mockUseValidators = vi.fn()

vi.mock("@/hooks/useValidators", () => ({
  useValidators: () => mockUseValidators(),
}))

vi.mock("@/hooks/useStakingReads", () => ({
  useValidatorTotalStakes: vi.fn(() => ({
    data: undefined,
    isLoading: false,
  })),
  useUserStakesOnValidators: vi.fn(() => ({
    data: undefined,
    isLoading: false,
  })),
}))

vi.mock("@/components/validators/ValidatorCard", () => ({
  ValidatorCard: ({ validator, isActive }: { validator: string; isActive: boolean }) => (
    <div data-testid={`validator-card-${validator}`} data-active={isActive}>
      ValidatorCard
    </div>
  ),
}))

describe("ValidatorList", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("shows loading skeletons when loading", () => {
    mockUseValidators.mockReturnValue({
      data: undefined,
      isLoading: true,
      error: null,
      refetch: vi.fn(),
    })

    const { container } = render(
      <MemoryRouter>
        <ValidatorList />
      </MemoryRouter>,
    )

    const skeletons = container.querySelectorAll('[class*="animate-pulse"]')
    expect(skeletons.length).toBeGreaterThan(0)
  })

  it("shows error message on error", () => {
    mockUseValidators.mockReturnValue({
      data: undefined,
      isLoading: false,
      error: new Error("RPC failed"),
      refetch: vi.fn(),
    })

    render(
      <MemoryRouter>
        <ValidatorList />
      </MemoryRouter>,
    )

    expect(screen.getByText(/Failed to load validators/)).toBeInTheDocument()
  })

  it("shows empty state when no validators", () => {
    mockUseValidators.mockReturnValue({
      data: [],
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    })

    render(
      <MemoryRouter>
        <ValidatorList />
      </MemoryRouter>,
    )

    expect(screen.getByText(/No validators are currently available/)).toBeInTheDocument()
  })

  it("renders validator cards when data loaded", () => {
    mockUseValidators.mockReturnValue({
      data: [...MOCK_VALIDATORS],
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    })

    render(
      <MemoryRouter>
        <ValidatorList />
      </MemoryRouter>,
    )

    expect(screen.getByTestId(`validator-card-${TEST_ACCOUNTS.validator1}`)).toBeInTheDocument()
    expect(screen.getByTestId(`validator-card-${TEST_ACCOUNTS.validator2}`)).toBeInTheDocument()
  })

  it("shows search controls", () => {
    mockUseValidators.mockReturnValue({
      data: [MOCK_VALIDATORS[0]],
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    })

    render(
      <MemoryRouter>
        <ValidatorList />
      </MemoryRouter>,
    )

    expect(screen.getByPlaceholderText("Search by name or address…")).toBeInTheDocument()
  })
})
