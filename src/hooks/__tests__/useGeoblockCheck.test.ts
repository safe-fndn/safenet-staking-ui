import { describe, it, expect, vi, beforeEach } from "vitest"
import { renderHook, waitFor } from "@testing-library/react"
import { useGeoblockCheck } from "../useGeoblockCheck"

const mockFetch = vi.fn()
vi.stubGlobal("fetch", mockFetch)

describe("useGeoblockCheck", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("returns allowed=true for non-blocked country", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ country: "US" }),
    })

    const { result } = renderHook(() => useGeoblockCheck())

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })
    expect(result.current.allowed).toBe(true)
  })

  it("returns allowed=false for blocked country (Iran)", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ country: "IR" }),
    })

    const { result } = renderHook(() => useGeoblockCheck())

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })
    expect(result.current.allowed).toBe(false)
  })

  it("returns allowed=false for blocked country (Russia)", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ country: "RU" }),
    })

    const { result } = renderHook(() => useGeoblockCheck())

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })
    expect(result.current.allowed).toBe(false)
  })

  it("returns allowed=true on network error (fail-open)", async () => {
    mockFetch.mockRejectedValueOnce(new Error("Network error"))

    const { result } = renderHook(() => useGeoblockCheck())

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })
    expect(result.current.allowed).toBe(true)
  })

  it("returns allowed=true when geo API returns non-ok response", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
    })

    const { result } = renderHook(() => useGeoblockCheck())

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })
    expect(result.current.allowed).toBe(true)
  })
})
