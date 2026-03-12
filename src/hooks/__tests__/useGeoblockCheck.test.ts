import { describe, it, expect, vi, beforeEach, type Mock } from "vitest"
import { renderHook } from "@testing-library/react"

const mockFetch = vi.fn()
vi.stubGlobal("fetch", mockFetch)

let capturedQueryFn: (() => Promise<unknown>) | undefined

vi.mock("@tanstack/react-query", () => ({
  useQuery: vi.fn((opts: Record<string, unknown>) => {
    capturedQueryFn = opts.queryFn as (() => Promise<unknown>) | undefined
    return { data: undefined, isLoading: true, isError: false }
  }),
}))

const { useGeoblockCheck } = await import("../useGeoblockCheck")
const reactQuery = await import("@tanstack/react-query")
const useQueryMock = reactQuery.useQuery as unknown as Mock

describe("useGeoblockCheck", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
    capturedQueryFn = undefined
  })

  describe("hook return values", () => {
    it("returns allowed=true and isLoading=true while loading", () => {
      useQueryMock.mockReturnValue({
        data: undefined,
        isLoading: true,
        isError: false,
      })

      const { result } = renderHook(() => useGeoblockCheck())

      expect(result.current.isLoading).toBe(true)
      expect(result.current.allowed).toBe(true)
    })

    it("returns allowed=true for non-blocked country", () => {
      useQueryMock.mockReturnValue({
        data: "US",
        isLoading: false,
        isError: false,
      })

      const { result } = renderHook(() => useGeoblockCheck())

      expect(result.current.isLoading).toBe(false)
      expect(result.current.allowed).toBe(true)
    })

    it("returns allowed=false for blocked country (Iran)", () => {
      useQueryMock.mockReturnValue({
        data: "IR",
        isLoading: false,
        isError: false,
      })

      const { result } = renderHook(() => useGeoblockCheck())

      expect(result.current.allowed).toBe(false)
    })

    it("returns allowed=false for blocked country (Russia)", () => {
      useQueryMock.mockReturnValue({
        data: "RU",
        isLoading: false,
        isError: false,
      })

      const { result } = renderHook(() => useGeoblockCheck())

      expect(result.current.allowed).toBe(false)
    })

    it("returns allowed=false on error (fail-closed)", () => {
      useQueryMock.mockReturnValue({
        data: undefined,
        isLoading: false,
        isError: true,
      })

      const { result } = renderHook(() => useGeoblockCheck())

      expect(result.current.allowed).toBe(false)
    })
  })

  describe("queryFn (fetchCountry)", () => {
    beforeEach(() => {
      useQueryMock.mockImplementation(
        (opts: Record<string, unknown>) => {
          capturedQueryFn = opts.queryFn as
            | (() => Promise<unknown>)
            | undefined
          return {
            data: undefined,
            isLoading: true,
            isError: false,
          }
        },
      )
      renderHook(() => useGeoblockCheck())
    })

    it("fetches from API when no cache exists", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ country: "US" }),
      })

      const country = await capturedQueryFn!()

      expect(country).toBe("US")
      expect(mockFetch).toHaveBeenCalledTimes(1)
    })

    it("returns cached country and skips fetch", async () => {
      const cached = { country: "DE", timestamp: Date.now() }
      localStorage.setItem("geoblock_check", JSON.stringify(cached))

      const country = await capturedQueryFn!()

      expect(country).toBe("DE")
      expect(mockFetch).not.toHaveBeenCalled()
    })

    it("ignores expired cache and fetches fresh data", async () => {
      const eightDaysAgo = Date.now() - 8 * 24 * 60 * 60 * 1000
      localStorage.setItem(
        "geoblock_check",
        JSON.stringify({ country: "US", timestamp: eightDaysAgo }),
      )

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ country: "FR" }),
      })

      const country = await capturedQueryFn!()

      expect(country).toBe("FR")
      expect(mockFetch).toHaveBeenCalledTimes(1)
    })

    it("writes to cache after successful fetch", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ country: "FR" }),
      })

      await capturedQueryFn!()

      const stored = JSON.parse(localStorage.getItem("geoblock_check")!)
      expect(stored.country).toBe("FR")
      expect(stored.timestamp).toBeGreaterThan(0)
    })

    it("throws on non-ok response", async () => {
      mockFetch.mockResolvedValueOnce({ ok: false, status: 500 })

      await expect(capturedQueryFn!()).rejects.toThrow("Geo lookup failed")
      expect(localStorage.getItem("geoblock_check")).toBeNull()
    })

    it("throws on network error", async () => {
      mockFetch.mockRejectedValueOnce(new Error("Network error"))

      await expect(capturedQueryFn!()).rejects.toThrow("Network error")
      expect(localStorage.getItem("geoblock_check")).toBeNull()
    })

    it("ignores corrupted cache and fetches fresh data", async () => {
      localStorage.setItem("geoblock_check", "not-valid-json")

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ country: "US" }),
      })

      const country = await capturedQueryFn!()

      expect(country).toBe("US")
      expect(mockFetch).toHaveBeenCalledTimes(1)
    })
  })

  describe("useQuery configuration", () => {
    it("passes correct query key and options", () => {
      renderHook(() => useGeoblockCheck())

      expect(useQueryMock).toHaveBeenCalledWith(
        expect.objectContaining({
          queryKey: ["geoblock"],
          retry: false,
        }),
      )
    })
  })
})
