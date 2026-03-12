import { describe, it, expect, vi, beforeEach, type Mock } from "vitest"
import { renderHook } from "@testing-library/react"

const mockFetch = vi.fn()
vi.stubGlobal("fetch", mockFetch)

let capturedOptions:
  | {
      queryFn?: () => Promise<unknown>
      enabled?: boolean
    }
  | undefined

vi.mock("@tanstack/react-query", () => ({
  useQuery: vi.fn((opts: Record<string, unknown>) => {
    capturedOptions = opts as typeof capturedOptions
    return { data: undefined, isLoading: true, isError: false }
  }),
}))

describe("useSanctionsCheck", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.resetModules()
    capturedOptions = undefined
  })

  describe("when VITE_SANCTIONS_API_URL is set", () => {
    let useSanctionsCheck: () => { allowed: boolean; isLoading: boolean }
    let useQueryMock: Mock

    beforeEach(async () => {
      vi.stubEnv(
        "VITE_SANCTIONS_API_URL",
        "https://sanctions.example.com/check",
      )
      ;({ useSanctionsCheck } = await import("../useSanctionsCheck"))
      const reactQuery = await import("@tanstack/react-query")
      useQueryMock = reactQuery.useQuery as unknown as Mock
    })

    describe("hook return values", () => {
      it("returns allowed=true and isLoading=true while loading", () => {
        useQueryMock.mockReturnValue({
          data: undefined,
          isLoading: true,
          isError: false,
        })

        const { result } = renderHook(() => useSanctionsCheck())

        expect(result.current.isLoading).toBe(true)
        expect(result.current.allowed).toBe(true)
      })

      it("returns allowed=true on successful non-403 response", () => {
        useQueryMock.mockReturnValue({
          data: true,
          isLoading: false,
          isError: false,
        })

        const { result } = renderHook(() => useSanctionsCheck())

        expect(result.current.isLoading).toBe(false)
        expect(result.current.allowed).toBe(true)
      })

      it("returns allowed=false on 403 response", () => {
        useQueryMock.mockReturnValue({
          data: false,
          isLoading: false,
          isError: false,
        })

        const { result } = renderHook(() => useSanctionsCheck())

        expect(result.current.isLoading).toBe(false)
        expect(result.current.allowed).toBe(false)
      })

      it("returns allowed=false on error (fail-closed)", () => {
        useQueryMock.mockReturnValue({
          data: undefined,
          isLoading: false,
          isError: true,
        })

        const { result } = renderHook(() => useSanctionsCheck())

        expect(result.current.isLoading).toBe(false)
        expect(result.current.allowed).toBe(false)
      })
    })

    describe("queryFn (checkSanctions)", () => {
      beforeEach(() => {
        useQueryMock.mockImplementation(
          (opts: Record<string, unknown>) => {
            capturedOptions = opts as typeof capturedOptions
            return {
              data: undefined,
              isLoading: true,
              isError: false,
            }
          },
        )
        renderHook(() => useSanctionsCheck())
      })

      it("returns true for non-403 response", async () => {
        mockFetch.mockResolvedValueOnce({ status: 200 })

        const result = await capturedOptions!.queryFn!()

        expect(result).toBe(true)
        expect(mockFetch).toHaveBeenCalledTimes(1)
      })

      it("returns false for 403 response", async () => {
        mockFetch.mockResolvedValueOnce({ status: 403 })

        const result = await capturedOptions!.queryFn!()

        expect(result).toBe(false)
      })

      it("throws on network error", async () => {
        mockFetch.mockRejectedValueOnce(new Error("Network error"))

        await expect(capturedOptions!.queryFn!()).rejects.toThrow(
          "Network error",
        )
      })
    })

    describe("useQuery configuration", () => {
      it("passes correct query key and options", () => {
        renderHook(() => useSanctionsCheck())

        expect(useQueryMock).toHaveBeenCalledWith(
          expect.objectContaining({
            queryKey: ["sanctions"],
            enabled: true,
            retry: false,
            staleTime: Infinity,
          }),
        )
      })
    })
  })

  describe("when VITE_SANCTIONS_API_URL is not set", () => {
    it("returns allowed=true and isLoading=false", async () => {
      vi.stubEnv("VITE_SANCTIONS_API_URL", "")
      const reactQuery = await import("@tanstack/react-query")
      const mock = reactQuery.useQuery as unknown as Mock
      mock.mockReturnValue({
        data: undefined,
        isLoading: false,
        isError: false,
      })

      const { useSanctionsCheck } = await import("../useSanctionsCheck")
      const { result } = renderHook(() => useSanctionsCheck())

      expect(result.current.isLoading).toBe(false)
      expect(result.current.allowed).toBe(true)
    })

    it("disables the query", async () => {
      vi.stubEnv("VITE_SANCTIONS_API_URL", "")
      const reactQuery = await import("@tanstack/react-query")
      const mock = reactQuery.useQuery as unknown as Mock
      mock.mockImplementation(
        (opts: Record<string, unknown>) => {
          capturedOptions = opts as typeof capturedOptions
          return {
            data: undefined,
            isLoading: false,
            isError: false,
          }
        },
      )

      const { useSanctionsCheck } = await import("../useSanctionsCheck")
      renderHook(() => useSanctionsCheck())

      expect(mock).toHaveBeenCalledWith(
        expect.objectContaining({
          enabled: false,
        }),
      )
    })
  })
})
