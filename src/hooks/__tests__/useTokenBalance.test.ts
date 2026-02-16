import { describe, it, expect, vi, beforeEach } from "vitest"
import { renderHook } from "@testing-library/react"
import { useTokenBalance } from "../useTokenBalance"
import { TEST_ACCOUNTS, AMOUNTS } from "@/__tests__/test-data"

const mockUseReadContract = vi.fn()
const mockUseAccount = vi.fn()

vi.mock("wagmi", () => ({
  useReadContract: (...args: unknown[]) => mockUseReadContract(...args),
  useAccount: () => mockUseAccount(),
}))

describe("useTokenBalance", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockUseReadContract.mockReturnValue({ data: undefined, isLoading: false })
    mockUseAccount.mockReturnValue({ address: TEST_ACCOUNTS.user })
  })

  it("calls useReadContract with balanceOf and user address", () => {
    renderHook(() => useTokenBalance())

    expect(mockUseReadContract).toHaveBeenCalledWith(
      expect.objectContaining({
        functionName: "balanceOf",
        args: [TEST_ACCOUNTS.user],
        query: expect.objectContaining({ enabled: true }),
      })
    )
  })

  it("disables query when no address is connected", () => {
    mockUseAccount.mockReturnValue({ address: undefined })

    renderHook(() => useTokenBalance())

    expect(mockUseReadContract).toHaveBeenCalledWith(
      expect.objectContaining({
        functionName: "balanceOf",
        query: expect.objectContaining({ enabled: false }),
      })
    )
  })

  it("returns balance as bigint", () => {
    mockUseReadContract.mockReturnValue({ data: AMOUNTS.userBalance, isLoading: false })

    const { result } = renderHook(() => useTokenBalance())

    expect(result.current.data).toBe(AMOUNTS.userBalance)
  })
})
