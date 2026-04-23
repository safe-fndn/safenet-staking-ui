import { describe, it, expect, vi, beforeEach, type Mock } from "vitest"
import { renderHook } from "@testing-library/react"
import type { Address } from "viem"

const mockFetch = vi.fn()
vi.stubGlobal("fetch", mockFetch)

let capturedOptions:
  | {
      queryKey?: unknown[]
      queryFn?: () => Promise<unknown>
      staleTime?: number
      retry?: boolean
    }
  | undefined

vi.mock("@tanstack/react-query", () => ({
  useQuery: vi.fn((opts: Record<string, unknown>) => {
    capturedOptions = opts as typeof capturedOptions
    return { data: undefined }
  }),
}))

describe("useKycRequired", () => {
  let useKycRequired: (address: Address | undefined) => boolean
  let useQueryMock: Mock

  beforeEach(async () => {
    vi.clearAllMocks()
    vi.resetModules()
    capturedOptions = undefined
    ;({ useKycRequired } = await import("../useKycRequired"))
    const reactQuery = await import("@tanstack/react-query")
    useQueryMock = reactQuery.useQuery as unknown as Mock
  })

  it("returns false when no address is provided", () => {
    useQueryMock.mockReturnValue({ data: ["0xabc"] })

    const { result } = renderHook(() => useKycRequired(undefined))

    expect(result.current).toBe(false)
  })

  it("returns false when list has not loaded yet", () => {
    useQueryMock.mockReturnValue({ data: undefined })

    const { result } = renderHook(() =>
      useKycRequired("0xABC" as Address),
    )

    expect(result.current).toBe(false)
  })

  it("returns true when address is in the KYC list (case-insensitive)", () => {
    useQueryMock.mockReturnValue({
      data: [
        "0xabcdef1234567890abcdef1234567890abcdef12",
        "0x0000000000000000000000000000000000000001",
      ],
    })

    const { result } = renderHook(() =>
      useKycRequired("0xAbCdEf1234567890AbCdEf1234567890AbCdEf12" as Address),
    )

    expect(result.current).toBe(true)
  })

  it("returns false when address is not in the KYC list", () => {
    useQueryMock.mockReturnValue({
      data: ["0x2222222222222222222222222222222222222222"],
    })

    const { result } = renderHook(() =>
      useKycRequired("0x1111111111111111111111111111111111111111" as Address),
    )

    expect(result.current).toBe(false)
  })

  describe("queryFn", () => {
    beforeEach(() => {
      useQueryMock.mockImplementation((opts: Record<string, unknown>) => {
        capturedOptions = opts as typeof capturedOptions
        return { data: undefined }
      })
      renderHook(() => useKycRequired("0x1234" as Address))
    })

    it("fetches and returns the address list", async () => {
      const list = ["0xabc", "0xdef"]
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => list,
      })

      const result = await capturedOptions!.queryFn!()

      expect(result).toEqual(list)
    })

    it("throws on non-ok response (fail-open via retry:false)", async () => {
      mockFetch.mockResolvedValueOnce({ ok: false, status: 404 })

      await expect(capturedOptions!.queryFn!()).rejects.toThrow(
        "KYC required fetch failed: 404",
      )
    })

    it("throws when response is not an array", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ addresses: ["0xabc"] }),
      })

      await expect(capturedOptions!.queryFn!()).rejects.toThrow(
        "Invalid KYC required data format",
      )
    })

    it("filters out non-string entries", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ["0xabc", 42, null, "0xdef"],
      })

      const result = await capturedOptions!.queryFn!()

      expect(result).toEqual(["0xabc", "0xdef"])
    })
  })

  describe("query configuration", () => {
    it("uses correct query key, staleTime and retry", () => {
      renderHook(() => useKycRequired("0x1234" as Address))

      expect(useQueryMock).toHaveBeenCalledWith(
        expect.objectContaining({
          queryKey: ["kycRequired"],
          staleTime: 5 * 60_000,
          retry: false,
        }),
      )
    })
  })
})
