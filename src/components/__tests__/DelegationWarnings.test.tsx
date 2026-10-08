import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen } from "@testing-library/react"
import { MemoryRouter } from "react-router-dom"
import { WalletDelegationWarnings, DelegationWarningBanners } from "../DelegationWarnings"
import { INACTIVE_WARNING, LOW_PARTICIPATION_WARNING } from "@/lib/delegationWarnings"
import { MOCK_VALIDATORS, TEST_ACCOUNTS } from "@/__tests__/test-data"
import { useValidators, type ValidatorInfo } from "@/hooks/useValidators"
import { useUserStakesOnValidators } from "@/hooks/useStakingReads"

const mockUseAccount = vi.fn()

vi.mock("wagmi", () => ({
  useAccount: () => mockUseAccount(),
}))

vi.mock("@/hooks/useValidators", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/hooks/useValidators")>()
  return { ...actual, useValidators: vi.fn() }
})

vi.mock("@/hooks/useStakingReads", () => ({
  useUserStakesOnValidators: vi.fn(),
}))

const STAKE = 100n * 10n ** 18n

function mockValidators(validators: ValidatorInfo[]) {
  vi.mocked(useValidators).mockReturnValue({ data: validators } as unknown as ReturnType<typeof useValidators>)
}

function mockStakes(amounts: bigint[]) {
  vi.mocked(useUserStakesOnValidators).mockReturnValue({
    data: amounts.map((result) => ({ status: "success", result })),
  } as unknown as ReturnType<typeof useUserStakesOnValidators>)
}

function renderDashboardWarnings() {
  return render(
    <MemoryRouter>
      <WalletDelegationWarnings />
    </MemoryRouter>,
  )
}

const [gnosis, greenfield] = MOCK_VALIDATORS

describe("DelegationWarningBanners", () => {
  it("renders nothing without affected validators", () => {
    const { container } = render(<DelegationWarningBanners inactive={[]} lowParticipation={[]} />)
    expect(container).toBeEmptyDOMElement()
  })

  it("renders both banners together", () => {
    const v = { ...gnosis, isActive: false, participationRate: 50 }
    render(<DelegationWarningBanners inactive={[v]} lowParticipation={[v]} />)

    const alerts = screen.getAllByRole("alert")
    expect(alerts).toHaveLength(2)
    expect(alerts[0]).toHaveTextContent(INACTIVE_WARNING)
    expect(alerts[1]).toHaveTextContent(LOW_PARTICIPATION_WARNING)
  })

  it("lists affected validators only when asked to", () => {
    const v = { ...gnosis, isActive: false }
    const { rerender } = render(
      <MemoryRouter>
        <DelegationWarningBanners inactive={[v]} lowParticipation={[]} />
      </MemoryRouter>,
    )
    expect(screen.queryByRole("link", { name: "Gnosis" })).not.toBeInTheDocument()

    rerender(
      <MemoryRouter>
        <DelegationWarningBanners inactive={[v]} lowParticipation={[]} showValidators />
      </MemoryRouter>,
    )
    expect(screen.getByRole("link", { name: "Gnosis" })).toHaveAttribute("href", `/validators/${gnosis.address}`)
  })
})

describe("WalletDelegationWarnings", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockUseAccount.mockReturnValue({ isConnected: true, address: TEST_ACCOUNTS.user })
  })

  it("names each affected validator in its banner", () => {
    mockValidators([{ ...gnosis, isActive: false }, { ...greenfield, participationRate: 60 }])
    mockStakes([STAKE, STAKE])
    renderDashboardWarnings()

    const [inactive, low] = screen.getAllByRole("alert")
    expect(inactive).toHaveTextContent(INACTIVE_WARNING)
    expect(inactive).toHaveTextContent("Gnosis")
    expect(inactive).not.toHaveTextContent("Greenfield")
    expect(low).toHaveTextContent(LOW_PARTICIPATION_WARNING)
    expect(low).toHaveTextContent("Greenfield")
    expect(low).not.toHaveTextContent("Gnosis")
  })

  it("names the same validator in both banners when both conditions apply", () => {
    mockValidators([{ ...gnosis, isActive: false, participationRate: 50 }, greenfield])
    mockStakes([STAKE, STAKE])
    renderDashboardWarnings()

    const alerts = screen.getAllByRole("alert")
    expect(alerts).toHaveLength(2)
    for (const alert of alerts) expect(alert).toHaveTextContent("Gnosis")
  })

  it("shows nothing when the wallet has no stake on affected validators", () => {
    mockValidators([{ ...gnosis, isActive: false }, { ...greenfield, participationRate: 60 }])
    mockStakes([0n, 0n])
    renderDashboardWarnings()

    expect(screen.queryByRole("alert")).not.toBeInTheDocument()
  })

  it("shows nothing at exactly 75% participation", () => {
    mockValidators([{ ...gnosis, participationRate: 75 }])
    mockStakes([STAKE])
    renderDashboardWarnings()

    expect(screen.queryByRole("alert")).not.toBeInTheDocument()
  })

  it("shows nothing when disconnected", () => {
    mockUseAccount.mockReturnValue({ isConnected: false })
    mockValidators([{ ...gnosis, isActive: false }])
    mockStakes([STAKE])
    renderDashboardWarnings()

    expect(screen.queryByRole("alert")).not.toBeInTheDocument()
  })

  it("ignores failed stake reads", () => {
    mockValidators([{ ...gnosis, isActive: false }])
    vi.mocked(useUserStakesOnValidators).mockReturnValue({
      data: [{ status: "failure", error: new Error("rpc") }],
    } as unknown as ReturnType<typeof useUserStakesOnValidators>)
    renderDashboardWarnings()

    expect(screen.queryByRole("alert")).not.toBeInTheDocument()
  })
})
