import { describe, it, expect, vi, beforeEach } from "vitest"
import { renderHook, act } from "@testing-library/react"
import { decodeFunctionData, getAddress, type Hex } from "viem"
import {
  useStake,
  useInitiateWithdrawal,
  useClaimWithdrawal,
  useInvalidateOnSuccess,
  useBatchStake,
  useBatchClaimWithdrawals,
  useBatchClaimAndStake,
} from "../useStakingWrites"
import { stakingAbi } from "@/abi/stakingAbi"
import { erc20Abi } from "@/abi/erc20Abi"
import { merkleDropAbi } from "@/abi/merkleDropAbi"
import { activeChain } from "@/config/chains"
import { TEST_ACCOUNTS, MOCK_TX_HASH } from "@/__tests__/test-data"
import { mockWriteContractReturn, mockWaitForReceiptReturn } from "@/__tests__/mock-wagmi"

const { STAKING, TOKEN, MERKLE_DROP } = vi.hoisted(() => ({
  STAKING: "0x0000000000000000000000000000000000000001",
  TOKEN: "0x0000000000000000000000000000000000000002",
  MERKLE_DROP: "0x0000000000000000000000000000000000000003",
}))

vi.mock("@/config/contracts", () => ({
  getContractAddresses: () => ({
    staking: STAKING,
    token: TOKEN,
    merkleDrop: MERKLE_DROP,
  }),
}))

// Mock wagmi
const mockWriteContract = vi.fn()
const mockReset = vi.fn()

vi.mock("wagmi", () => ({
  useWriteContract: vi.fn(() => ({
    writeContract: mockWriteContract,
    data: undefined as `0x${string}` | undefined,
    isPending: false,
    reset: mockReset,
    error: null,
  })),
  useWaitForTransactionReceipt: vi.fn(() => ({
    isLoading: false,
    isSuccess: false,
    error: null,
  })),
  useSendCalls: vi.fn(() => ({
    mutate: vi.fn(),
    data: undefined,
    isPending: false,
    error: null,
    reset: vi.fn(),
  })),
  useCallsStatus: vi.fn(() => ({
    data: undefined,
  })),
  useCapabilities: vi.fn(() => ({
    data: undefined,
    isError: false,
  })),
}))

// Mock queryClient
const mockInvalidateQueries = vi.fn()
vi.mock("@/config/queryClient", () => ({
  queryClient: {
    invalidateQueries: (...args: unknown[]) => mockInvalidateQueries(...args),
  },
}))

const wagmi = vi.mocked(await import("wagmi"))

describe("useStake", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("returns idle state initially", () => {
    const { result } = renderHook(() => useStake())

    expect(result.current.isSigningTx).toBe(false)
    expect(result.current.isConfirmingTx).toBe(false)
    expect(result.current.isSuccess).toBe(false)
    expect(result.current.error).toBeNull()
    expect(result.current.txHash).toBeUndefined()
  })

  it("calls writeContract with correct args when stake() is called", () => {
    const { result } = renderHook(() => useStake())

    act(() => {
      result.current.stake(TEST_ACCOUNTS.validator1, 100n * 10n ** 18n)
    })

    expect(mockWriteContract).toHaveBeenCalledWith(
      expect.objectContaining({
        functionName: "stake",
        args: [TEST_ACCOUNTS.validator1, 100n * 10n ** 18n],
      })
    )
  })

  it("reflects signing state when isPending is true", () => {
    wagmi.useWriteContract.mockReturnValue(
      mockWriteContractReturn({
        writeContract: mockWriteContract,
        isPending: true,
        reset: mockReset,
      })
    )

    const { result } = renderHook(() => useStake())
    expect(result.current.isSigningTx).toBe(true)
    expect(result.current.isConfirmingTx).toBe(false)
  })

  it("reflects confirming state when tx hash exists and waiting", () => {
    wagmi.useWriteContract.mockReturnValue(
      mockWriteContractReturn({
        writeContract: mockWriteContract,
        data: MOCK_TX_HASH,
        reset: mockReset,
      })
    )

    wagmi.useWaitForTransactionReceipt.mockReturnValue(
      mockWaitForReceiptReturn({ isLoading: true })
    )

    const { result } = renderHook(() => useStake())
    expect(result.current.isSigningTx).toBe(false)
    expect(result.current.isConfirmingTx).toBe(true)
    expect(result.current.txHash).toBe(MOCK_TX_HASH)
  })

  it("reflects success state", () => {
    wagmi.useWriteContract.mockReturnValue(
      mockWriteContractReturn({
        writeContract: mockWriteContract,
        data: MOCK_TX_HASH,
        reset: mockReset,
      })
    )

    wagmi.useWaitForTransactionReceipt.mockReturnValue(
      mockWaitForReceiptReturn({ isSuccess: true })
    )

    const { result } = renderHook(() => useStake())
    expect(result.current.isSuccess).toBe(true)
    expect(result.current.isConfirmingTx).toBe(false)
  })

  it("reflects error state on user rejection", () => {
    const error = new Error("User rejected the request")
    wagmi.useWriteContract.mockReturnValue(
      mockWriteContractReturn({
        writeContract: mockWriteContract,
        reset: mockReset,
        error,
      })
    )

    const { result } = renderHook(() => useStake())
    expect(result.current.error).toBe(error)
    expect(result.current.isSigningTx).toBe(false)
  })

  it("exposes reset function", () => {
    const { result } = renderHook(() => useStake())
    act(() => {
      result.current.reset()
    })
    expect(mockReset).toHaveBeenCalled()
  })
})

describe("useInitiateWithdrawal", () => {
  beforeEach(() => {
    vi.clearAllMocks()
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

  it("returns idle state initially", () => {
    const { result } = renderHook(() => useInitiateWithdrawal())

    expect(result.current.isSigningTx).toBe(false)
    expect(result.current.isConfirmingTx).toBe(false)
    expect(result.current.isSuccess).toBe(false)
    expect(result.current.error).toBeNull()
  })

  it("calls writeContract with initiateWithdrawal", () => {
    const { result } = renderHook(() => useInitiateWithdrawal())

    act(() => {
      result.current.initiateWithdrawal(TEST_ACCOUNTS.validator1, 50n * 10n ** 18n)
    })

    expect(mockWriteContract).toHaveBeenCalledWith(
      expect.objectContaining({
        functionName: "initiateWithdrawal",
        args: [TEST_ACCOUNTS.validator1, 50n * 10n ** 18n],
      })
    )
  })

  it("reflects signing state when isPending is true", () => {
    wagmi.useWriteContract.mockReturnValue(
      mockWriteContractReturn({
        writeContract: mockWriteContract,
        isPending: true,
        reset: mockReset,
      })
    )

    const { result } = renderHook(() => useInitiateWithdrawal())
    expect(result.current.isSigningTx).toBe(true)
    expect(result.current.isConfirmingTx).toBe(false)
  })

  it("reflects confirming state when tx hash exists and waiting", () => {
    wagmi.useWriteContract.mockReturnValue(
      mockWriteContractReturn({
        writeContract: mockWriteContract,
        data: MOCK_TX_HASH,
        reset: mockReset,
      })
    )
    wagmi.useWaitForTransactionReceipt.mockReturnValue(
      mockWaitForReceiptReturn({ isLoading: true })
    )

    const { result } = renderHook(() => useInitiateWithdrawal())
    expect(result.current.isConfirmingTx).toBe(true)
    expect(result.current.txHash).toBe(MOCK_TX_HASH)
  })

  it("reflects success state", () => {
    wagmi.useWriteContract.mockReturnValue(
      mockWriteContractReturn({
        writeContract: mockWriteContract,
        data: MOCK_TX_HASH,
        reset: mockReset,
      })
    )
    wagmi.useWaitForTransactionReceipt.mockReturnValue(
      mockWaitForReceiptReturn({ isSuccess: true })
    )

    const { result } = renderHook(() => useInitiateWithdrawal())
    expect(result.current.isSuccess).toBe(true)
  })

  it("reflects error state", () => {
    const error = new Error("User rejected the request")
    wagmi.useWriteContract.mockReturnValue(
      mockWriteContractReturn({
        writeContract: mockWriteContract,
        reset: mockReset,
        error,
      })
    )

    const { result } = renderHook(() => useInitiateWithdrawal())
    expect(result.current.error).toBe(error)
  })

  it("exposes reset function", () => {
    const { result } = renderHook(() => useInitiateWithdrawal())
    act(() => {
      result.current.reset()
    })
    expect(mockReset).toHaveBeenCalled()
  })
})

describe("useClaimWithdrawal", () => {
  beforeEach(() => {
    vi.clearAllMocks()
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

  it("returns idle state initially", () => {
    const { result } = renderHook(() => useClaimWithdrawal())

    expect(result.current.isSigningTx).toBe(false)
    expect(result.current.isConfirmingTx).toBe(false)
    expect(result.current.isSuccess).toBe(false)
    expect(result.current.error).toBeNull()
  })

  it("calls writeContract with claimWithdrawal (no args)", () => {
    const { result } = renderHook(() => useClaimWithdrawal())

    act(() => {
      result.current.claimWithdrawal()
    })

    expect(mockWriteContract).toHaveBeenCalledWith(
      expect.objectContaining({
        functionName: "claimWithdrawal",
      })
    )
  })

  it("reflects signing state when isPending is true", () => {
    wagmi.useWriteContract.mockReturnValue(
      mockWriteContractReturn({
        writeContract: mockWriteContract,
        isPending: true,
        reset: mockReset,
      })
    )

    const { result } = renderHook(() => useClaimWithdrawal())
    expect(result.current.isSigningTx).toBe(true)
    expect(result.current.isConfirmingTx).toBe(false)
  })

  it("reflects confirming state when tx hash exists and waiting", () => {
    wagmi.useWriteContract.mockReturnValue(
      mockWriteContractReturn({
        writeContract: mockWriteContract,
        data: MOCK_TX_HASH,
        reset: mockReset,
      })
    )
    wagmi.useWaitForTransactionReceipt.mockReturnValue(
      mockWaitForReceiptReturn({ isLoading: true })
    )

    const { result } = renderHook(() => useClaimWithdrawal())
    expect(result.current.isConfirmingTx).toBe(true)
    expect(result.current.txHash).toBe(MOCK_TX_HASH)
  })

  it("reflects success state", () => {
    wagmi.useWriteContract.mockReturnValue(
      mockWriteContractReturn({
        writeContract: mockWriteContract,
        data: MOCK_TX_HASH,
        reset: mockReset,
      })
    )
    wagmi.useWaitForTransactionReceipt.mockReturnValue(
      mockWaitForReceiptReturn({ isSuccess: true })
    )

    const { result } = renderHook(() => useClaimWithdrawal())
    expect(result.current.isSuccess).toBe(true)
  })

  it("reflects error state", () => {
    const error = new Error("Transaction reverted")
    wagmi.useWriteContract.mockReturnValue(
      mockWriteContractReturn({
        writeContract: mockWriteContract,
        reset: mockReset,
        error,
      })
    )

    const { result } = renderHook(() => useClaimWithdrawal())
    expect(result.current.error).toBe(error)
  })

  it("exposes reset function", () => {
    const { result } = renderHook(() => useClaimWithdrawal())
    act(() => {
      result.current.reset()
    })
    expect(mockReset).toHaveBeenCalled()
  })
})

describe("useInvalidateOnSuccess", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("does not invalidate when isSuccess is false", () => {
    renderHook(() => useInvalidateOnSuccess(false, ["balanceOf"]))
    expect(mockInvalidateQueries).not.toHaveBeenCalled()
  })

  it("invalidates matching readContract queries on success", () => {
    renderHook(() => useInvalidateOnSuccess(true, ["balanceOf"]))
    expect(mockInvalidateQueries).toHaveBeenCalledWith(
      expect.objectContaining({ predicate: expect.any(Function) })
    )

    const { predicate } = mockInvalidateQueries.mock.calls[0][0]
    expect(predicate({
      queryKey: ["readContract", { functionName: "balanceOf" }],
    })).toBe(true)
    expect(predicate({
      queryKey: ["readContract", { functionName: "totalStaked" }],
    })).toBe(false)
  })

  it("matches readContracts queries containing target function names", () => {
    renderHook(() => useInvalidateOnSuccess(true, ["stakes"]))

    const { predicate } = mockInvalidateQueries.mock.calls[0][0]
    expect(predicate({
      queryKey: [
        "readContracts",
        { contracts: [{ functionName: "stakes" }] },
      ],
    })).toBe(true)
    expect(predicate({
      queryKey: [
        "readContracts",
        { contracts: [{ functionName: "other" }] },
      ],
    })).toBe(false)
  })

  it("does not match unrelated query keys", () => {
    renderHook(() => useInvalidateOnSuccess(true, ["balanceOf"]))

    const { predicate } = mockInvalidateQueries.mock.calls[0][0]
    expect(predicate({ queryKey: ["validators"] })).toBe(false)
    expect(predicate({ queryKey: ["balance"] })).toBe(false)
  })

  it("invalidates extra keys on success", () => {
    renderHook(() =>
      useInvalidateOnSuccess(true, ["balanceOf"], [["validators"]])
    )
    expect(mockInvalidateQueries).toHaveBeenCalledWith(
      { queryKey: ["validators"] }
    )
  })
})

// Helpers for the EIP-5792 batch hooks

function mockCapabilities(data: unknown, isError = false) {
  wagmi.useCapabilities.mockReturnValue({ data, isError } as ReturnType<typeof wagmi.useCapabilities>)
}

function mockSendCalls(
  overrides: {
    id?: string
    isPending?: boolean
    error?: Error | null
    reset?: ReturnType<typeof vi.fn>
  } = {},
) {
  const mutate = vi.fn()
  wagmi.useSendCalls.mockReturnValue({
    mutate,
    data: overrides.id ? { id: overrides.id } : undefined,
    isPending: overrides.isPending ?? false,
    error: overrides.error ?? null,
    reset: overrides.reset ?? vi.fn(),
  } as unknown as ReturnType<typeof wagmi.useSendCalls>)
  return mutate
}

function mockCallsStatus(data: unknown) {
  wagmi.useCallsStatus.mockReturnValue({ data } as unknown as ReturnType<typeof wagmi.useCallsStatus>)
}

function resetBatchMocks() {
  vi.clearAllMocks()
  mockCapabilities(undefined)
  mockSendCalls()
  mockCallsStatus(undefined)
}

function readContractKey(functionName: string) {
  return { queryKey: ["readContract", { functionName }] }
}

describe.each([
  ["useBatchStake", useBatchStake],
  ["useBatchClaimWithdrawals", useBatchClaimWithdrawals],
  ["useBatchClaimAndStake", useBatchClaimAndStake],
])("%s shared batch state", (_name, useHook) => {
  beforeEach(resetBatchMocks)

  it("reports supportsBatching true when the wallet supports atomic batches on the active chain", () => {
    mockCapabilities({ [activeChain.id]: { atomicBatch: { supported: true } } })

    const { result } = renderHook(() => useHook())
    expect(result.current.supportsBatching).toBe(true)
  })

  it("reports supportsBatching false when atomic batches are not supported", () => {
    mockCapabilities({ [activeChain.id]: { atomicBatch: { supported: false } } })

    const { result } = renderHook(() => useHook())
    expect(result.current.supportsBatching).toBe(false)
  })

  it("reports supportsBatching false when only another chain supports atomic batches", () => {
    mockCapabilities({ [activeChain.id + 1]: { atomicBatch: { supported: true } } })

    const { result } = renderHook(() => useHook())
    expect(result.current.supportsBatching).toBe(false)
  })

  it("reports supportsBatching false when the capabilities call errors", () => {
    mockCapabilities({ [activeChain.id]: { atomicBatch: { supported: true } } }, true)

    const { result } = renderHook(() => useHook())
    expect(result.current.supportsBatching).toBe(false)
  })

  it("returns idle state initially", () => {
    const { result } = renderHook(() => useHook())

    expect(result.current.isSigningTx).toBe(false)
    expect(result.current.isConfirmingTx).toBe(false)
    expect(result.current.isSuccess).toBe(false)
    expect(result.current.isReverted).toBe(false)
    expect(result.current.error).toBeNull()
    expect(result.current.txHash).toBeUndefined()
  })

  it("reports signing while the wallet prompt is open", () => {
    mockSendCalls({ isPending: true })

    const { result } = renderHook(() => useHook())
    expect(result.current.isSigningTx).toBe(true)
    expect(result.current.isConfirmingTx).toBe(false)
    expect(mockInvalidateQueries).not.toHaveBeenCalled()
  })

  it("returns the send error", () => {
    const error = new Error("User rejected the request")
    mockSendCalls({ error })

    const { result } = renderHook(() => useHook())
    expect(result.current.error).toBe(error)
  })

  it("exposes reset from useSendCalls", () => {
    const reset = vi.fn()
    mockSendCalls({ reset })

    const { result } = renderHook(() => useHook())
    act(() => {
      result.current.reset()
    })
    expect(reset).toHaveBeenCalledTimes(1)
  })

  it("polls calls status only once a batch id exists", () => {
    renderHook(() => useHook())
    expect(wagmi.useCallsStatus).toHaveBeenLastCalledWith(
      expect.objectContaining({ id: "", query: expect.objectContaining({ enabled: false }) }),
    )

    mockSendCalls({ id: "batch-1" })
    renderHook(() => useHook())
    expect(wagmi.useCallsStatus).toHaveBeenLastCalledWith(
      expect.objectContaining({ id: "batch-1", query: expect.objectContaining({ enabled: true }) }),
    )
  })

  it("polls every 2s until the batch succeeds or fails", () => {
    renderHook(() => useHook())
    const { refetchInterval } = wagmi.useCallsStatus.mock.lastCall![0]!.query as {
      refetchInterval: (query: { state: { data?: { status: string } } }) => number | false
    }

    expect(refetchInterval({ state: {} })).toBe(2000)
    expect(refetchInterval({ state: { data: { status: "pending" } } })).toBe(2000)
    expect(refetchInterval({ state: { data: { status: "success" } } })).toBe(false)
    expect(refetchInterval({ state: { data: { status: "failure" } } })).toBe(false)
  })

  it("reports confirming while the batch is pending", () => {
    mockSendCalls({ id: "batch-1" })
    mockCallsStatus({ status: "pending" })

    const { result } = renderHook(() => useHook())
    expect(result.current.isConfirmingTx).toBe(true)
    expect(result.current.isSuccess).toBe(false)
    expect(result.current.isReverted).toBe(false)
  })

  it("reports success and the first receipt hash", () => {
    mockSendCalls({ id: "batch-1" })
    mockCallsStatus({ status: "success", receipts: [{ transactionHash: MOCK_TX_HASH }] })

    const { result } = renderHook(() => useHook())
    expect(result.current.isConfirmingTx).toBe(false)
    expect(result.current.isSuccess).toBe(true)
    expect(result.current.txHash).toBe(MOCK_TX_HASH)
  })

  it("leaves txHash undefined on success with no receipts", () => {
    mockSendCalls({ id: "batch-1" })
    mockCallsStatus({ status: "success", receipts: [] })

    const { result } = renderHook(() => useHook())
    expect(result.current.isSuccess).toBe(true)
    expect(result.current.txHash).toBeUndefined()
  })

  it("reports reverted when the batch fails", () => {
    mockSendCalls({ id: "batch-1" })
    mockCallsStatus({ status: "failure" })

    const { result } = renderHook(() => useHook())
    expect(result.current.isConfirmingTx).toBe(false)
    expect(result.current.isSuccess).toBe(false)
    expect(result.current.isReverted).toBe(true)
  })

  it("does not invalidate while the batch is pending", () => {
    mockSendCalls({ id: "batch-1" })
    mockCallsStatus({ status: "pending" })

    renderHook(() => useHook())
    expect(mockInvalidateQueries).not.toHaveBeenCalled()
  })

  it("does not invalidate when the batch fails", () => {
    mockSendCalls({ id: "batch-1" })
    mockCallsStatus({ status: "failure" })

    renderHook(() => useHook())
    expect(mockInvalidateQueries).not.toHaveBeenCalled()
  })

  it("does not invalidate again on re-render while isSuccess stays true", () => {
    mockSendCalls({ id: "batch-1" })
    mockCallsStatus({ status: "success", receipts: [{ transactionHash: MOCK_TX_HASH }] })

    const { rerender } = renderHook(() => useHook())
    const callsAfterSuccess = mockInvalidateQueries.mock.calls.length
    expect(callsAfterSuccess).toBeGreaterThan(0)

    rerender()
    rerender()
    expect(mockInvalidateQueries).toHaveBeenCalledTimes(callsAfterSuccess)
  })
})

describe("useBatchStake", () => {
  beforeEach(resetBatchMocks)

  it("sends approve + stake (2 calls)", () => {
    const mockSendCallsFn = mockSendCalls()
    const amount = 100n * 10n ** 18n

    const { result } = renderHook(() => useBatchStake())
    act(() => {
      result.current.batchApproveAndStake(TEST_ACCOUNTS.validator1, amount)
    })

    expect(mockSendCallsFn).toHaveBeenCalledTimes(1)
    const { calls } = mockSendCallsFn.mock.calls[0][0]
    expect(calls).toHaveLength(2)

    expect(calls[0].to).toBe(TOKEN)
    expect(decodeFunctionData({ abi: erc20Abi, data: calls[0].data })).toEqual({
      functionName: "approve",
      args: [STAKING, amount],
    })

    expect(calls[1].to).toBe(STAKING)
    expect(decodeFunctionData({ abi: stakingAbi, data: calls[1].data })).toEqual({
      functionName: "stake",
      args: [getAddress(TEST_ACCOUNTS.validator1), amount],
    })
  })

  it("invalidates staking queries on success", () => {
    mockSendCalls({ id: "batch-1" })
    mockCallsStatus({ status: "success", receipts: [{ transactionHash: MOCK_TX_HASH }] })

    renderHook(() => useBatchStake())

    const { predicate } = mockInvalidateQueries.mock.calls[0][0]
    expect(predicate(readContractKey("totalStakedAmount"))).toBe(true)
    expect(predicate(readContractKey("allowance"))).toBe(true)
    expect(predicate(readContractKey("cumulativeClaimed"))).toBe(false)
    expect(mockInvalidateQueries).toHaveBeenCalledWith({ queryKey: ["validators"] })
    expect(mockInvalidateQueries).not.toHaveBeenCalledWith({ queryKey: ["rewardProof"] })
  })
})

describe("useBatchClaimWithdrawals", () => {
  beforeEach(resetBatchMocks)

  it("sends one claimWithdrawal call per withdrawal", () => {
    const mockSendCallsFn = mockSendCalls()

    const { result } = renderHook(() => useBatchClaimWithdrawals())
    act(() => {
      result.current.batchClaimWithdrawals(3)
    })

    expect(mockSendCallsFn).toHaveBeenCalledTimes(1)
    const { calls } = mockSendCallsFn.mock.calls[0][0]
    expect(calls).toHaveLength(3)
    for (const call of calls as { to: string; data: Hex }[]) {
      expect(call.to).toBe(STAKING)
      expect(decodeFunctionData({ abi: stakingAbi, data: call.data }).functionName).toBe("claimWithdrawal")
    }
  })

  it("invalidates staking queries on success", () => {
    mockSendCalls({ id: "batch-1" })
    mockCallsStatus({ status: "success", receipts: [{ transactionHash: MOCK_TX_HASH }] })

    renderHook(() => useBatchClaimWithdrawals())

    const { predicate } = mockInvalidateQueries.mock.calls[0][0]
    expect(predicate(readContractKey("getPendingWithdrawals"))).toBe(true)
    expect(predicate(readContractKey("cumulativeClaimed"))).toBe(false)
    expect(mockInvalidateQueries).toHaveBeenCalledWith({ queryKey: ["validators"] })
  })
})

describe("useBatchClaimAndStake", () => {
  const proofArgs = {
    account: TEST_ACCOUNTS.user,
    cumulativeAmount: 100n * 10n ** 18n,
    expectedMerkleRoot: ("0x" + "1".repeat(64)) as Hex,
    merkleProof: [("0x" + "2".repeat(64)) as Hex],
  }
  // Differs from cumulativeAmount so the stake and approve args are checked on their own
  const amount = 40n * 10n ** 18n

  const expectedClaim = {
    functionName: "claim",
    args: [
      getAddress(proofArgs.account),
      proofArgs.cumulativeAmount,
      proofArgs.expectedMerkleRoot,
      proofArgs.merkleProof,
    ],
  }
  const expectedStake = {
    functionName: "stake",
    args: [getAddress(TEST_ACCOUNTS.validator1), amount],
  }

  beforeEach(resetBatchMocks)

  /** Calls batchClaimAndStake once and returns the calls sent to the wallet. */
  function sendClaimAndStake(needsApproval: boolean) {
    const mockSendCallsFn = mockSendCalls()

    const { result } = renderHook(() => useBatchClaimAndStake())
    act(() => {
      result.current.batchClaimAndStake(
        proofArgs.account,
        proofArgs.cumulativeAmount,
        proofArgs.expectedMerkleRoot,
        proofArgs.merkleProof,
        TEST_ACCOUNTS.validator1,
        amount,
        needsApproval,
      )
    })

    expect(mockSendCallsFn).toHaveBeenCalledTimes(1)
    return mockSendCallsFn.mock.calls[0][0].calls as { to: string; data: Hex }[]
  }

  it("sends claim + stake (2 calls) when approval is not needed", () => {
    const calls = sendClaimAndStake(false)
    expect(calls).toHaveLength(2)

    expect(calls[0].to).toBe(MERKLE_DROP)
    expect(decodeFunctionData({ abi: merkleDropAbi, data: calls[0].data })).toEqual(expectedClaim)

    expect(calls[1].to).toBe(STAKING)
    expect(decodeFunctionData({ abi: stakingAbi, data: calls[1].data })).toEqual(expectedStake)
  })

  it("sends claim + approve + stake (3 calls) when approval is needed", () => {
    const calls = sendClaimAndStake(true)
    expect(calls).toHaveLength(3)

    expect(calls[0].to).toBe(MERKLE_DROP)
    expect(decodeFunctionData({ abi: merkleDropAbi, data: calls[0].data })).toEqual(expectedClaim)

    expect(calls[1].to).toBe(TOKEN)
    expect(decodeFunctionData({ abi: erc20Abi, data: calls[1].data })).toEqual({
      functionName: "approve",
      args: [STAKING, amount],
    })

    expect(calls[2].to).toBe(STAKING)
    expect(decodeFunctionData({ abi: stakingAbi, data: calls[2].data })).toEqual(expectedStake)
  })

  it("invalidates both reward and staking queries on success", () => {
    mockSendCalls({ id: "batch-1" })
    mockCallsStatus({ status: "success", receipts: [{ transactionHash: MOCK_TX_HASH }] })

    renderHook(() => useBatchClaimAndStake())

    const { predicate } = mockInvalidateQueries.mock.calls[0][0]
    expect(predicate(readContractKey("cumulativeClaimed"))).toBe(true)
    expect(predicate(readContractKey("totalStakedAmount"))).toBe(true)
    expect(predicate(readContractKey("stakes"))).toBe(true)
    expect(predicate(readContractKey("balanceOf"))).toBe(true)
    expect(predicate(readContractKey("merkleRoot"))).toBe(false)
    expect(mockInvalidateQueries).toHaveBeenCalledWith({ queryKey: ["rewardProof"] })
    expect(mockInvalidateQueries).toHaveBeenCalledWith({ queryKey: ["validators"] })
  })
})
