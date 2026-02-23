import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen } from "@testing-library/react"
import { TooltipProvider } from "@radix-ui/react-tooltip"
import { WithdrawalQueue } from "../withdrawals/WithdrawalQueue"
import { MOCK_VALIDATORS } from "@/__tests__/test-data"

const mockClaimWithdrawal = vi.fn()
const mockToast = vi.fn()

const mockUseAccount = vi.fn()
const mockUsePendingWithdrawals = vi.fn()
const mockUseWithdrawalValidators = vi.fn()
const mockUseClaimWithdrawal = vi.fn()

vi.mock("wagmi", () => ({
  useAccount: () => mockUseAccount(),
  useReadContract: vi.fn(() => ({ data: undefined, isLoading: false })),
}))

vi.mock("@/hooks/useWithdrawals", () => ({
  usePendingWithdrawals: () => mockUsePendingWithdrawals(),
}))

vi.mock("@/hooks/useWithdrawalValidators", () => ({
  useWithdrawalValidators: () => mockUseWithdrawalValidators(),
}))

vi.mock("@/hooks/useValidators", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/hooks/useValidators")>()
  return {
    ...actual,
    useValidators: vi.fn(() => ({
      data: [...MOCK_VALIDATORS],
    })),
  }
})

const mockUseBatchClaimWithdrawals = vi.fn()

vi.mock("@/hooks/useStakingWrites", () => ({
  useClaimWithdrawal: () => mockUseClaimWithdrawal(),
  useBatchClaimWithdrawals: () => mockUseBatchClaimWithdrawals(),
}))

vi.mock("@/hooks/useToast", () => ({
  useToast: vi.fn(() => ({ toast: mockToast })),
}))

vi.mock("@/hooks/useCountdown", () => ({
  useCountdown: () => 3600,
}))

describe("WithdrawalQueue", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockUseClaimWithdrawal.mockReturnValue({
      claimWithdrawal: mockClaimWithdrawal,
      isSigningTx: false,
      isConfirmingTx: false,
      isSuccess: false,
      isSafeQueued: false,
      error: null,
      txHash: undefined,
    })
    mockUseBatchClaimWithdrawals.mockReturnValue({
      batchClaimWithdrawals: vi.fn(),
      supportsBatching: false,
      isSigningTx: false,
      isConfirmingTx: false,
      isSuccess: false,
      isReverted: false,
      error: null,
      reset: vi.fn(),
      txHash: undefined,
    })
    mockUseWithdrawalValidators.mockReturnValue({ data: undefined })
  })

  function renderQueue() {
    return render(
      <TooltipProvider>
        <WithdrawalQueue />
      </TooltipProvider>
    )
  }

  it("shows connect wallet message when disconnected", () => {
    mockUseAccount.mockReturnValue({ isConnected: false })
    mockUsePendingWithdrawals.mockReturnValue({ data: undefined, isLoading: false })

    renderQueue()

    expect(screen.getByText("Connect your wallet to view withdrawal queue.")).toBeInTheDocument()
  })

  it("shows loading skeletons when loading", () => {
    mockUseAccount.mockReturnValue({ isConnected: true })
    mockUsePendingWithdrawals.mockReturnValue({ data: undefined, isLoading: true })

    const { container } = renderQueue()

    const skeletons = container.querySelectorAll(".animate-pulse")
    expect(skeletons.length).toBeGreaterThan(0)
  })

  it("shows empty state when no withdrawals", () => {
    mockUseAccount.mockReturnValue({ isConnected: true })
    mockUsePendingWithdrawals.mockReturnValue({ data: [], isLoading: false })

    renderQueue()

    expect(screen.getByText("No pending withdrawals.")).toBeInTheDocument()
  })

  it("renders withdrawal cards when withdrawals exist", () => {
    mockUseAccount.mockReturnValue({ isConnected: true })
    mockUsePendingWithdrawals.mockReturnValue({
      data: [
        { amount: 50n * 10n ** 18n, claimableAt: BigInt(Math.floor(Date.now() / 1000) + 3600) },
      ],
      isLoading: false,
    })

    renderQueue()

    expect(screen.getByText("Pending Withdrawals")).toBeInTheDocument()
  })

  it("shows FIFO info tooltip button", () => {
    mockUseAccount.mockReturnValue({ isConnected: true })
    mockUsePendingWithdrawals.mockReturnValue({
      data: [
        { amount: 50n * 10n ** 18n, claimableAt: BigInt(Math.floor(Date.now() / 1000) + 3600) },
      ],
      isLoading: false,
    })

    renderQueue()

    expect(screen.getByLabelText("Withdrawal queue info")).toBeInTheDocument()
  })
})
