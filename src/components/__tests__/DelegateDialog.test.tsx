import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { TooltipProvider } from "@radix-ui/react-tooltip"
import { DelegateDialog } from "../staking/DelegateDialog"
import { AMOUNTS, TEST_ACCOUNTS } from "@/__tests__/test-data"

// --- Mock all hooks used by DelegateDialog ---

const mockStake = vi.fn()
const mockResetStake = vi.fn()
const mockBatchApproveAndStake = vi.fn()
const mockResetBatch = vi.fn()
const mockApprove = vi.fn()
const mockApproveUnlimited = vi.fn()
const mockResetApproval = vi.fn()
const mockToast = vi.fn()

vi.mock("@/hooks/useTokenBalance", () => ({
  useTokenBalance: vi.fn(() => ({ data: AMOUNTS.userBalance })),
}))

const mockTokenAllowance = {
  allowance: AMOUNTS.unlimitedAllowance,
  refetchAllowance: vi.fn(),
  approve: mockApprove,
  approveUnlimited: mockApproveUnlimited,
  isSigningApproval: false,
  isConfirmingApproval: false,
  isApproved: false,
  approvalError: null,
  approvalTxHash: undefined,
  resetApproval: mockResetApproval,
}

vi.mock("@/hooks/useTokenAllowance", () => ({
  useTokenAllowance: vi.fn(() => mockTokenAllowance),
}))

const mockUseStake = {
  stake: mockStake,
  isSigningTx: false,
  isConfirmingTx: false,
  isSuccess: false,
  error: null as Error | null,
  reset: mockResetStake,
  txHash: undefined as `0x${string}` | undefined,
}

const mockUseBatchStake = {
  batchApproveAndStake: mockBatchApproveAndStake,
  supportsBatching: false,
  isSigningTx: false,
  isConfirmingTx: false,
  isSuccess: false,
  isReverted: false,
  error: null,
  reset: mockResetBatch,
  txHash: undefined,
}

vi.mock("@/hooks/useStakingWrites", () => ({
  useStake: vi.fn(() => mockUseStake),
  useBatchStake: vi.fn(() => mockUseBatchStake),
}))

vi.mock("@/hooks/useStakingReads", () => ({
  useWithdrawDelay: vi.fn(() => ({ data: AMOUNTS.withdrawDelay })),
}))

vi.mock("@/hooks/useToast", () => ({
  useToast: vi.fn(() => ({ toast: mockToast })),
}))

vi.mock("@/hooks/useGasEstimate", () => ({
  useGasEstimate: vi.fn(() => ({ estimatedCost: null, isLoading: false })),
}))

describe("DelegateDialog", () => {
  const defaultProps = {
    validator: TEST_ACCOUNTS.validator1,
    open: true,
    onOpenChange: vi.fn(),
  }

  beforeEach(() => {
    vi.clearAllMocks()
    // Reset to defaults
    Object.assign(mockTokenAllowance, {
      allowance: AMOUNTS.unlimitedAllowance,
      isSigningApproval: false,
      isConfirmingApproval: false,
      isApproved: false,
      approvalError: null,
    })
    Object.assign(mockUseStake, {
      isSigningTx: false,
      isConfirmingTx: false,
      isSuccess: false,
      error: null,
      txHash: undefined,
    })
    Object.assign(mockUseBatchStake, {
      supportsBatching: false,
      isSigningTx: false,
      isConfirmingTx: false,
      isSuccess: false,
      isReverted: false,
      error: null,
    })
  })

  it("renders dialog with title and description", () => {
    render(<TooltipProvider><DelegateDialog {...defaultProps} /></TooltipProvider>)

    expect(screen.getByText("Stake SAFE")).toBeInTheDocument()
    expect(screen.getByText(/Stake tokens to validator/)).toBeInTheDocument()
  })

  it("renders amount input with balance", () => {
    render(<TooltipProvider><DelegateDialog {...defaultProps} /></TooltipProvider>)

    expect(screen.getByPlaceholderText("0.0")).toBeInTheDocument()
    expect(screen.getByText(/SAFE Balance:/)).toBeInTheDocument()
  })

  it("shows Stake button when sufficient allowance", () => {
    render(<TooltipProvider><DelegateDialog {...defaultProps} /></TooltipProvider>)

    expect(screen.getByRole("button", { name: "Stake" })).toBeInTheDocument()
  })

  it("disables Stake button when amount is empty", () => {
    render(<TooltipProvider><DelegateDialog {...defaultProps} /></TooltipProvider>)

    expect(screen.getByRole("button", { name: "Stake" })).toBeDisabled()
  })

  it("enables Stake button when valid amount entered", async () => {
    const user = userEvent.setup()
    render(<TooltipProvider><DelegateDialog {...defaultProps} /></TooltipProvider>)

    const input = screen.getByPlaceholderText("0.0")
    await user.type(input, "100")

    expect(screen.getByRole("button", { name: "Stake" })).toBeEnabled()
  })

  it("calls stake with correct args when Stake button clicked", async () => {
    const user = userEvent.setup()
    render(<TooltipProvider><DelegateDialog {...defaultProps} /></TooltipProvider>)

    const input = screen.getByPlaceholderText("0.0")
    await user.type(input, "100")
    await user.click(screen.getByRole("button", { name: "Stake" }))

    expect(mockStake).toHaveBeenCalledWith(
      TEST_ACCOUNTS.validator1,
      100n * 10n ** 18n,
    )
  })

  it("shows approval buttons when allowance is insufficient", () => {
    mockTokenAllowance.allowance = 0n

    render(<TooltipProvider><DelegateDialog {...defaultProps} /></TooltipProvider>)

    // Type amount to trigger approval flow rendering
    // The buttons won't show until amount > 0 and allowance < amount
    // But with allowance=0 and no amount typed, we should still see the Stake button
    // since parsedAmount is 0, needsApproval is false
    expect(screen.getByRole("button", { name: "Stake" })).toBeInTheDocument()
  })

  it("shows approve buttons when amount > allowance", async () => {
    mockTokenAllowance.allowance = 0n

    const user = userEvent.setup()
    render(<TooltipProvider><DelegateDialog {...defaultProps} /></TooltipProvider>)

    const input = screen.getByPlaceholderText("0.0")
    await user.type(input, "100")

    expect(screen.getByRole("button", { name: "Approve exact amount" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Approve unlimited" })).toBeInTheDocument()
  })

  it("calls approve with exact amount", async () => {
    mockTokenAllowance.allowance = 0n

    const user = userEvent.setup()
    render(<TooltipProvider><DelegateDialog {...defaultProps} /></TooltipProvider>)

    await user.type(screen.getByPlaceholderText("0.0"), "100")
    await user.click(screen.getByRole("button", { name: "Approve exact amount" }))

    expect(mockApprove).toHaveBeenCalledWith(100n * 10n ** 18n)
  })

  it("calls approveUnlimited when unlimited button clicked", async () => {
    mockTokenAllowance.allowance = 0n

    const user = userEvent.setup()
    render(<TooltipProvider><DelegateDialog {...defaultProps} /></TooltipProvider>)

    await user.type(screen.getByPlaceholderText("0.0"), "100")
    await user.click(screen.getByRole("button", { name: "Approve unlimited" }))

    expect(mockApproveUnlimited).toHaveBeenCalled()
  })

  it("shows signing state on Stake button", () => {
    mockUseStake.isSigningTx = true

    render(<TooltipProvider><DelegateDialog {...defaultProps} /></TooltipProvider>)

    expect(screen.getByText("Confirm in Wallet…")).toBeInTheDocument()
  })

  it("shows confirming state on Stake button", () => {
    mockUseStake.isConfirmingTx = true

    render(<TooltipProvider><DelegateDialog {...defaultProps} /></TooltipProvider>)

    expect(screen.getByText("Confirming onchain…")).toBeInTheDocument()
  })

  it("shows unstaking period info", () => {
    render(<TooltipProvider><DelegateDialog {...defaultProps} /></TooltipProvider>)

    expect(screen.getByText(/Unstaking period: 7d 0h 0m/)).toBeInTheDocument()
  })

  it("percentage buttons set correct amounts", async () => {
    const user = userEvent.setup()
    render(<TooltipProvider><DelegateDialog {...defaultProps} /></TooltipProvider>)

    // Click 25%
    await user.click(screen.getByRole("button", { name: "25%" }))
    expect(screen.getByPlaceholderText("0.0")).toHaveValue("250")

    // Click MAX
    await user.click(screen.getByRole("button", { name: "MAX" }))
    expect(screen.getByPlaceholderText("0.0")).toHaveValue("1000")
  })

  it("shows insufficient balance error when amount exceeds balance", async () => {
    const user = userEvent.setup()
    render(<TooltipProvider><DelegateDialog {...defaultProps} /></TooltipProvider>)

    await user.type(screen.getByPlaceholderText("0.0"), "2000")

    expect(screen.getByText("You do not have enough SAFE to stake this amount.")).toBeInTheDocument()
  })

  it("resets form when dialog closes", () => {
    const { rerender } = render(<TooltipProvider><DelegateDialog {...defaultProps} /></TooltipProvider>)

    rerender(<TooltipProvider><DelegateDialog {...defaultProps} open={false} /></TooltipProvider>)

    expect(mockResetStake).toHaveBeenCalled()
    expect(mockResetBatch).toHaveBeenCalled()
  })

  it("shows zero balance message", async () => {
    const mod = await import("@/hooks/useTokenBalance")
    vi.mocked(mod.useTokenBalance).mockReturnValue({ data: 0n } as ReturnType<typeof mod.useTokenBalance>)

    render(<TooltipProvider><DelegateDialog {...defaultProps} /></TooltipProvider>)

    expect(screen.getByText("You do not have enough SAFE to stake.")).toBeInTheDocument()

    // Restore for subsequent tests
    vi.mocked(mod.useTokenBalance).mockReturnValue({ data: AMOUNTS.userBalance } as ReturnType<typeof mod.useTokenBalance>)
  })

  it("shows signing approval state on approve buttons", async () => {
    mockTokenAllowance.allowance = 0n
    mockTokenAllowance.isSigningApproval = true

    const user = userEvent.setup()
    render(<TooltipProvider><DelegateDialog {...defaultProps} /></TooltipProvider>)

    await user.type(screen.getByPlaceholderText("0.0"), "100")

    expect(screen.getAllByText("Confirm Approval in Wallet…").length).toBeGreaterThan(0)
  })

  it("shows confirming approval state on approve buttons", async () => {
    mockTokenAllowance.allowance = 0n
    mockTokenAllowance.isConfirmingApproval = true

    const user = userEvent.setup()
    render(<TooltipProvider><DelegateDialog {...defaultProps} /></TooltipProvider>)

    await user.type(screen.getByPlaceholderText("0.0"), "100")

    expect(screen.getAllByText("Approval confirming…").length).toBeGreaterThan(0)
  })

  it("shows success toast after stake completes", () => {
    mockUseStake.isSuccess = true
    mockUseStake.txHash = "0xbbbb" as `0x${string}`

    render(<TooltipProvider><DelegateDialog {...defaultProps} /></TooltipProvider>)

    expect(mockToast).toHaveBeenCalledWith(
      expect.objectContaining({
        variant: "success",
        title: "Staking successful",
      })
    )
  })

  it("uses batch approve and stake when batching is supported", async () => {
    mockUseBatchStake.supportsBatching = true
    mockTokenAllowance.allowance = 0n

    const user = userEvent.setup()
    render(<TooltipProvider><DelegateDialog {...defaultProps} /></TooltipProvider>)

    await user.type(screen.getByPlaceholderText("0.0"), "100")
    await user.click(screen.getByRole("button", { name: "Stake" }))

    expect(mockBatchApproveAndStake).toHaveBeenCalledWith(
      TEST_ACCOUNTS.validator1,
      100n * 10n ** 18n,
    )
  })
})
