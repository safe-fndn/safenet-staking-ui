import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { render, screen, waitFor } from "@testing-library/react"
import { MemoryRouter, Routes, Route, Link } from "react-router-dom"
import userEvent from "@testing-library/user-event"

let mockInit: ReturnType<typeof vi.fn>
let mockTrack: ReturnType<typeof vi.fn>

beforeEach(() => {
  // Reset the module registry so the module-level init() call in
  // Analytics.tsx is re-evaluated fresh for each test.
  vi.resetModules()
  mockInit = vi.fn()
  mockTrack = vi.fn()
  vi.doMock("@plausible-analytics/tracker", () => ({
    init: mockInit,
    track: mockTrack,
    DEFAULT_FILE_TYPES: [],
  }))
})

afterEach(() => {
  vi.unstubAllEnvs()
})

// Dynamically imports Analytics after mocks and env stubs are in place.
async function loadAnalytics() {
  const { Analytics } = await import("../Analytics")
  return Analytics
}

// Minimal router wrapper with navigable routes.
function TestApp({
  Analytics,
  initialPath = "/",
}: {
  Analytics: React.ComponentType
  initialPath?: string
}) {
  return (
    <MemoryRouter initialEntries={[initialPath]}>
      <Analytics />
      <Routes>
        <Route
          path="/"
          element={
            <>
              <Link to="/validators">go to validators</Link>
              <Link to="/withdrawals">go to withdrawals</Link>
            </>
          }
        />
        <Route path="/validators" element={<Link to="/">go home</Link>} />
        <Route path="/validators/:address" element={<span>detail</span>} />
        <Route path="/withdrawals" element={<Link to="/">go home</Link>} />
      </Routes>
    </MemoryRouter>
  )
}

describe("Analytics", () => {
  describe("when VITE_PLAUSIBLE_DOMAIN is configured", () => {
    beforeEach(() => {
      vi.stubEnv("VITE_PLAUSIBLE_DOMAIN", "staking.safe.global")
    })

    it("calls init with hashBasedRouting:true and autoCapturePageviews:false", async () => {
      await loadAnalytics()

      expect(mockInit).toHaveBeenCalledOnce()
      expect(mockInit).toHaveBeenCalledWith({
        domain: "staking.safe.global",
        hashBasedRouting: true,
        autoCapturePageviews: false,
      })
    })

    it("passes a custom endpoint when VITE_PLAUSIBLE_ENDPOINT is set", async () => {
      vi.stubEnv("VITE_PLAUSIBLE_ENDPOINT", "https://plausible.example.com/api/event")
      await loadAnalytics()

      expect(mockInit).toHaveBeenCalledWith({
        domain: "staking.safe.global",
        hashBasedRouting: true,
        autoCapturePageviews: false,
        endpoint: "https://plausible.example.com/api/event",
      })
    })

    it("tracks the initial pageview on mount", async () => {
      const Analytics = await loadAnalytics()
      render(<TestApp Analytics={Analytics} />)

      expect(mockTrack).toHaveBeenCalledOnce()
      expect(mockTrack).toHaveBeenCalledWith("pageview", {})
    })

    it("tracks a new pageview when navigating to /validators", async () => {
      const user = userEvent.setup()
      const Analytics = await loadAnalytics()
      render(<TestApp Analytics={Analytics} />)
      expect(mockTrack).toHaveBeenCalledTimes(1)

      await user.click(screen.getByRole("link", { name: "go to validators" }))

      await waitFor(() => expect(mockTrack).toHaveBeenCalledTimes(2))
      expect(mockTrack).toHaveBeenLastCalledWith("pageview", {})
    })

    it("tracks a new pageview when navigating to /withdrawals", async () => {
      const user = userEvent.setup()
      const Analytics = await loadAnalytics()
      render(<TestApp Analytics={Analytics} />)

      await user.click(screen.getByRole("link", { name: "go to withdrawals" }))

      await waitFor(() => expect(mockTrack).toHaveBeenCalledTimes(2))
      expect(mockTrack).toHaveBeenLastCalledWith("pageview", {})
    })

    it("does not call init again on subsequent navigations", async () => {
      const user = userEvent.setup()
      const Analytics = await loadAnalytics()
      render(<TestApp Analytics={Analytics} />)

      await user.click(screen.getByRole("link", { name: "go to validators" }))
      await waitFor(() => screen.getByRole("link", { name: "go home" }))
      await user.click(screen.getByRole("link", { name: "go home" }))

      expect(mockInit).toHaveBeenCalledOnce()
    })

    it("does not track a duplicate pageview on re-render without navigation", async () => {
      const Analytics = await loadAnalytics()
      const { rerender } = render(<TestApp Analytics={Analytics} />)
      expect(mockTrack).toHaveBeenCalledTimes(1)

      rerender(<TestApp Analytics={Analytics} />)
      rerender(<TestApp Analytics={Analytics} />)

      expect(mockTrack).toHaveBeenCalledTimes(1)
    })
  })

  describe("when VITE_PLAUSIBLE_DOMAIN is not configured", () => {
    beforeEach(() => {
      vi.stubEnv("VITE_PLAUSIBLE_DOMAIN", "")
    })

    it("does not call init", async () => {
      await loadAnalytics()
      expect(mockInit).not.toHaveBeenCalled()
    })

    it("does not track any pageviews on initial render", async () => {
      const Analytics = await loadAnalytics()
      render(<TestApp Analytics={Analytics} />)
      expect(mockTrack).not.toHaveBeenCalled()
    })

    it("does not track pageviews after navigation", async () => {
      const user = userEvent.setup()
      const Analytics = await loadAnalytics()
      render(<TestApp Analytics={Analytics} initialPath="/" />)

      await user.click(screen.getByRole("link", { name: "go to validators" }))
      await waitFor(() => screen.getByRole("link", { name: "go home" }))

      expect(mockTrack).not.toHaveBeenCalled()
    })
  })
})
