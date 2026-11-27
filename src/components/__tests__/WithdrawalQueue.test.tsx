import { describe, it, expect, vi, beforeEach } from "vitest"
import { act, render, screen } from "@testing-library/react"
import { TooltipProvider } from "@radix-ui/react-tooltip"
import { WithdrawalQueue } from "../withdrawals/WithdrawalQueue"
import { MOCK_VALIDATORS } from "@/__tests__/test-data"

const mockClaimWithdrawal = vi.fn()
const mockResetClaim = vi.fn()
const mockToast = vi.fn()

const mockUseAccount = vi.fn()
const mockUseWithdrawalQueue = vi.fn()
const mockUseWithdrawalValidators = vi.fn()
const mockUseClaimWithdrawal = vi.fn()

vi.mock("wagmi", () => ({
  useAccount: () => mockUseAccount(),
  useReadContract: vi.fn(() => ({ data: undefined, isLoading: false })),
}))

vi.mock("@/hooks/useWithdrawalQueue", () => ({
  useWithdrawalQueue: (opts?: { minBlock?: bigint }) => mockUseWithdrawalQueue(opts),
  useWithdrawalValidators: (ids: bigint[] | undefined) => mockUseWithdrawalValidators(ids),
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

const mockUseCountdown = vi.fn(() => 3600)
vi.mock("@/hooks/useCountdown", () => ({
  useCountdown: () => mockUseCountdown(),
}))

describe("WithdrawalQueue", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockUseCountdown.mockReturnValue(3600)
    mockUseClaimWithdrawal.mockReturnValue({
      claimWithdrawal: mockClaimWithdrawal,
      isSigningTx: false,
      isConfirmingTx: false,
      isSuccess: false,
      isSafeQueued: false,
      error: null,
      txHash: undefined,
      reset: mockResetClaim,
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
    mockUseWithdrawalQueue.mockReturnValue({ data: undefined, isLoading: false })

    renderQueue()

    expect(screen.getByText("Connect your wallet to view withdrawal queue.")).toBeInTheDocument()
  })

  it("shows loading skeletons when loading", () => {
    mockUseAccount.mockReturnValue({ isConnected: true })
    mockUseWithdrawalQueue.mockReturnValue({ data: undefined, isLoading: true })

    const { container } = renderQueue()

    const skeletons = container.querySelectorAll(".animate-pulse")
    expect(skeletons.length).toBeGreaterThan(0)
  })

  it("shows empty state when no withdrawals", () => {
    mockUseAccount.mockReturnValue({ isConnected: true })
    mockUseWithdrawalQueue.mockReturnValue({ data: { blockNumber: 100n, rows: [] }, isLoading: false })

    renderQueue()

    expect(screen.getByText("No pending withdrawals.")).toBeInTheDocument()
  })

  it("renders withdrawal cards when withdrawals exist", () => {
    mockUseAccount.mockReturnValue({ isConnected: true })
    mockUseWithdrawalQueue.mockReturnValue({
      data: { blockNumber: 100n, rows: [
        { id: 7n, amount: 50n * 10n ** 18n, claimableAt: BigInt(Math.floor(Date.now() / 1000) + 3600) },
      ] },
      isLoading: false,
    })

    renderQueue()

    expect(screen.getByText("Pending Withdrawals")).toBeInTheDocument()
  })

  it("shows FIFO info tooltip button", () => {
    mockUseAccount.mockReturnValue({ isConnected: true })
    mockUseWithdrawalQueue.mockReturnValue({
      data: { blockNumber: 100n, rows: [
        { id: 7n, amount: 50n * 10n ** 18n, claimableAt: BigInt(Math.floor(Date.now() / 1000) + 3600) },
      ] },
      isLoading: false,
    })

    renderQueue()

    expect(screen.getByLabelText("Withdrawal queue info")).toBeInTheDocument()
  })

  it("calls useClaimWithdrawal reset after successful claim (regression: infinite toast loop)", () => {
    mockUseAccount.mockReturnValue({ isConnected: true })
    mockUseWithdrawalQueue.mockReturnValue({
      data: { blockNumber: 100n, rows: [
        { id: 7n, amount: 50n * 10n ** 18n, claimableAt: BigInt(Math.floor(Date.now() / 1000) - 3600) },
      ] },
      isLoading: false,
    })
    mockUseClaimWithdrawal.mockReturnValue({
      claimWithdrawal: mockClaimWithdrawal,
      isSigningTx: false,
      isConfirmingTx: false,
      isSuccess: true,
      isSafeQueued: false,
      error: null,
      txHash: "0xabc",
      reset: mockResetClaim,
    })

    renderQueue()

    // reset must be called to clear isSuccess and prevent infinite re-renders
    expect(mockResetClaim).toHaveBeenCalled()
    expect(mockToast).toHaveBeenCalledWith(
      expect.objectContaining({ variant: "success", title: "Withdrawal claimed" }),
    )
  })

  it("labels each row by its withdrawal ID, not its position", () => {
    mockUseAccount.mockReturnValue({ isConnected: true })
    const later = BigInt(Math.floor(Date.now() / 1000) + 3600)
    mockUseWithdrawalQueue.mockReturnValue({
      data: { blockNumber: 100n, rows: [
        { id: 8n, amount: 10n ** 18n, claimableAt: later },
        { id: 9n, amount: 2n * 10n ** 18n, claimableAt: later },
      ] },
      isLoading: false,
    })
    // Only ID 9 is resolved so far: it must land on the second row.
    mockUseWithdrawalValidators.mockReturnValue({ data: { "9": MOCK_VALIDATORS[0].address } })

    renderQueue()

    expect(mockUseWithdrawalValidators).toHaveBeenCalledWith([8n, 9n])
    const labels = screen.getAllByText(MOCK_VALIDATORS[0].label)
    expect(labels).toHaveLength(1)
    expect(labels[0].closest(".border")).toHaveTextContent("2 SAFE")
  })

  it("disables Claim after a claim confirms until the snapshot reaches the claim's block", () => {
    mockUseAccount.mockReturnValue({ isConnected: true })
    mockUseCountdown.mockReturnValue(0)
    const past = BigInt(Math.floor(Date.now() / 1000) - 3600)
    const rows = [{ id: 7n, amount: 10n ** 18n, claimableAt: past }]
    // The claim was mined in block 101; the refetch still read block 100.
    mockUseWithdrawalQueue.mockReturnValue({ data: { blockNumber: 100n, rows }, isLoading: false })
    mockUseClaimWithdrawal.mockReturnValue({
      claimWithdrawal: mockClaimWithdrawal,
      isSigningTx: false,
      isConfirmingTx: false,
      isSuccess: true,
      isSafeQueued: false,
      error: null,
      txHash: "0xabc",
      reset: mockResetClaim,
      confirmedBlock: 101n,
    })

    const { rerender } = renderQueue()

    expect(mockUseWithdrawalQueue).toHaveBeenLastCalledWith({ minBlock: 101n })
    expect(screen.getByRole("button", { name: /Updating/ })).toBeDisabled()

    // The claim hook is reset by the toast; the gate must hold on its own.
    mockUseClaimWithdrawal.mockReturnValue({
      claimWithdrawal: mockClaimWithdrawal,
      isSigningTx: false,
      isConfirmingTx: false,
      isSuccess: false,
      isSafeQueued: false,
      error: null,
      txHash: undefined,
      reset: mockResetClaim,
    })
    rerender(<TooltipProvider><WithdrawalQueue /></TooltipProvider>)
    expect(screen.getByRole("button", { name: /Updating/ })).toBeDisabled()

    // A snapshot at the claim's block re-enables claiming.
    mockUseWithdrawalQueue.mockReturnValue({ data: { blockNumber: 101n, rows }, isLoading: false })
    rerender(<TooltipProvider><WithdrawalQueue /></TooltipProvider>)
    expect(screen.getByRole("button", { name: /Claim/ })).toBeEnabled()
  })

  const claimHook = (overrides: Record<string, unknown> = {}) => ({
    claimWithdrawal: mockClaimWithdrawal,
    isSigningTx: false,
    isConfirmingTx: false,
    isSuccess: false,
    isSafeQueued: false,
    error: null,
    txHash: undefined,
    reset: mockResetClaim,
    ...overrides,
  })
  const readyRows = (...ids: bigint[]) =>
    ids.map((id) => ({ id, amount: 10n ** 18n, claimableAt: BigInt(Math.floor(Date.now() / 1000) - 3600) }))

  it("shows an error with a retry instead of an empty queue when the read fails", async () => {
    mockUseAccount.mockReturnValue({ isConnected: true })
    const refetch = vi.fn()
    mockUseWithdrawalQueue.mockReturnValue({ data: undefined, isLoading: false, isError: true, refetch })

    renderQueue()

    expect(screen.queryByText("No pending withdrawals.")).not.toBeInTheDocument()
    expect(screen.getByText("Could not load your withdrawal queue.")).toBeInTheDocument()
    screen.getByRole("button", { name: "Retry" }).click()
    expect(refetch).toHaveBeenCalled()
  })

  it("waits for the queue after a partly failed Claim All, using the successful receipts' block", () => {
    mockUseAccount.mockReturnValue({ isConnected: true })
    mockUseCountdown.mockReturnValue(0)
    mockUseWithdrawalQueue.mockReturnValue({ data: { blockNumber: 100n, rows: readyRows(7n, 8n) }, isLoading: false })
    mockUseBatchClaimWithdrawals.mockReturnValue({
      batchClaimWithdrawals: vi.fn(),
      supportsBatching: true,
      isSigningTx: false,
      isConfirmingTx: false,
      isSuccess: false,
      isReverted: true,
      error: null,
      reset: vi.fn(),
      txHash: undefined,
      confirmedBlock: 101n,
    })

    renderQueue()

    expect(mockUseWithdrawalQueue).toHaveBeenLastCalledWith({ minBlock: 101n })
    expect(screen.getByRole("button", { name: /Updating/ })).toBeDisabled()
    expect(screen.getByRole("button", { name: /Claim All/ })).toBeDisabled()
    expect(mockToast).toHaveBeenCalledWith(expect.objectContaining({ title: "Some claims failed" }))
  })

  const batchHook = (overrides: Record<string, unknown> = {}) => ({
    batchClaimWithdrawals: mockBatchClaim,
    supportsBatching: true,
    isSigningTx: false,
    isConfirmingTx: false,
    isSuccess: false,
    isReverted: false,
    error: null,
    reset: vi.fn(),
    txHash: undefined,
    ...overrides,
  })
  const mockBatchClaim = vi.fn()

  it("locks the single Claim while Claim All is confirming", async () => {
    mockUseAccount.mockReturnValue({ isConnected: true })
    mockUseCountdown.mockReturnValue(0)
    mockUseWithdrawalQueue.mockReturnValue({ data: { blockNumber: 100n, rows: readyRows(7n, 8n) }, isLoading: false })
    mockUseBatchClaimWithdrawals.mockReturnValue(batchHook({ isConfirmingTx: true }))

    renderQueue()

    const single = screen.getByRole("button", { name: /Claiming all/ })
    expect(single).toBeDisabled()
    await act(async () => single.click())
    expect(mockClaimWithdrawal).not.toHaveBeenCalled()
  })

  it("locks Claim All while a single claim is signing or confirming", async () => {
    mockUseAccount.mockReturnValue({ isConnected: true })
    mockUseCountdown.mockReturnValue(0)
    mockUseWithdrawalQueue.mockReturnValue({ data: { blockNumber: 100n, rows: readyRows(7n, 8n) }, isLoading: false })
    mockUseBatchClaimWithdrawals.mockReturnValue(batchHook())

    for (const state of [{ isSigningTx: true }, { isConfirmingTx: true }]) {
      mockUseClaimWithdrawal.mockReturnValue(claimHook(state))
      const { unmount } = renderQueue()
      const all = screen.getByRole("button", { name: /Claim All/ })
      expect(all).toBeDisabled()
      await act(async () => all.click())
      expect(mockBatchClaim).not.toHaveBeenCalled()
      unmount()
    }
  })

  it("offers both controls again once nothing is in flight", () => {
    mockUseAccount.mockReturnValue({ isConnected: true })
    mockUseCountdown.mockReturnValue(0)
    mockUseWithdrawalQueue.mockReturnValue({ data: { blockNumber: 100n, rows: readyRows(7n, 8n) }, isLoading: false })
    mockUseBatchClaimWithdrawals.mockReturnValue(batchHook())

    renderQueue()
    expect(screen.getByRole("button", { name: /Claim All/ })).toBeEnabled()
    expect(screen.getByRole("button", { name: /^Claim$/ })).toBeEnabled()
  })
})
