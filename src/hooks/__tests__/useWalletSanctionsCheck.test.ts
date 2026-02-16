import { describe, it, expect, vi, beforeEach } from "vitest"
import { renderHook } from "@testing-library/react"
import { TEST_ACCOUNTS } from "@/__tests__/test-data"
import type { Address } from "viem"

const mockUseReadContract = vi.fn()
const mockUseAccount = vi.fn()

vi.mock("wagmi", () => ({
  useReadContract: (...args: unknown[]) => mockUseReadContract(...args),
  useAccount: () => mockUseAccount(),
}))

const MOCK_ORACLE = "0x40C57923924B5c5c5455c48D93317139ADDaC8fb" as Address

vi.mock("@/config/contracts", () => ({
  getContractAddresses: () => ({
    staking: "0x0000000000000000000000000000000000000001" as Address,
    token: "0x0000000000000000000000000000000000000002" as Address,
    sanctionsOracle: MOCK_ORACLE,
  }),
}))

// Must import after mocks
const { useWalletSanctionsCheck } = await import("../useWalletSanctionsCheck")

describe("useWalletSanctionsCheck", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockUseReadContract.mockReturnValue({ data: undefined, isLoading: false })
  })

  it("returns allowed=true when no wallet is connected", () => {
    mockUseAccount.mockReturnValue({ address: undefined })

    const { result } = renderHook(() => useWalletSanctionsCheck())

    expect(result.current.allowed).toBe(true)
    expect(result.current.isLoading).toBe(false)
  })

  it("returns allowed=true when oracle returns false (not sanctioned)", () => {
    mockUseAccount.mockReturnValue({ address: TEST_ACCOUNTS.user })
    mockUseReadContract.mockReturnValue({ data: false, isLoading: false })

    const { result } = renderHook(() => useWalletSanctionsCheck())

    expect(result.current.allowed).toBe(true)
  })

  it("returns allowed=false when oracle returns true (sanctioned)", () => {
    mockUseAccount.mockReturnValue({ address: TEST_ACCOUNTS.user })
    mockUseReadContract.mockReturnValue({ data: true, isLoading: false })

    const { result } = renderHook(() => useWalletSanctionsCheck())

    expect(result.current.allowed).toBe(false)
  })

  it("returns isLoading=true while oracle is loading", () => {
    mockUseAccount.mockReturnValue({ address: TEST_ACCOUNTS.user })
    mockUseReadContract.mockReturnValue({ data: undefined, isLoading: true })

    const { result } = renderHook(() => useWalletSanctionsCheck())

    expect(result.current.isLoading).toBe(true)
  })

  it("calls useReadContract with isSanctioned function", () => {
    mockUseAccount.mockReturnValue({ address: TEST_ACCOUNTS.user })

    renderHook(() => useWalletSanctionsCheck())

    expect(mockUseReadContract).toHaveBeenCalledWith(
      expect.objectContaining({
        functionName: "isSanctioned",
        args: [TEST_ACCOUNTS.user],
        query: expect.objectContaining({ enabled: true }),
      })
    )
  })
})
