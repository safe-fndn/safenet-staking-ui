import { describe, it, expect, vi, beforeEach } from "vitest"
import { renderHook, act } from "@testing-library/react"
import { useTokenAllowance } from "../useTokenAllowance"
import { AMOUNTS } from "@/__tests__/test-data"
import { mockWriteContractReturn, mockReadContractReturn, mockWaitForReceiptReturn } from "@/__tests__/mock-wagmi"

const mockWriteContract = vi.fn()
const mockReset = vi.fn()

vi.mock("wagmi", () => ({
  useReadContract: vi.fn(() => ({
    data: undefined,
    refetch: vi.fn(),
  })),
  useAccount: vi.fn(() => ({
    address: "0x1111111111111111111111111111111111111111",
  })),
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
}))

const mockInvalidateQueries = vi.fn()
vi.mock("@/config/queryClient", () => ({
  queryClient: {
    invalidateQueries: (...args: unknown[]) => mockInvalidateQueries(...args),
  },
}))

const wagmi = vi.mocked(await import("wagmi"))

describe("useTokenAllowance", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("returns allowance from read contract", () => {
    wagmi.useReadContract.mockReturnValue(
      mockReadContractReturn({ data: 500n * 10n ** 18n })
    )

    const { result } = renderHook(() => useTokenAllowance())
    expect(result.current.allowance).toBe(500n * 10n ** 18n)
  })

  it("returns undefined allowance when disconnected", () => {
    wagmi.useReadContract.mockReturnValue(
      mockReadContractReturn()
    )

    const { result } = renderHook(() => useTokenAllowance())
    expect(result.current.allowance).toBeUndefined()
  })

  it("calls approve with exact amount", () => {
    const { result } = renderHook(() => useTokenAllowance())

    act(() => {
      result.current.approve(100n * 10n ** 18n)
    })

    expect(mockWriteContract).toHaveBeenCalledWith(
      expect.objectContaining({
        functionName: "approve",
        args: expect.arrayContaining([100n * 10n ** 18n]),
      })
    )
  })

  it("calls approveUnlimited with max uint256", () => {
    const { result } = renderHook(() => useTokenAllowance())

    act(() => {
      result.current.approveUnlimited()
    })

    expect(mockWriteContract).toHaveBeenCalledWith(
      expect.objectContaining({
        functionName: "approve",
        args: expect.arrayContaining([AMOUNTS.unlimitedAllowance]),
      })
    )
  })

  it("reflects signing state", () => {
    wagmi.useWriteContract.mockReturnValue(
      mockWriteContractReturn({
        writeContract: mockWriteContract,
        isPending: true,
        reset: mockReset,
      })
    )

    const { result } = renderHook(() => useTokenAllowance())
    expect(result.current.isSigningApproval).toBe(true)
  })

  it("reflects confirming state", () => {
    wagmi.useWaitForTransactionReceipt.mockReturnValue(
      mockWaitForReceiptReturn({ isLoading: true })
    )

    const { result } = renderHook(() => useTokenAllowance())
    expect(result.current.isConfirmingApproval).toBe(true)
  })

  it("reflects approved state and invalidates only allowance queries", () => {
    wagmi.useWaitForTransactionReceipt.mockReturnValue(
      mockWaitForReceiptReturn({ isSuccess: true })
    )

    renderHook(() => useTokenAllowance())
    expect(mockInvalidateQueries).toHaveBeenCalledTimes(1)
    expect(mockInvalidateQueries).toHaveBeenCalledWith(
      expect.objectContaining({ predicate: expect.any(Function) })
    )

    const { predicate } = mockInvalidateQueries.mock.calls[0][0]
    expect(predicate({
      queryKey: ["readContract", { functionName: "allowance" }],
    })).toBe(true)
    expect(predicate({
      queryKey: ["readContract", { functionName: "balanceOf" }],
    })).toBe(false)
    expect(predicate({
      queryKey: ["readContracts", { contracts: [] }],
    })).toBe(false)
  })

  it("exposes approval error", () => {
    const error = new Error("User rejected")
    wagmi.useWriteContract.mockReturnValue(
      mockWriteContractReturn({
        writeContract: mockWriteContract,
        reset: mockReset,
        error,
      })
    )

    const { result } = renderHook(() => useTokenAllowance())
    expect(result.current.approvalError).toBe(error)
  })

  it("exposes resetApproval", () => {
    const { result } = renderHook(() => useTokenAllowance())
    act(() => {
      result.current.resetApproval()
    })
    expect(mockReset).toHaveBeenCalled()
  })
})
