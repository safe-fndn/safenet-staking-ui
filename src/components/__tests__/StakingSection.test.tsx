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

vi.mock("@/hooks/useRewardProof", () => ({
  useRewardProof: vi.fn(() => ({ data: null })),
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

  it("shows compliance note when proof has kycAmount > 0 and kyc is not true", async () => {
    mockUseAccount.mockReturnValue({
      isConnected: true,
      address: "0x1234567890123456789012345678901234567890",
    })
    const mod = await import("@/hooks/useRewardProof")
    vi.mocked(mod.useRewardProof).mockReturnValueOnce({
      data: {
        cumulativeAmount: "0",
        kycAmount: "826720638286750773563",
        merkleRoot: "0x5aea53631d726e3cb245cb1ce31834212ab6667a4726d25168a583d3b57b6cc1",
        proof: null,
      },
    } as ReturnType<typeof mod.useRewardProof>)

    renderSection()

    expect(screen.getByText(/pending compliance checks/)).toBeInTheDocument()
    expect(screen.getByRole("link", { name: "legal@safefoundation.org" })).toBeInTheDocument()
  })

  it("hides compliance note when proof has kyc:true (even with kycAmount > 0)", async () => {
    mockUseAccount.mockReturnValue({
      isConnected: true,
      address: "0x1234567890123456789012345678901234567890",
    })
    const mod = await import("@/hooks/useRewardProof")
    vi.mocked(mod.useRewardProof).mockReturnValueOnce({
      data: {
        cumulativeAmount: "973890821912297403820",
        kycAmount: "0",
        kyc: true,
        merkleRoot: "0x5aea53631d726e3cb245cb1ce31834212ab6667a4726d25168a583d3b57b6cc1",
        proof: ["0x1998aa1fb0e54f96da60317f799a85422585dda3a8368e6af3a465c3dd455e50"],
      },
    } as ReturnType<typeof mod.useRewardProof>)

    renderSection()

    expect(screen.queryByText(/pending compliance checks/)).not.toBeInTheDocument()
  })

  it("hides compliance note when proof has kycAmount of 0", async () => {
    mockUseAccount.mockReturnValue({
      isConnected: true,
      address: "0x1234567890123456789012345678901234567890",
    })
    const mod = await import("@/hooks/useRewardProof")
    vi.mocked(mod.useRewardProof).mockReturnValueOnce({
      data: {
        cumulativeAmount: "100",
        kycAmount: "0",
        merkleRoot: "0x5aea53631d726e3cb245cb1ce31834212ab6667a4726d25168a583d3b57b6cc1",
        proof: ["0xabc"],
      },
    } as ReturnType<typeof mod.useRewardProof>)

    renderSection()

    expect(screen.queryByText(/pending compliance checks/)).not.toBeInTheDocument()
  })

  it("hides compliance note when proof has no kycAmount field", () => {
    mockUseAccount.mockReturnValue({
      isConnected: true,
      address: "0x1234567890123456789012345678901234567890",
    })

    renderSection()

    expect(screen.queryByText(/pending compliance checks/)).not.toBeInTheDocument()
  })

  it("hides compliance note when proof is null (no proof file)", () => {
    mockUseAccount.mockReturnValue({
      isConnected: true,
      address: "0x1234567890123456789012345678901234567890",
    })

    renderSection()

    expect(screen.queryByText(/pending compliance checks/)).not.toBeInTheDocument()
  })

  it("hides compliance note when address is undefined even with kycAmount > 0", async () => {
    mockUseAccount.mockReturnValue({ isConnected: true, address: undefined })
    const mod = await import("@/hooks/useRewardProof")
    vi.mocked(mod.useRewardProof).mockReturnValueOnce({
      data: {
        cumulativeAmount: "0",
        kycAmount: "826720638286750773563",
        merkleRoot: "0x5aea53631d726e3cb245cb1ce31834212ab6667a4726d25168a583d3b57b6cc1",
        proof: null,
      },
    } as ReturnType<typeof mod.useRewardProof>)

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
