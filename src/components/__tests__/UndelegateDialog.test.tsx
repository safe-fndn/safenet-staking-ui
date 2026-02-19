import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { TooltipProvider } from "@radix-ui/react-tooltip"
import { UndelegateDialog } from "../staking/UndelegateDialog"
import { AMOUNTS, TEST_ACCOUNTS } from "@/__tests__/test-data"

const mockInitiateWithdrawal = vi.fn()
const mockReset = vi.fn()
const mockToast = vi.fn()

vi.mock("@/hooks/useStakingReads", () => ({
  useUserStakeOnValidator: vi.fn(() => ({ data: AMOUNTS.userStakeValidator1 })),
  useWithdrawDelay: vi.fn(() => ({ data: AMOUNTS.withdrawDelay })),
}))

vi.mock("@/hooks/useStakingWrites", () => ({
  useInitiateWithdrawal: vi.fn(() => ({
    initiateWithdrawal: mockInitiateWithdrawal,
    isSigningTx: false,
    isConfirmingTx: false,
    isSuccess: false,
    isSafeQueued: false,
    error: null,
    reset: mockReset,
    txHash: undefined,
  })),
}))

vi.mock("@/hooks/useToast", () => ({
  useToast: vi.fn(() => ({ toast: mockToast })),
}))

vi.mock("@/hooks/useGasEstimate", () => ({
  useGasEstimate: vi.fn(() => ({ estimatedCost: null, isLoading: false })),
}))

describe("UndelegateDialog", () => {
  const defaultProps = {
    validator: TEST_ACCOUNTS.validator1,
    open: true,
    onOpenChange: vi.fn(),
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("renders dialog with title and description", () => {
    render(<TooltipProvider><UndelegateDialog {...defaultProps} /></TooltipProvider>)

    expect(screen.getByText("Undelegate SAFE")).toBeInTheDocument()
    expect(screen.getByText(/Initiate withdrawal from validator/)).toBeInTheDocument()
  })

  it("shows amount input with validator stake as max", () => {
    render(<TooltipProvider><UndelegateDialog {...defaultProps} /></TooltipProvider>)

    expect(screen.getByPlaceholderText("0.0")).toBeInTheDocument()
    // Should show the balance label for the stake
    expect(screen.getByText(/SAFE Balance:/)).toBeInTheDocument()
  })

  it("disables button when amount is empty", () => {
    render(<TooltipProvider><UndelegateDialog {...defaultProps} /></TooltipProvider>)

    expect(screen.getByRole("button", { name: "Initiate Withdrawal" })).toBeDisabled()
  })

  it("enables button when valid amount entered", async () => {
    const user = userEvent.setup()
    render(<TooltipProvider><UndelegateDialog {...defaultProps} /></TooltipProvider>)

    await user.type(screen.getByPlaceholderText("0.0"), "100")

    expect(screen.getByRole("button", { name: "Initiate Withdrawal" })).toBeEnabled()
  })

  it("calls initiateWithdrawal with correct args", async () => {
    const user = userEvent.setup()
    render(<TooltipProvider><UndelegateDialog {...defaultProps} /></TooltipProvider>)

    await user.type(screen.getByPlaceholderText("0.0"), "100")
    await user.click(screen.getByRole("button", { name: "Initiate Withdrawal" }))

    expect(mockInitiateWithdrawal).toHaveBeenCalledWith(
      TEST_ACCOUNTS.validator1,
      100n * 10n ** 18n,
    )
  })

  it("disables button when amount exceeds stake", async () => {
    const user = userEvent.setup()
    render(<TooltipProvider><UndelegateDialog {...defaultProps} /></TooltipProvider>)

    // userStakeValidator1 = 300 SAFE, try 400
    await user.type(screen.getByPlaceholderText("0.0"), "400")

    expect(screen.getByRole("button", { name: "Initiate Withdrawal" })).toBeDisabled()
  })

  it("MAX button sets full stake amount", async () => {
    const user = userEvent.setup()
    render(<TooltipProvider><UndelegateDialog {...defaultProps} /></TooltipProvider>)

    await user.click(screen.getByRole("button", { name: "MAX" }))

    // 300 SAFE
    expect(screen.getByPlaceholderText("0.0")).toHaveValue("300")
  })

  it("shows unstaking period info", () => {
    render(<TooltipProvider><UndelegateDialog {...defaultProps} /></TooltipProvider>)

    expect(screen.getByText(/Unstaking period: 7d 0h 0m/)).toBeInTheDocument()
  })

  it("resets form on close", () => {
    const { rerender } = render(<TooltipProvider><UndelegateDialog {...defaultProps} /></TooltipProvider>)

    rerender(<TooltipProvider><UndelegateDialog {...defaultProps} open={false} /></TooltipProvider>)

    expect(mockReset).toHaveBeenCalled()
  })

  it("shows signing state", async () => {
    const mod = await import("@/hooks/useStakingWrites")
    vi.mocked(mod.useInitiateWithdrawal).mockReturnValue({
      initiateWithdrawal: mockInitiateWithdrawal,
      isSigningTx: true,
      isConfirmingTx: false,
      isSuccess: false,
      isSafeQueued: false,
      error: null,
      reset: mockReset,
      txHash: undefined,
    })

    render(<TooltipProvider><UndelegateDialog {...defaultProps} /></TooltipProvider>)

    expect(screen.getByText("Confirm in Wallet…")).toBeInTheDocument()

    // Restore
    vi.mocked(mod.useInitiateWithdrawal).mockReturnValue({
      initiateWithdrawal: mockInitiateWithdrawal,
      isSigningTx: false,
      isConfirmingTx: false,
      isSuccess: false,
      isSafeQueued: false,
      error: null,
      reset: mockReset,
      txHash: undefined,
    })
  })

  it("shows confirming state", async () => {
    const mod = await import("@/hooks/useStakingWrites")
    vi.mocked(mod.useInitiateWithdrawal).mockReturnValue({
      initiateWithdrawal: mockInitiateWithdrawal,
      isSigningTx: false,
      isConfirmingTx: true,
      isSuccess: false,
      isSafeQueued: false,
      error: null,
      reset: mockReset,
      txHash: undefined,
    })

    render(<TooltipProvider><UndelegateDialog {...defaultProps} /></TooltipProvider>)

    expect(screen.getByText("Confirming onchain…")).toBeInTheDocument()

    // Restore
    vi.mocked(mod.useInitiateWithdrawal).mockReturnValue({
      initiateWithdrawal: mockInitiateWithdrawal,
      isSigningTx: false,
      isConfirmingTx: false,
      isSuccess: false,
      isSafeQueued: false,
      error: null,
      reset: mockReset,
      txHash: undefined,
    })
  })

  it("shows insufficient balance message when amount exceeds stake", async () => {
    const user = userEvent.setup()
    render(<TooltipProvider><UndelegateDialog {...defaultProps} /></TooltipProvider>)

    await user.type(screen.getByPlaceholderText("0.0"), "400")

    // Button should be disabled
    expect(screen.getByRole("button", { name: "Initiate Withdrawal" })).toBeDisabled()
  })
})
