import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen } from "@testing-library/react"
import { PortfolioBreakdown } from "../dashboard/PortfolioBreakdown"
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
      { status: "success", result: 100n * 10n ** 18n },
    ],
    isLoading: false,
  })),
  useUserTotalStake: vi.fn(() => ({ data: 300n * 10n ** 18n })),
}))

vi.mock("@/hooks/useValidatorMetadata", () => ({
  useValidatorMetadata: () => ({ label: "Gnosis", commission: 5, uptime: 99.9 }),
}))

describe("PortfolioBreakdown", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("returns null when not connected", () => {
    mockUseAccount.mockReturnValue({ isConnected: false })

    const { container } = render(<PortfolioBreakdown />)
    expect(container.firstChild).toBeNull()
  })

  it("shows portfolio title and validator rows when connected", () => {
    mockUseAccount.mockReturnValue({ isConnected: true })

    render(<PortfolioBreakdown />)

    expect(screen.getByText("SAFE Portfolio Breakdown")).toBeInTheDocument()
    // Two rows with "Gnosis" (both use the same mock metadata)
    expect(screen.getAllByText("Gnosis").length).toBe(2)
  })

  it("shows percentage for each validator", () => {
    mockUseAccount.mockReturnValue({ isConnected: true })

    render(<PortfolioBreakdown />)

    // 200/300 = 66.66...%, 100/300 = 33.33...%
    // toFixed(1) rounds, so check with regex
    expect(screen.getByText(/66\.\d%/)).toBeInTheDocument()
    expect(screen.getByText(/33\.\d%/)).toBeInTheDocument()
  })

  it("returns null when no positions", async () => {
    mockUseAccount.mockReturnValue({ isConnected: true })

    const mod = await import("@/hooks/useStakingReads")
    vi.mocked(mod.useUserStakesOnValidators).mockReturnValue({
      data: [
        { status: "success", result: 0n },
        { status: "success", result: 0n },
      ],
      isLoading: false,
    } as ReturnType<typeof mod.useUserStakesOnValidators>)

    const { container } = render(<PortfolioBreakdown />)
    expect(container.firstChild).toBeNull()

    // Restore
    vi.mocked(mod.useUserStakesOnValidators).mockReturnValue({
      data: [
        { status: "success", result: 200n * 10n ** 18n },
        { status: "success", result: 100n * 10n ** 18n },
      ],
      isLoading: false,
    } as ReturnType<typeof mod.useUserStakesOnValidators>)
  })
})
