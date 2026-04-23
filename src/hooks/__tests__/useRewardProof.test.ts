import { describe, it, expect, vi, beforeEach, type Mock } from "vitest"
import { renderHook } from "@testing-library/react"
import type { Address } from "viem"

const mockFetch = vi.fn()
vi.stubGlobal("fetch", mockFetch)

let capturedOptions:
  | {
      queryKey?: unknown[]
      queryFn?: () => Promise<unknown>
      enabled?: boolean
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

describe("useRewardProof", () => {
  let useRewardProof: (address: Address | undefined, enabled?: boolean) => { data: unknown }
  let useQueryMock: Mock

  beforeEach(async () => {
    vi.clearAllMocks()
    vi.resetModules()
    capturedOptions = undefined
    ;({ useRewardProof } = await import("../useRewardProof"))
    const reactQuery = await import("@tanstack/react-query")
    useQueryMock = reactQuery.useQuery as unknown as Mock
  })

  describe("query configuration", () => {
    it("is disabled when address is undefined", () => {
      renderHook(() => useRewardProof(undefined))

      expect(useQueryMock).toHaveBeenCalledWith(
        expect.objectContaining({ enabled: false }),
      )
    })

    it("is enabled when address is provided", () => {
      renderHook(() =>
        useRewardProof("0x1234567890123456789012345678901234567890" as Address),
      )

      expect(useQueryMock).toHaveBeenCalledWith(
        expect.objectContaining({ enabled: true }),
      )
    })

    it("is disabled when enabled=false is passed", () => {
      renderHook(() =>
        useRewardProof(
          "0x1234567890123456789012345678901234567890" as Address,
          false,
        ),
      )

      expect(useQueryMock).toHaveBeenCalledWith(
        expect.objectContaining({ enabled: false }),
      )
    })
  })

  describe("queryFn", () => {
    const address = "0x0484bf598554ab04b9b21421ed28bff6b7742993" as Address

    beforeEach(() => {
      useQueryMock.mockImplementation((opts: Record<string, unknown>) => {
        capturedOptions = opts as typeof capturedOptions
        return { data: undefined }
      })
      renderHook(() => useRewardProof(address))
    })

    it("returns null on 404", async () => {
      mockFetch.mockResolvedValueOnce({ ok: true, status: 404, json: async () => null })
      mockFetch.mockResolvedValueOnce({ status: 404 })
      // Override fetch to return 404 properly
      mockFetch.mockReset()
      mockFetch.mockResolvedValueOnce({ ok: false, status: 404 })

      // Re-render to capture fresh options with 404 handling
      vi.clearAllMocks()
      vi.resetModules()
      ;({ useRewardProof } = await import("../useRewardProof"))
      const reactQuery = await import("@tanstack/react-query")
      useQueryMock = reactQuery.useQuery as unknown as Mock
      useQueryMock.mockImplementation((opts: Record<string, unknown>) => {
        capturedOptions = opts as typeof capturedOptions
        return { data: undefined }
      })
      renderHook(() => useRewardProof(address))

      mockFetch.mockResolvedValueOnce({ status: 404 })
      const result = await capturedOptions!.queryFn!()
      expect(result).toBeNull()
    })

    it("throws on non-404 error responses", async () => {
      mockFetch.mockResolvedValueOnce({ ok: false, status: 500 })

      await expect(capturedOptions!.queryFn!()).rejects.toThrow(
        "Failed to fetch reward proof: 500",
      )
    })

    it("throws on invalid proof format", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ cumulativeAmount: 123 }),
      })

      await expect(capturedOptions!.queryFn!()).rejects.toThrow(
        "Invalid reward proof format",
      )
    })

    it("accepts a minimal valid proof", async () => {
      const proof = {
        cumulativeAmount: "1000",
        merkleRoot: "0xabc123",
        proof: ["0xdef456"],
      }
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => proof,
      })

      const result = await capturedOptions!.queryFn!()
      expect(result).toMatchObject(proof)
    })

    it("accepts proof with proof:null (kycAmount pending, nothing claimable yet)", async () => {
      const proof = {
        cumulativeAmount: "0",
        kycAmount: "826720638286750773563",
        merkleRoot: "0x5aea53631d726e3cb245cb1ce31834212ab6667a4726d25168a583d3b57b6cc1",
        proof: null,
      }
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => proof,
      })

      const result = await capturedOptions!.queryFn!()
      expect(result).toMatchObject(proof)
    })

    it("accepts proof with kyc:true and kycAmount:0", async () => {
      const proof = {
        cumulativeAmount: "973890821912297403820",
        kyc: true,
        kycAmount: "0",
        merkleRoot: "0x5aea53631d726e3cb245cb1ce31834212ab6667a4726d25168a583d3b57b6cc1",
        proof: ["0x1998aa1fb0e54f96da60317f799a85422585dda3a8368e6af3a465c3dd455e50"],
      }
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => proof,
      })

      const result = await capturedOptions!.queryFn!()
      expect(result).toMatchObject(proof)
    })

    it("rejects proof with non-string kycAmount", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          cumulativeAmount: "0",
          kycAmount: 12345,
          merkleRoot: "0xabc",
          proof: null,
        }),
      })

      await expect(capturedOptions!.queryFn!()).rejects.toThrow(
        "Invalid reward proof format",
      )
    })

    it("rejects proof with non-boolean kyc", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          cumulativeAmount: "0",
          kyc: "yes",
          merkleRoot: "0xabc",
          proof: null,
        }),
      })

      await expect(capturedOptions!.queryFn!()).rejects.toThrow(
        "Invalid reward proof format",
      )
    })
  })
})
