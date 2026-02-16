import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { ClaimableBanner } from "../dashboard/ClaimableBanner"
import { MemoryRouter } from "react-router-dom"

const mockUseAccount = vi.fn()
const mockUseNextClaimable = vi.fn()

vi.mock("wagmi", () => ({
  useAccount: () => mockUseAccount(),
}))

vi.mock("@/hooks/useWithdrawals", () => ({
  useNextClaimable: () => mockUseNextClaimable(),
}))

function renderWithRouter(ui: React.ReactElement) {
  return render(<MemoryRouter>{ui}</MemoryRouter>)
}

describe("ClaimableBanner", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("returns null when not connected", () => {
    mockUseAccount.mockReturnValue({ isConnected: false })
    mockUseNextClaimable.mockReturnValue({ data: undefined })

    const { container } = renderWithRouter(<ClaimableBanner />)

    expect(container.firstChild).toBeNull()
  })

  it("returns null when no claimable data", () => {
    mockUseAccount.mockReturnValue({ isConnected: true })
    mockUseNextClaimable.mockReturnValue({ data: undefined })

    const { container } = renderWithRouter(<ClaimableBanner />)

    expect(container.firstChild).toBeNull()
  })

  it("returns null when amount is zero", () => {
    mockUseAccount.mockReturnValue({ isConnected: true })
    mockUseNextClaimable.mockReturnValue({ data: [0n, 0n] })

    const { container } = renderWithRouter(<ClaimableBanner />)

    expect(container.firstChild).toBeNull()
  })

  it("returns null when cooldown not yet expired", () => {
    mockUseAccount.mockReturnValue({ isConnected: true })
    const futureTimestamp = BigInt(Math.floor(Date.now() / 1000) + 3600)
    mockUseNextClaimable.mockReturnValue({ data: [100n * 10n ** 18n, futureTimestamp] })

    const { container } = renderWithRouter(<ClaimableBanner />)

    expect(container.firstChild).toBeNull()
  })

  it("shows banner when withdrawal is claimable", () => {
    mockUseAccount.mockReturnValue({ isConnected: true })
    const pastTimestamp = BigInt(Math.floor(Date.now() / 1000) - 3600)
    mockUseNextClaimable.mockReturnValue({ data: [100n * 10n ** 18n, pastTimestamp] })

    renderWithRouter(<ClaimableBanner />)

    expect(screen.getByText(/SAFE ready to claim/)).toBeInTheDocument()
    expect(screen.getByText("Go to Withdrawals")).toBeInTheDocument()
  })

  it("dismiss button hides the banner", async () => {
    const user = userEvent.setup()
    mockUseAccount.mockReturnValue({ isConnected: true })
    const pastTimestamp = BigInt(Math.floor(Date.now() / 1000) - 3600)
    mockUseNextClaimable.mockReturnValue({ data: [100n * 10n ** 18n, pastTimestamp] })

    renderWithRouter(<ClaimableBanner />)

    await user.click(screen.getByLabelText("Dismiss banner"))

    expect(screen.queryByText(/SAFE ready to claim/)).not.toBeInTheDocument()
  })
})
