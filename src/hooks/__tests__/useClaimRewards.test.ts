import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { renderHook, act } from "@testing-library/react"
import { getAddress } from "viem"
import { useClaimRewards } from "../useClaimRewards"
import { TEST_ACCOUNTS, MOCK_TX_HASH } from "@/__tests__/test-data"
import { mockWriteContractReturn, mockWaitForReceiptReturn } from "@/__tests__/mock-wagmi"

const { MERKLE_DROP, safe, contracts } = vi.hoisted(() => {
  const MERKLE_DROP = "0x0000000000000000000000000000000000000003"
  return {
    MERKLE_DROP,
    safe: { isSafeApp: false },
    // useClaimRewards reads merkleDrop when it loads, so a change needs a fresh import
    contracts: { merkleDrop: MERKLE_DROP as string | undefined },
  }
})

vi.mock("@/config/contracts", () => ({
  getContractAddresses: () => ({
    merkleDrop: contracts.merkleDrop,
  }),
}))

// Getter so each test can switch between Safe App and regular wallet
vi.mock("@/lib/safe", () => ({
  get isSafeApp() {
    return safe.isSafeApp
  },
}))

// Mock wagmi
const mockWriteContract = vi.fn()
const mockReset = vi.fn()

vi.mock("wagmi", () => ({
  useWriteContract: vi.fn(),
  useWaitForTransactionReceipt: vi.fn(),
}))

// Mock queryClient
const mockInvalidateQueries = vi.fn()
vi.mock("@/config/queryClient", () => ({
  queryClient: {
    invalidateQueries: (...args: unknown[]) => mockInvalidateQueries(...args),
  },
}))

const wagmi = vi.mocked(await import("wagmi"))

const proofArgs = {
  cumulativeAmount: 100n * 10n ** 18n,
  expectedMerkleRoot: ("0x" + "1".repeat(64)) as `0x${string}`,
  merkleProof: [("0x" + "2".repeat(64)) as `0x${string}`],
}

describe("useClaimRewards", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    safe.isSafeApp = false
    wagmi.useWriteContract.mockReturnValue(
      mockWriteContractReturn({
        writeContract: mockWriteContract,
        reset: mockReset,
      })
    )
    wagmi.useWaitForTransactionReceipt.mockReturnValue(
      mockWaitForReceiptReturn()
    )
  })

  it("calls writeContract with claim and a checksummed account", () => {
    const { result } = renderHook(() => useClaimRewards())

    act(() => {
      result.current.claimRewards(
        TEST_ACCOUNTS.validator1,
        proofArgs.cumulativeAmount,
        proofArgs.expectedMerkleRoot,
        proofArgs.merkleProof,
      )
    })

    expect(mockWriteContract).toHaveBeenCalledWith(
      expect.objectContaining({
        address: MERKLE_DROP,
        functionName: "claim",
        args: [
          getAddress(TEST_ACCOUNTS.validator1),
          proofArgs.cumulativeAmount,
          proofArgs.expectedMerkleRoot,
          proofArgs.merkleProof,
        ],
      })
    )
  })

  it("reflects signing state when isPending is true", () => {
    wagmi.useWriteContract.mockReturnValue(
      mockWriteContractReturn({ isPending: true })
    )

    const { result } = renderHook(() => useClaimRewards())
    expect(result.current.isSigningTx).toBe(true)
    expect(result.current.isConfirmingTx).toBe(false)
  })

  it("returns the write error, ahead of any receipt error", () => {
    const writeError = new Error("User rejected the request")
    wagmi.useWriteContract.mockReturnValue(
      mockWriteContractReturn({ error: writeError })
    )
    wagmi.useWaitForTransactionReceipt.mockReturnValue(
      mockWaitForReceiptReturn({ error: new Error("Transaction reverted") })
    )

    const { result } = renderHook(() => useClaimRewards())
    expect(result.current.error).toBe(writeError)
  })

  it("returns the receipt error when there is no write error", () => {
    const receiptError = new Error("Transaction reverted")
    wagmi.useWriteContract.mockReturnValue(
      mockWriteContractReturn({ data: MOCK_TX_HASH })
    )
    wagmi.useWaitForTransactionReceipt.mockReturnValue(
      mockWaitForReceiptReturn({ error: receiptError })
    )

    const { result } = renderHook(() => useClaimRewards())
    expect(result.current.error).toBe(receiptError)
  })

  it("exposes reset function", () => {
    const { result } = renderHook(() => useClaimRewards())
    act(() => {
      result.current.reset()
    })
    expect(mockReset).toHaveBeenCalled()
  })

  it("reports isSafeQueued in a Safe App once submitted and before the receipt", () => {
    safe.isSafeApp = true
    wagmi.useWriteContract.mockReturnValue(
      mockWriteContractReturn({ data: MOCK_TX_HASH })
    )

    const { result } = renderHook(() => useClaimRewards())
    expect(result.current.isSafeQueued).toBe(true)
    expect(result.current.isSuccess).toBe(false)
  })

  it("clears isSafeQueued once the receipt succeeds", () => {
    safe.isSafeApp = true
    wagmi.useWriteContract.mockReturnValue(
      mockWriteContractReturn({ data: MOCK_TX_HASH })
    )
    wagmi.useWaitForTransactionReceipt.mockReturnValue(
      mockWaitForReceiptReturn({ isSuccess: true })
    )

    const { result } = renderHook(() => useClaimRewards())
    expect(result.current.isSafeQueued).toBe(false)
    expect(result.current.isSuccess).toBe(true)
  })

  it("does not report isSafeQueued outside a Safe App", () => {
    wagmi.useWriteContract.mockReturnValue(
      mockWriteContractReturn({ data: MOCK_TX_HASH })
    )
    wagmi.useWaitForTransactionReceipt.mockReturnValue(
      mockWaitForReceiptReturn({ isLoading: true })
    )

    const { result } = renderHook(() => useClaimRewards())
    expect(result.current.isSafeQueued).toBe(false)
    expect(result.current.isConfirmingTx).toBe(true)
  })

  it("invalidates reward queries on success", () => {
    wagmi.useWriteContract.mockReturnValue(
      mockWriteContractReturn({ data: MOCK_TX_HASH })
    )
    wagmi.useWaitForTransactionReceipt.mockReturnValue(
      mockWaitForReceiptReturn({ isSuccess: true })
    )

    renderHook(() => useClaimRewards())

    const { predicate } = mockInvalidateQueries.mock.calls[0][0]
    expect(predicate({ queryKey: ["readContract", { functionName: "cumulativeClaimed" }] })).toBe(true)
    expect(predicate({ queryKey: ["readContract", { functionName: "balanceOf" }] })).toBe(true)
    expect(predicate({ queryKey: ["readContract", { functionName: "stakes" }] })).toBe(false)
    expect(mockInvalidateQueries).toHaveBeenCalledWith({ queryKey: ["rewardProof"] })
  })
})

describe("useClaimRewards without a MerkleDrop address", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    contracts.merkleDrop = MERKLE_DROP
  })

  it("does not send a transaction from claimRewards", async () => {
    contracts.merkleDrop = undefined
    vi.resetModules()
    const freshWagmi = vi.mocked(await import("wagmi"))
    freshWagmi.useWriteContract.mockReturnValue(
      mockWriteContractReturn({ writeContract: mockWriteContract })
    )
    freshWagmi.useWaitForTransactionReceipt.mockReturnValue(
      mockWaitForReceiptReturn()
    )
    const { useClaimRewards: useClaimRewardsWithoutDrop } = await import("../useClaimRewards")

    const { result } = renderHook(() => useClaimRewardsWithoutDrop())
    act(() => {
      result.current.claimRewards(
        TEST_ACCOUNTS.validator1,
        proofArgs.cumulativeAmount,
        proofArgs.expectedMerkleRoot,
        proofArgs.merkleProof,
      )
    })

    expect(mockWriteContract).not.toHaveBeenCalled()
  })
})
