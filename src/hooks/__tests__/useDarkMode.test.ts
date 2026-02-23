import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { renderHook, act } from "@testing-library/react"
import { useDarkMode } from "../useDarkMode"

function mockMatchMedia(matches = false) {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  })
}

describe("useDarkMode", () => {
  beforeEach(() => {
    localStorage.clear()
    document.documentElement.classList.remove("dark")
    mockMatchMedia()
  })

  it("defaults to light mode when no preference stored", () => {
    const { result } = renderHook(() => useDarkMode())
    expect(result.current.isDark).toBe(false)
  })

  it("reads dark mode from localStorage", () => {
    localStorage.setItem("theme", "dark")

    const { result } = renderHook(() => useDarkMode())
    expect(result.current.isDark).toBe(true)
  })

  it("toggle switches to dark mode and updates localStorage", () => {
    const { result } = renderHook(() => useDarkMode())

    act(() => {
      result.current.toggle()
    })

    expect(result.current.isDark).toBe(true)
    expect(localStorage.getItem("theme")).toBe("dark")
    expect(document.documentElement.classList.contains("dark")).toBe(true)
  })

  it("toggle switches back to light mode", () => {
    localStorage.setItem("theme", "dark")

    const { result } = renderHook(() => useDarkMode())

    act(() => {
      result.current.toggle()
    })

    expect(result.current.isDark).toBe(false)
    expect(localStorage.getItem("theme")).toBe("light")
    expect(document.documentElement.classList.contains("dark")).toBe(false)
  })
})

describe("useDarkMode — Safe App iframe", () => {
  const originalTop = window.top
  const originalParent = window.parent
  const postMessageSpy = vi.fn()

  beforeEach(() => {
    localStorage.clear()
    document.documentElement.classList.remove("dark")
    mockMatchMedia()
    // Simulate iframe: window.self !== window.top
    const fakeParent = { postMessage: postMessageSpy }
    Object.defineProperty(window, "top", {
      writable: true,
      configurable: true,
      value: fakeParent,
    })
    Object.defineProperty(window, "parent", {
      writable: true,
      configurable: true,
      value: fakeParent,
    })
    // Clear module cache so isSafeApp re-evaluates with mocked window.top
    vi.resetModules()
  })

  afterEach(() => {
    Object.defineProperty(window, "top", {
      writable: true,
      configurable: true,
      value: originalTop,
    })
    Object.defineProperty(window, "parent", {
      writable: true,
      configurable: true,
      value: originalParent,
    })
    postMessageSpy.mockReset()
  })

  async function loadHook() {
    const mod = await import("../useDarkMode")
    return mod.useDarkMode
  }

  it("sends getCurrentTheme request on mount", async () => {
    const hook = await loadHook()
    renderHook(() => hook())

    expect(postMessageSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        method: "getCurrentTheme",
        params: {},
        env: { sdkVersion: "1.0.0" },
      }),
      "*",
    )
  })

  it("applies dark mode from Safe Wallet response format", async () => {
    const hook = await loadHook()
    const { result } = renderHook(() => hook())

    // Safe Wallet MessageFormatter.makeResponse() format
    act(() => {
      window.dispatchEvent(
        new MessageEvent("message", {
          data: {
            id: "123",
            success: true,
            data: { darkMode: true },
            version: "9.1.0",
          },
        }),
      )
    })

    expect(result.current.isDark).toBe(true)
    expect(document.documentElement.classList.contains("dark")).toBe(true)
  })

  it("applies light mode from Safe Wallet response", async () => {
    localStorage.setItem("theme", "dark")
    const hook = await loadHook()
    const { result } = renderHook(() => hook())

    act(() => {
      window.dispatchEvent(
        new MessageEvent("message", {
          data: {
            id: "456",
            success: true,
            data: { darkMode: false },
            version: "9.1.0",
          },
        }),
      )
    })

    expect(result.current.isDark).toBe(false)
    expect(document.documentElement.classList.contains("dark")).toBe(false)
  })

  it("does not update localStorage when toggling in Safe App", async () => {
    const hook = await loadHook()
    const { result } = renderHook(() => hook())

    act(() => {
      result.current.toggle()
    })

    expect(result.current.isDark).toBe(true)
    expect(localStorage.getItem("theme")).toBeNull()
  })

  it("ignores non-theme messages", async () => {
    const hook = await loadHook()
    const { result } = renderHook(() => hook())

    act(() => {
      window.dispatchEvent(
        new MessageEvent("message", {
          data: {
            id: "789",
            success: true,
            data: { origin: "https://app.safe.global" },
          },
        }),
      )
    })

    expect(result.current.isDark).toBe(false)
  })
})
