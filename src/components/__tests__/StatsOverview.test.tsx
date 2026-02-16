import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen } from "@testing-library/react"
import { StatsOverview } from "../dashboard/StatsOverview"

const mockUseAccount = vi.fn()
const mockUseTotalStaked = vi.fn()
const mockUseUserTotalStake = vi.fn()
const mockUseValidators = vi.fn()

vi.mock("wagmi", () => ({
  useAccount: () => mockUseAccount(),
}))

vi.mock("@/hooks/useStakingReads", () => ({
  useTotalStaked: () => mockUseTotalStaked(),
  useUserTotalStake: () => mockUseUserTotalStake(),
}))

vi.mock("@/hooks/useValidators", () => ({
  useValidators: () => mockUseValidators(),
}))

describe("StatsOverview", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockUseAccount.mockReturnValue({ isConnected: false })
    mockUseTotalStaked.mockReturnValue({ data: undefined, isLoading: false })
    mockUseUserTotalStake.mockReturnValue({ data: undefined, isLoading: false })
    mockUseValidators.mockReturnValue({ data: undefined, isLoading: false })
  })

  it("shows Total SAFE Staked and Active Validators when disconnected", () => {
    mockUseTotalStaked.mockReturnValue({ data: 5000n * 10n ** 18n, isLoading: false })
    mockUseValidators.mockReturnValue({
      data: [
        { address: "0x1", isActive: true },
        { address: "0x2", isActive: false },
      ],
      isLoading: false,
    })

    render(<StatsOverview />)

    expect(screen.getByText("Total SAFE Staked")).toBeInTheDocument()
    expect(screen.getByText("Active Validators")).toBeInTheDocument()
    expect(screen.getByText("1")).toBeInTheDocument() // 1 active validator
    // Should NOT show "Your Staked SAFE" when disconnected
    expect(screen.queryByText("Your Staked SAFE")).not.toBeInTheDocument()
  })

  it("shows Your Staked SAFE when connected", () => {
    mockUseAccount.mockReturnValue({ isConnected: true })
    mockUseTotalStaked.mockReturnValue({ data: 5000n * 10n ** 18n, isLoading: false })
    mockUseUserTotalStake.mockReturnValue({ data: 100n * 10n ** 18n, isLoading: false })
    mockUseValidators.mockReturnValue({ data: [], isLoading: false })

    render(<StatsOverview />)

    expect(screen.getByText("Your Staked SAFE")).toBeInTheDocument()
  })

  it("shows skeletons while loading", () => {
    mockUseTotalStaked.mockReturnValue({ data: undefined, isLoading: true })
    mockUseValidators.mockReturnValue({ data: undefined, isLoading: true })

    const { container } = render(<StatsOverview />)

    const skeletons = container.querySelectorAll('[class*="animate-pulse"]')
    expect(skeletons.length).toBeGreaterThan(0)
  })
})
