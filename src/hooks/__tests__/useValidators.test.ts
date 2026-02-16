import { describe, it, expect, vi, beforeEach } from "vitest"
import { renderHook } from "@testing-library/react"
import type { Address } from "viem"

const mockGetLogs = vi.fn()
const mockGetBlockNumber = vi.fn()

vi.mock("wagmi", () => ({
  usePublicClient: vi.fn(() => ({
    getLogs: mockGetLogs,
    getBlockNumber: mockGetBlockNumber,
  })),
}))

// Capture queryFn from each useQuery call so tests can invoke it directly.
let capturedQueryFn: (() => Promise<unknown>) | undefined

vi.mock("@tanstack/react-query", () => ({
  useQuery: vi.fn((opts: { queryFn?: () => Promise<unknown>; enabled?: boolean }) => {
    capturedQueryFn = opts.queryFn
    if (opts.enabled === false) return { data: undefined, isLoading: false }
    return { data: undefined, isLoading: true }
  }),
}))

vi.mock("@/config/contracts", () => ({
  getContractAddresses: () => ({
    staking: "0x6E4D214A7FA04be157b1Aae498b395bd21Da0aF5",
    token: "0xef98bcc90b1373b2ae0d23ec318d3ee70ea61af4",
  }),
  deployBlock: 5_000_000n,
}))

// Import after mocks
const { useValidators } = await import("../useValidators")
const reactQuery = vi.mocked(await import("@tanstack/react-query"))

describe("useValidators", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    capturedQueryFn = undefined
  })

  it("calls useQuery with validators key", () => {
    renderHook(() => useValidators())

    expect(reactQuery.useQuery).toHaveBeenCalledWith(
      expect.objectContaining({
        queryKey: ["validators", "0x6E4D214A7FA04be157b1Aae498b395bd21Da0aF5"],
        enabled: true,
      })
    )
  })

  it("queryFn parses ValidatorUpdated events and sorts active first", async () => {
    const mockLogs = [
      { args: { validator: "0xaaa" as Address, isRegistered: false } },
      { args: { validator: "0xbbb" as Address, isRegistered: true } },
      { args: { validator: "0xccc" as Address, isRegistered: true } },
    ]
    mockGetLogs.mockResolvedValue(mockLogs)

    renderHook(() => useValidators())

    expect(capturedQueryFn).toBeDefined()
    const result = await capturedQueryFn!()

    expect(result).toEqual([
      { address: "0xbbb", isActive: true },
      { address: "0xccc", isActive: true },
      { address: "0xaaa", isActive: false },
    ])
  })

  it("queryFn falls back to chunked fetching on error", async () => {
    mockGetLogs
      .mockRejectedValueOnce(new Error("block range too large"))
      .mockResolvedValue([])
    mockGetBlockNumber.mockResolvedValue(5_100_000n)

    renderHook(() => useValidators())

    expect(capturedQueryFn).toBeDefined()
    const result = await capturedQueryFn!()
    expect(result).toEqual([])
    // First call fails (full range), then chunked calls happen
    expect(mockGetLogs.mock.calls.length).toBeGreaterThan(1)
    expect(mockGetBlockNumber).toHaveBeenCalled()
  })

  it("queryFn handles duplicate validator events (last event wins)", async () => {
    const mockLogs = [
      { args: { validator: "0xaaa" as Address, isRegistered: true } },
      { args: { validator: "0xaaa" as Address, isRegistered: false } }, // later event deactivates
    ]
    mockGetLogs.mockResolvedValue(mockLogs)

    renderHook(() => useValidators())

    expect(capturedQueryFn).toBeDefined()
    const result = await capturedQueryFn!()
    expect(result).toEqual([{ address: "0xaaa", isActive: false }])
  })

  it("queryFn returns empty array when no events", async () => {
    mockGetLogs.mockResolvedValue([])

    renderHook(() => useValidators())

    expect(capturedQueryFn).toBeDefined()
    const result = await capturedQueryFn!()
    expect(result).toEqual([])
  })
})
