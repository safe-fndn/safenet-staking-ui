import { describe, it, expect, vi, beforeEach } from "vitest"
import { renderHook, waitFor } from "@testing-library/react"

// We need to control the env var, so we mock import.meta.env via module re-import
const mockFetch = vi.fn()
vi.stubGlobal("fetch", mockFetch)

describe("useSanctionsCheck", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.resetModules()
  })

  it("returns allowed=true and isLoading=false when VITE_SANCTIONS_API_URL is not set", async () => {
    vi.stubEnv("VITE_SANCTIONS_API_URL", "")

    const { useSanctionsCheck } = await import("../useSanctionsCheck")
    const { result } = renderHook(() => useSanctionsCheck())

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })
    expect(result.current.allowed).toBe(true)
  })

  it("returns allowed=true on 200 response", async () => {
    vi.stubEnv("VITE_SANCTIONS_API_URL", "https://sanctions.example.com/check")
    mockFetch.mockResolvedValueOnce({ status: 200 })

    const { useSanctionsCheck } = await import("../useSanctionsCheck")
    const { result } = renderHook(() => useSanctionsCheck())

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })
    expect(result.current.allowed).toBe(true)
  })

  it("returns allowed=false on 403 response", async () => {
    vi.stubEnv("VITE_SANCTIONS_API_URL", "https://sanctions.example.com/check")
    mockFetch.mockResolvedValueOnce({ status: 403 })

    const { useSanctionsCheck } = await import("../useSanctionsCheck")
    const { result } = renderHook(() => useSanctionsCheck())

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })
    expect(result.current.allowed).toBe(false)
  })

  it("returns allowed=false on network error (fail-closed)", async () => {
    vi.stubEnv("VITE_SANCTIONS_API_URL", "https://sanctions.example.com/check")
    mockFetch.mockRejectedValueOnce(new Error("Network error"))

    const { useSanctionsCheck } = await import("../useSanctionsCheck")
    const { result } = renderHook(() => useSanctionsCheck())

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })
    expect(result.current.allowed).toBe(false)
  })
})
