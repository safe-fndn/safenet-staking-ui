import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen } from "@testing-library/react"
import { MemoryRouter } from "react-router-dom"
import { TooltipProvider } from "@radix-ui/react-tooltip"
import { StakingSection } from "../dashboard/StakingSection"
import { MOCK_VALIDATORS } from "@/__tests__/test-data"

const mockUseAccount = vi.fn()

vi.mock("wagmi", () => ({
  useAccount: () => mockUseAccount(),
}))

vi.mock("@/hooks/useValidators", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/hooks/useValidators")>()
  return {
    ...actual,
    useValidators: vi.fn(() => ({
      data: [MOCK_VALIDATORS[0]],
    })),
  }
})

vi.mock("@/hooks/useStakingReads", () => ({
  useUserStakesOnValidators: vi.fn(() => ({
    data: [{ status: "success", result: 200n * 10n ** 18n }],
    isLoading: false,
  })),
}))

vi.mock("@/hooks/useRewards", () => ({
  useRewards: vi.fn(() => ({
    data: { claimable: 50n * 10n ** 18n, totalClaimed: 0n, canClaim: true, rootStale: false },
  })),
}))

vi.mock("@/components/staking/UndelegateDialog", () => ({
  UndelegateDialog: () => null,
}))

vi.mock("@/components/dashboard/ClaimRewardsDialog", () => ({
  ClaimRewardsDialog: () => null,
}))

vi.mock("@/hooks/useKycRequired", () => ({
  useKycRequired: vi.fn(() => false),
}))

function renderSection() {
  return render(
    <MemoryRouter>
      <TooltipProvider>
        <StakingSection />
      </TooltipProvider>
    </MemoryRouter>,
  )
}

describe("StakingSection", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("returns null when not connected", () => {
    mockUseAccount.mockReturnValue({ isConnected: false })

    const { container } = renderSection()
    expect(container.firstChild).toBeNull()
  })

  it("shows staking title and rewards when connected", () => {
    mockUseAccount.mockReturnValue({ isConnected: true, address: "0x1234567890123456789012345678901234567890" })

    renderSection()

    expect(screen.getByText("Your Rewards")).toBeInTheDocument()
    expect(screen.getByText("Claimable SAFE")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Claim Rewards" })).toBeInTheDocument()
  })

  it("shows position table with validator", () => {
    mockUseAccount.mockReturnValue({ isConnected: true })

    renderSection()

    expect(screen.getByText("Gnosis")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Unstake" })).toBeInTheDocument()
  })

  it("shows compliance note when address is KYC-required", async () => {
    mockUseAccount.mockReturnValue({
      isConnected: true,
      address: "0x1234567890123456789012345678901234567890",
    })
    const mod = await import("@/hooks/useKycRequired")
    vi.mocked(mod.useKycRequired).mockReturnValueOnce(true)

    renderSection()

    expect(screen.getByText(/pending compliance checks/)).toBeInTheDocument()
    expect(screen.getByRole("link", { name: "legal@safefoundation.org" })).toBeInTheDocument()
  })

  it("hides compliance note when address is not KYC-required", () => {
    mockUseAccount.mockReturnValue({
      isConnected: true,
      address: "0x1234567890123456789012345678901234567890",
    })

    renderSection()

    expect(screen.queryByText(/pending compliance checks/)).not.toBeInTheDocument()
  })

  it("hides compliance note when kycRequired is true but address is undefined", async () => {
    mockUseAccount.mockReturnValue({ isConnected: true, address: undefined })
    const mod = await import("@/hooks/useKycRequired")
    vi.mocked(mod.useKycRequired).mockReturnValueOnce(true)

    renderSection()

    expect(screen.queryByText(/pending compliance checks/)).not.toBeInTheDocument()
  })

  it("shows empty state when no positions", async () => {
    mockUseAccount.mockReturnValue({ isConnected: true })

    const mod = await import("@/hooks/useStakingReads")
    vi.mocked(mod.useUserStakesOnValidators).mockReturnValueOnce({
      data: [{ status: "success", result: 0n }],
      isLoading: false,
    } as ReturnType<typeof mod.useUserStakesOnValidators>)

    renderSection()

    expect(screen.getByText(/You have no active stakes/)).toBeInTheDocument()
  })
})
