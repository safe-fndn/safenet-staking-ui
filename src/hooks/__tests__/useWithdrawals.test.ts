import { describe, it, expect, vi, beforeEach } from "vitest"
import { renderHook } from "@testing-library/react"
import { usePendingWithdrawals, useNextClaimable } from "../useWithdrawals"
import { TEST_ACCOUNTS } from "@/__tests__/test-data"

const mockUseReadContract = vi.fn()
const mockUseAccount = vi.fn()

vi.mock("wagmi", () => ({
  useReadContract: (...args: unknown[]) => mockUseReadContract(...args),
  useAccount: () => mockUseAccount(),
}))

describe("usePendingWithdrawals", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockUseReadContract.mockReturnValue({ data: undefined, isLoading: false })
    mockUseAccount.mockReturnValue({ address: TEST_ACCOUNTS.user })
  })

  it("calls useReadContract with getPendingWithdrawals", () => {
    renderHook(() => usePendingWithdrawals())

    expect(mockUseReadContract).toHaveBeenCalledWith(
      expect.objectContaining({
        functionName: "getPendingWithdrawals",
        args: [TEST_ACCOUNTS.user],
        query: expect.objectContaining({ enabled: true }),
      })
    )
  })

  it("disables query when no address is connected", () => {
    mockUseAccount.mockReturnValue({ address: undefined })

    renderHook(() => usePendingWithdrawals())

    expect(mockUseReadContract).toHaveBeenCalledWith(
      expect.objectContaining({
        functionName: "getPendingWithdrawals",
        query: expect.objectContaining({ enabled: false }),
      })
    )
  })

  it("returns data from useReadContract", () => {
    const mockWithdrawals = [
      { amount: 50n * 10n ** 18n, claimableAt: 1700000000n },
    ]
    mockUseReadContract.mockReturnValue({ data: mockWithdrawals, isLoading: false })

    const { result } = renderHook(() => usePendingWithdrawals())

    expect(result.current.data).toEqual(mockWithdrawals)
  })
})

describe("useNextClaimable", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockUseReadContract.mockReturnValue({ data: undefined, isLoading: false })
    mockUseAccount.mockReturnValue({ address: TEST_ACCOUNTS.user })
  })

  it("calls useReadContract with getNextClaimableWithdrawal", () => {
    renderHook(() => useNextClaimable())

    expect(mockUseReadContract).toHaveBeenCalledWith(
      expect.objectContaining({
        functionName: "getNextClaimableWithdrawal",
        args: [TEST_ACCOUNTS.user],
        query: expect.objectContaining({ enabled: true }),
      })
    )
  })

  it("disables query when no address", () => {
    mockUseAccount.mockReturnValue({ address: undefined })

    renderHook(() => useNextClaimable())

    expect(mockUseReadContract).toHaveBeenCalledWith(
      expect.objectContaining({
        functionName: "getNextClaimableWithdrawal",
        query: expect.objectContaining({ enabled: false }),
      })
    )
  })

  it("returns next claimable data", () => {
    const claimableData = [100n * 10n ** 18n, 1700000000n] as const
    mockUseReadContract.mockReturnValue({ data: claimableData, isLoading: false })

    const { result } = renderHook(() => useNextClaimable())

    expect(result.current.data).toEqual(claimableData)
  })
})
