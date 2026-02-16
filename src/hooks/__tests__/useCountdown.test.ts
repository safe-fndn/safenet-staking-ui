import { describe, it, expect, vi, afterEach } from "vitest"
import { renderHook, act } from "@testing-library/react"
import { useCountdown } from "../useCountdown"

describe("useCountdown", () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it("returns positive seconds when target is in the future", () => {
    const future = Math.floor(Date.now() / 1000) + 100
    const { result } = renderHook(() => useCountdown(future))
    expect(result.current).toBeGreaterThanOrEqual(99)
    expect(result.current).toBeLessThanOrEqual(101)
  })

  it("returns 0 when target is in the past", () => {
    const past = Math.floor(Date.now() / 1000) - 100
    const { result } = renderHook(() => useCountdown(past))
    expect(result.current).toBe(0)
  })

  it("decrements over time", () => {
    vi.useFakeTimers()
    const future = Math.floor(Date.now() / 1000) + 60
    const { result } = renderHook(() => useCountdown(future))

    const initial = result.current

    act(() => {
      vi.advanceTimersByTime(5000)
    })

    expect(result.current).toBeLessThan(initial)
  })

  it("never goes below 0", () => {
    vi.useFakeTimers()
    const future = Math.floor(Date.now() / 1000) + 2
    const { result } = renderHook(() => useCountdown(future))

    act(() => {
      vi.advanceTimersByTime(10000)
    })

    expect(result.current).toBe(0)
  })
})
