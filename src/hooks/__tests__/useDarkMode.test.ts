import { describe, it, expect, vi, beforeEach } from "vitest"
import { renderHook, act } from "@testing-library/react"
import { useDarkMode } from "../useDarkMode"

describe("useDarkMode", () => {
  beforeEach(() => {
    localStorage.clear()
    document.documentElement.classList.remove("dark")
    // Ensure matchMedia is available in jsdom
    Object.defineProperty(window, "matchMedia", {
      writable: true,
      value: vi.fn().mockImplementation((query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    })
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
