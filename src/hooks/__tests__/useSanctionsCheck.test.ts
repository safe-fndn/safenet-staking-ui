import { describe, it, expect, vi, beforeEach } from "vitest"
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
  useQuery: vi.fn(
    (opts: { queryFn?: () => Promise<unknown>; enabled?: boolean }) => {
      capturedOptions = opts
      return { data: undefined, isLoading: true, isError: false }
    },
  ),
}))

describe("useSanctionsCheck", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.resetModules()
    capturedOptions = undefined
  })

  describe("when VITE_SANCTIONS_API_URL is set", () => {
    let useSanctionsCheck: () => { allowed: boolean; isLoading: boolean }
    let reactQuery: typeof import("@tanstack/react-query")

    beforeEach(async () => {
      vi.stubEnv(
        "VITE_SANCTIONS_API_URL",
        "https://sanctions.example.com/check",
      )
      ;({ useSanctionsCheck } = await import("../useSanctionsCheck"))
      reactQuery = vi.mocked(await import("@tanstack/react-query"))
    })

    describe("hook return values", () => {
      it("returns allowed=true and isLoading=true while loading", () => {
        reactQuery.useQuery.mockReturnValue({
          data: undefined,
          isLoading: true,
          isError: false,
        } as ReturnType<typeof reactQuery.useQuery>)

        const { result } = renderHook(() => useSanctionsCheck())

        expect(result.current.isLoading).toBe(true)
        expect(result.current.allowed).toBe(true)
      })

      it("returns allowed=true on successful non-403 response", () => {
        reactQuery.useQuery.mockReturnValue({
          data: true,
          isLoading: false,
          isError: false,
        } as ReturnType<typeof reactQuery.useQuery>)

        const { result } = renderHook(() => useSanctionsCheck())

        expect(result.current.isLoading).toBe(false)
        expect(result.current.allowed).toBe(true)
      })

      it("returns allowed=false on 403 response", () => {
        reactQuery.useQuery.mockReturnValue({
          data: false,
          isLoading: false,
          isError: false,
        } as ReturnType<typeof reactQuery.useQuery>)

        const { result } = renderHook(() => useSanctionsCheck())

        expect(result.current.isLoading).toBe(false)
        expect(result.current.allowed).toBe(false)
      })

      it("returns allowed=false on error (fail-closed)", () => {
        reactQuery.useQuery.mockReturnValue({
          data: undefined,
          isLoading: false,
          isError: true,
        } as ReturnType<typeof reactQuery.useQuery>)

        const { result } = renderHook(() => useSanctionsCheck())

        expect(result.current.isLoading).toBe(false)
        expect(result.current.allowed).toBe(false)
      })
    })

    describe("queryFn (checkSanctions)", () => {
      beforeEach(() => {
        reactQuery.useQuery.mockImplementation(
          (opts: {
            queryFn?: () => Promise<unknown>
            enabled?: boolean
          }) => {
            capturedOptions = opts
            return {
              data: undefined,
              isLoading: true,
              isError: false,
            } as ReturnType<typeof reactQuery.useQuery>
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

        expect(reactQuery.useQuery).toHaveBeenCalledWith(
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
      const reactQuery = vi.mocked(await import("@tanstack/react-query"))
      reactQuery.useQuery.mockReturnValue({
        data: undefined,
        isLoading: false,
        isError: false,
      } as ReturnType<typeof reactQuery.useQuery>)

      const { useSanctionsCheck } = await import("../useSanctionsCheck")
      const { result } = renderHook(() => useSanctionsCheck())

      expect(result.current.isLoading).toBe(false)
      expect(result.current.allowed).toBe(true)
    })

    it("disables the query", async () => {
      vi.stubEnv("VITE_SANCTIONS_API_URL", "")
      const reactQuery = vi.mocked(await import("@tanstack/react-query"))
      reactQuery.useQuery.mockImplementation(
        (opts: {
          queryFn?: () => Promise<unknown>
          enabled?: boolean
        }) => {
          capturedOptions = opts
          return {
            data: undefined,
            isLoading: false,
            isError: false,
          } as ReturnType<typeof reactQuery.useQuery>
        },
      )

      const { useSanctionsCheck } = await import("../useSanctionsCheck")
      renderHook(() => useSanctionsCheck())

      expect(reactQuery.useQuery).toHaveBeenCalledWith(
        expect.objectContaining({
          enabled: false,
        }),
      )
    })
  })
})
