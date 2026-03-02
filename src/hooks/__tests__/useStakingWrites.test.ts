import { describe, it, expect, vi, beforeEach } from "vitest"
import { renderHook, act } from "@testing-library/react"
import { useStake, useInitiateWithdrawal, useClaimWithdrawal, useInvalidateOnSuccess } from "../useStakingWrites"
import { TEST_ACCOUNTS, MOCK_TX_HASH } from "@/__tests__/test-data"
import { mockWriteContractReturn, mockWaitForReceiptReturn } from "@/__tests__/mock-wagmi"

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
