import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen } from "@testing-library/react"
import { MemoryRouter } from "react-router-dom"
import { ValidatorCard } from "../validators/ValidatorCard"
import { TEST_ACCOUNTS, MOCK_VALIDATORS } from "@/__tests__/test-data"

const mockUseAccount = vi.fn()

vi.mock("wagmi", () => ({
  useAccount: () => mockUseAccount(),
}))

vi.mock("@/hooks/useStakingReads", () => ({
  useUserStakeOnValidator: vi.fn(() => ({ data: 100n * 10n ** 18n, isLoading: false })),
}))

vi.mock("@/hooks/useValidators", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/hooks/useValidators")>()
  return { ...actual }
})

vi.mock("@/hooks/useToast", () => ({
  useToast: vi.fn(() => ({ toast: vi.fn() })),
}))

// Mock DelegateDialog and UndelegateDialog to prevent deep hook chain
vi.mock("@/components/staking/DelegateDialog", () => ({
  DelegateDialog: () => null,
}))

vi.mock("@/components/staking/UndelegateDialog", () => ({
  UndelegateDialog: () => null,
}))

describe("ValidatorCard", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockUseAccount.mockReturnValue({ isConnected: true })
  })

  function renderCard(props = {}) {
    return render(
      <MemoryRouter>
        <ValidatorCard
          validator={TEST_ACCOUNTS.validator1}
          isActive={true}
          totalStake={5000n * 10n ** 18n}
          validators={[...MOCK_VALIDATORS]}
          {...props}
        />
      </MemoryRouter>,
    )
  }

  it("renders validator label and metadata", () => {
    renderCard()

    expect(screen.getByText("Gnosis")).toBeInTheDocument()
    expect(screen.getByText("Commission: 5%")).toBeInTheDocument()
    expect(screen.getByText("Participation (14d): 99.9%")).toBeInTheDocument()
  })

  it("shows Active badge for active validator", () => {
    renderCard()

    expect(screen.getByText("Active")).toBeInTheDocument()
  })

  it("shows Inactive badge and warning for inactive validator", () => {
    renderCard({ isActive: false })

    expect(screen.getByText("Inactive")).toBeInTheDocument()
    expect(screen.getByText("Validator is inactive")).toBeInTheDocument()
  })

  it("shows Stake and Unstake buttons when connected", () => {
    renderCard()

    expect(screen.getByRole("button", { name: "Stake" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Unstake" })).toBeInTheDocument()
  })

  it("hides action buttons when disconnected", () => {
    mockUseAccount.mockReturnValue({ isConnected: false })
    renderCard()

    expect(screen.queryByRole("button", { name: "Stake" })).not.toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Unstake" })).not.toBeInTheDocument()
  })

  it("disables Stake button for inactive validator", () => {
    renderCard({ isActive: false })

    expect(screen.getByRole("button", { name: "Stake" })).toBeDisabled()
  })

  it("shows total and user stake amounts", () => {
    renderCard()

    expect(screen.getByText("Total SAFE Staked")).toBeInTheDocument()
    expect(screen.getByText("Your SAFE Staked")).toBeInTheDocument()
  })
})
