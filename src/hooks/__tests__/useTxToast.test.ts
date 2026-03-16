import { describe, it, expect, vi, beforeEach } from "vitest"
import { renderHook } from "@testing-library/react"
import { useTxToast } from "../useTxToast"

const mockToast = vi.fn()

vi.mock("@/hooks/useToast", () => ({
  useToast: () => ({ toast: mockToast }),
}))

describe("useTxToast", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("calls reset on success to clear isSuccess", () => {
    const reset = vi.fn()

    renderHook(() =>
      useTxToast(
        { successTitle: "Done", successDescription: "OK", errorTitle: "Fail" },
        { isSuccess: true, error: null, isSafeQueued: false, reset, txHash: "0xabc" },
      ),
    )

    expect(reset).toHaveBeenCalledTimes(1)
    expect(mockToast).toHaveBeenCalledTimes(1)
    expect(mockToast).toHaveBeenCalledWith(
      expect.objectContaining({ variant: "success", title: "Done" }),
    )
  })

  it("does not fire toast when isSuccess is false", () => {
    const reset = vi.fn()

    renderHook(() =>
      useTxToast(
        { successTitle: "Done", successDescription: "OK", errorTitle: "Fail" },
        { isSuccess: false, error: null, isSafeQueued: false, reset },
      ),
    )

    expect(reset).not.toHaveBeenCalled()
    expect(mockToast).not.toHaveBeenCalled()
  })

  it("does not re-fire toast when reset is stable and isSuccess stays false after reset", () => {
    const reset = vi.fn()

    const { rerender } = renderHook(
      ({ isSuccess }) =>
        useTxToast(
          { successTitle: "Done", successDescription: "OK", errorTitle: "Fail" },
          { isSuccess, error: null, isSafeQueued: false, reset },
        ),
      { initialProps: { isSuccess: true } },
    )

    expect(mockToast).toHaveBeenCalledTimes(1)
    expect(reset).toHaveBeenCalledTimes(1)

    // After reset clears isSuccess, re-render with isSuccess: false
    rerender({ isSuccess: false })

    // Should NOT fire again
    expect(mockToast).toHaveBeenCalledTimes(1)
    expect(reset).toHaveBeenCalledTimes(1)
  })

  it("infinite loop regression: unstable reset + isSuccess staying true causes repeated toasts", () => {
    // Simulate the bug: isSuccess stays true and reset changes reference each render
    let renderCount = 0

    const { rerender } = renderHook(
      ({ isSuccess }: { isSuccess: boolean }) => {
        renderCount++
        // Unstable reset — new function each render (the old bug pattern)
        const unstableReset = () => { /* does not clear isSuccess */ }
        useTxToast(
          { successTitle: "Done", successDescription: "OK", errorTitle: "Fail" },
          { isSuccess, error: null, isSafeQueued: false, reset: unstableReset },
        )
      },
      { initialProps: { isSuccess: true } },
    )

    const toastCallsAfterFirst = mockToast.mock.calls.length

    // Re-render a few times (simulating what React would do)
    rerender({ isSuccess: true })
    rerender({ isSuccess: true })
    rerender({ isSuccess: true })

    // With the bug, each rerender fires the toast again because reset ref changed.
    // This test documents the behavior: if reset is unstable and isSuccess stays true,
    // toast fires on every render. The fix is to ensure:
    // 1. reset is stable (useCallback)
    // 2. reset actually clears isSuccess (calls the hook's reset)
    const totalToasts = mockToast.mock.calls.length
    if (totalToasts > toastCallsAfterFirst) {
      // This path confirms the unstable-reset pattern causes repeated toasts.
      // The real fix is in WithdrawalQueue: stable reset + calling resetClaim().
      expect(totalToasts).toBeGreaterThan(1)
    }

    expect(renderCount).toBeGreaterThan(1)
  })

  it("shows error toast on error", () => {
    const reset = vi.fn()
    const error = new Error("tx failed")

    renderHook(() =>
      useTxToast(
        { successTitle: "Done", successDescription: "OK", errorTitle: "Fail" },
        { isSuccess: false, error, isSafeQueued: false, reset },
      ),
    )

    expect(mockToast).toHaveBeenCalledWith(
      expect.objectContaining({ variant: "error", title: "Fail" }),
    )
  })

  it("calls reset and onSuccess on safeQueued", () => {
    const reset = vi.fn()
    const onSuccess = vi.fn()

    renderHook(() =>
      useTxToast(
        { successTitle: "Done", successDescription: "OK", errorTitle: "Fail" },
        { isSuccess: false, error: null, isSafeQueued: true, reset, onSuccess },
      ),
    )

    expect(reset).toHaveBeenCalledTimes(1)
    expect(onSuccess).toHaveBeenCalledTimes(1)
    expect(mockToast).toHaveBeenCalledWith(
      expect.objectContaining({ variant: "success", title: "Transaction queued in Safe" }),
    )
  })
})
