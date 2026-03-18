import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { WithdrawalCard } from "../withdrawals/WithdrawalCard"
import { AMOUNTS, TEST_ACCOUNTS, MOCK_VALIDATORS } from "@/__tests__/test-data"

vi.mock("@/hooks/useWrongNetwork", () => ({
  useWrongNetwork: () => false,
}))

vi.mock("@/hooks/useCountdown", () => ({
  useCountdown: vi.fn(() => 0), // default: claimable (0 seconds left)
}))

vi.mock("@/hooks/useStakingReads", () => ({
  useWithdrawDelay: vi.fn(() => ({ data: AMOUNTS.withdrawDelay })),
}))

vi.mock("@/hooks/useValidators", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/hooks/useValidators")>()
  return { ...actual }
})

describe("WithdrawalCard", () => {
  const mockOnClaim = vi.fn()
  const pastClaimableAt = Math.floor(Date.now() / 1000) - 3600 // 1 hour ago
  const futureClaimableAt = Math.floor(Date.now() / 1000) + 86400 // 1 day from now

  const defaultProps = {
    amount: AMOUNTS.pendingWithdrawalAmount,
    claimableAt: pastClaimableAt,
    isFirst: true,
    onClaim: mockOnClaim,
    isSigningTx: false,
    isConfirmingTx: false,
    validator: TEST_ACCOUNTS.validator1,
    validators: [...MOCK_VALIDATORS],
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("renders withdrawal amount", () => {
    render(<WithdrawalCard {...defaultProps} />)

    expect(screen.getByText(/50/)).toBeInTheDocument()
    expect(screen.getByText(/SAFE/)).toBeInTheDocument()
  })

  it("renders validator label", () => {
    render(<WithdrawalCard {...defaultProps} />)

    expect(screen.getByText(/Gnosis/)).toBeInTheDocument()
  })

  it("shows enabled Claim button when claimable", () => {
    render(<WithdrawalCard {...defaultProps} />)

    expect(screen.getByRole("button", { name: /Claim/i })).toBeEnabled()
  })

  it("calls onClaim when Claim button clicked", async () => {
    const user = userEvent.setup()
    render(<WithdrawalCard {...defaultProps} />)

    await user.click(screen.getByRole("button", { name: /Claim/i }))

    expect(mockOnClaim).toHaveBeenCalled()
  })

  it("hides Claim button when not first in queue", () => {
    render(<WithdrawalCard {...defaultProps} isFirst={false} />)

    expect(screen.queryByRole("button", { name: /Claim/i })).not.toBeInTheDocument()
  })

  it("shows signing state on Claim button", () => {
    render(<WithdrawalCard {...defaultProps} isSigningTx={true} />)

    expect(screen.getByText("Signing…")).toBeInTheDocument()
    expect(screen.getByRole("button")).toBeDisabled()
  })

  it("shows confirming state on Claim button", () => {
    render(<WithdrawalCard {...defaultProps} isConfirmingTx={true} />)

    expect(screen.getByText("Confirming…")).toBeInTheDocument()
  })

  it("shows countdown and progress bar when in cooldown", async () => {
    const { useCountdown } = await import("@/hooks/useCountdown")
    vi.mocked(useCountdown).mockReturnValue(86400) // 1 day remaining

    render(<WithdrawalCard {...defaultProps} claimableAt={futureClaimableAt} />)

    // Should show progress bar (cooldown in progress)
    expect(screen.getByText("Cooldown progress")).toBeInTheDocument()
    // Claim button not shown during cooldown
    expect(screen.queryByRole("button", { name: /Claim/i })).not.toBeInTheDocument()
  })
})
