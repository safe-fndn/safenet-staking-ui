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

vi.mock("@tanstack/react-query", () => ({
  useQuery: vi.fn(({ queryFn, enabled }: { queryFn: () => Promise<unknown>; enabled: boolean }) => {
    if (!enabled) return { data: undefined, isLoading: false }

    let data: unknown
    let error: unknown
    let isLoading = true

    const promise = queryFn()
      .then((result) => { data = result; isLoading = false })
      .catch((err) => { error = err; isLoading = false })

    // For sync test assertions, we need to handle the async nature
    // Return a function that resolves
    return { data, error, isLoading, _promise: promise }
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

    // Capture the queryFn
    let capturedQueryFn: (() => Promise<unknown>) | undefined
    reactQuery.useQuery.mockImplementation(({ queryFn }: { queryFn: () => Promise<unknown> }) => {
      capturedQueryFn = queryFn
      return { data: undefined, isLoading: true } as ReturnType<typeof reactQuery.useQuery>
    })

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

    let capturedQueryFn: (() => Promise<unknown>) | undefined
    reactQuery.useQuery.mockImplementation(({ queryFn }: { queryFn: () => Promise<unknown> }) => {
      capturedQueryFn = queryFn
      return { data: undefined, isLoading: true } as ReturnType<typeof reactQuery.useQuery>
    })

    renderHook(() => useValidators())

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

    let capturedQueryFn: (() => Promise<unknown>) | undefined
    reactQuery.useQuery.mockImplementation(({ queryFn }: { queryFn: () => Promise<unknown> }) => {
      capturedQueryFn = queryFn
      return { data: undefined, isLoading: true } as ReturnType<typeof reactQuery.useQuery>
    })

    renderHook(() => useValidators())

    const result = await capturedQueryFn!()
    expect(result).toEqual([{ address: "0xaaa", isActive: false }])
  })

  it("queryFn returns empty array when no events", async () => {
    mockGetLogs.mockResolvedValue([])

    let capturedQueryFn: (() => Promise<unknown>) | undefined
    reactQuery.useQuery.mockImplementation(({ queryFn }: { queryFn: () => Promise<unknown> }) => {
      capturedQueryFn = queryFn
      return { data: undefined, isLoading: true } as ReturnType<typeof reactQuery.useQuery>
    })

    renderHook(() => useValidators())

    const result = await capturedQueryFn!()
    expect(result).toEqual([])
  })
})
