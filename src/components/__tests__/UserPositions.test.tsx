import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen } from "@testing-library/react"
import { MemoryRouter } from "react-router-dom"
import { UserPositions } from "../dashboard/UserPositions"
import { TEST_ACCOUNTS } from "@/__tests__/test-data"

const mockUseAccount = vi.fn()

vi.mock("wagmi", () => ({
  useAccount: () => mockUseAccount(),
}))

vi.mock("@/hooks/useValidators", () => ({
  useValidators: vi.fn(() => ({
    data: [
      { address: TEST_ACCOUNTS.validator1, isActive: true },
      { address: TEST_ACCOUNTS.validator2, isActive: true },
    ],
  })),
}))

vi.mock("@/hooks/useStakingReads", () => ({
  useUserStakesOnValidators: vi.fn(() => ({
    data: [
      { status: "success", result: 200n * 10n ** 18n },
      { status: "success", result: 0n },
    ],
    isLoading: false,
  })),
}))

vi.mock("@/hooks/useValidatorMetadata", () => ({
  useValidatorMetadata: () => ({ label: "Gnosis", commission: 5, uptime: 99.9 }),
}))

vi.mock("@/components/staking/UndelegateDialog", () => ({
  UndelegateDialog: () => null,
}))

describe("UserPositions", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("shows connect message when disconnected", () => {
    mockUseAccount.mockReturnValue({ isConnected: false })

    render(
      <MemoryRouter>
        <UserPositions />
      </MemoryRouter>,
    )

    expect(screen.getByText("Connect your wallet to view your delegations.")).toBeInTheDocument()
  })

  it("shows delegations table when connected with positions", () => {
    mockUseAccount.mockReturnValue({ isConnected: true })

    render(
      <MemoryRouter>
        <UserPositions />
      </MemoryRouter>,
    )

    expect(screen.getByText("My Delegations")).toBeInTheDocument()
    expect(screen.getByText("Gnosis")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Undelegate" })).toBeInTheDocument()
  })

  it("shows empty state when no positions", async () => {
    mockUseAccount.mockReturnValue({ isConnected: true })

    const mod = await import("@/hooks/useStakingReads")
    vi.mocked(mod.useUserStakesOnValidators).mockReturnValue({
      data: [
        { status: "success", result: 0n },
        { status: "success", result: 0n },
      ],
      isLoading: false,
    } as ReturnType<typeof mod.useUserStakesOnValidators>)

    render(
      <MemoryRouter>
        <UserPositions />
      </MemoryRouter>,
    )

    expect(screen.getByText(/You have no active delegations/)).toBeInTheDocument()

    // Restore
    vi.mocked(mod.useUserStakesOnValidators).mockReturnValue({
      data: [
        { status: "success", result: 200n * 10n ** 18n },
        { status: "success", result: 0n },
      ],
      isLoading: false,
    } as ReturnType<typeof mod.useUserStakesOnValidators>)
  })
})
