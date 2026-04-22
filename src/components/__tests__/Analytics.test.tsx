import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { render, screen, waitFor } from "@testing-library/react"
import { MemoryRouter, Routes, Route, Link } from "react-router-dom"
import userEvent from "@testing-library/user-event"
import { Analytics } from "../Analytics"

const mockInit = vi.fn()
const mockTrack = vi.fn()

vi.mock("@plausible-analytics/tracker", () => ({
  init: (...args: unknown[]) => mockInit(...args),
  track: (...args: unknown[]) => mockTrack(...args),
  DEFAULT_FILE_TYPES: [],
}))

// Minimal wrapper: renders Analytics inside a router with navigable routes.
function TestApp({ initialPath = "/" }: { initialPath?: string }) {
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
  const originalEnv = import.meta.env.VITE_PLAUSIBLE_DOMAIN

  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.stubEnv("VITE_PLAUSIBLE_DOMAIN", originalEnv ?? "")
  })

  describe("when VITE_PLAUSIBLE_DOMAIN is configured", () => {
    beforeEach(() => {
      vi.stubEnv("VITE_PLAUSIBLE_DOMAIN", "staking.safe.global")
    })

    it("calls init once with the correct options on first render", () => {
      render(<TestApp />)

      expect(mockInit).toHaveBeenCalledOnce()
      expect(mockInit).toHaveBeenCalledWith({
        domain: "staking.safe.global",
        autoCapturePageviews: false,
      })
    })

    it("tracks the initial pageview for the root route", () => {
      render(<TestApp initialPath="/" />)

      expect(mockTrack).toHaveBeenCalledOnce()
      expect(mockTrack).toHaveBeenCalledWith(
        "pageview",
        expect.objectContaining({ url: expect.stringContaining("/") }),
      )
    })

    it("tracks the initial pageview when landing on /validators", () => {
      render(<TestApp initialPath="/validators" />)

      expect(mockTrack).toHaveBeenCalledOnce()
      expect(mockTrack).toHaveBeenCalledWith(
        "pageview",
        expect.objectContaining({ url: expect.stringMatching(/\/validators$/) }),
      )
    })

    it("tracks a new pageview when navigating to /validators", async () => {
      const user = userEvent.setup()
      render(<TestApp initialPath="/" />)
      expect(mockTrack).toHaveBeenCalledTimes(1)

      await user.click(screen.getByRole("link", { name: "go to validators" }))

      await waitFor(() => expect(mockTrack).toHaveBeenCalledTimes(2))
      expect(mockTrack).toHaveBeenLastCalledWith(
        "pageview",
        expect.objectContaining({ url: expect.stringMatching(/\/validators$/) }),
      )
    })

    it("tracks a new pageview when navigating to /withdrawals", async () => {
      const user = userEvent.setup()
      render(<TestApp initialPath="/" />)

      await user.click(screen.getByRole("link", { name: "go to withdrawals" }))

      await waitFor(() => expect(mockTrack).toHaveBeenCalledTimes(2))
      expect(mockTrack).toHaveBeenLastCalledWith(
        "pageview",
        expect.objectContaining({ url: expect.stringMatching(/\/withdrawals$/) }),
      )
    })

    it("does not call init again on subsequent navigations", async () => {
      const user = userEvent.setup()
      render(<TestApp initialPath="/" />)

      await user.click(screen.getByRole("link", { name: "go to validators" }))
      await waitFor(() => screen.getByRole("link", { name: "go home" }))
      await user.click(screen.getByRole("link", { name: "go home" }))

      expect(mockInit).toHaveBeenCalledOnce()
    })

    it("includes query params in the tracked URL", () => {
      render(<TestApp initialPath="/validators?delegate=0xabc" />)

      expect(mockTrack).toHaveBeenCalledWith(
        "pageview",
        expect.objectContaining({
          url: expect.stringMatching(/\/validators\?delegate=0xabc$/),
        }),
      )
    })

    it("sends a valid absolute URL with the window origin as the base", () => {
      render(<TestApp initialPath="/validators" />)

      const [, { url }] = mockTrack.mock.calls[0] as [string, { url: string }]
      expect(() => new URL(url)).not.toThrow()
      expect(new URL(url).pathname).toBe("/validators")
    })
  })

  describe("when VITE_PLAUSIBLE_DOMAIN is not configured", () => {
    beforeEach(() => {
      vi.stubEnv("VITE_PLAUSIBLE_DOMAIN", "")
    })

    it("does not call init", () => {
      render(<TestApp />)
      expect(mockInit).not.toHaveBeenCalled()
    })

    it("does not track any pageviews on initial render", () => {
      render(<TestApp />)
      expect(mockTrack).not.toHaveBeenCalled()
    })

    it("does not track pageviews after navigation either", async () => {
      const user = userEvent.setup()
      render(<TestApp initialPath="/" />)

      await user.click(screen.getByRole("link", { name: "go to validators" }))
      await waitFor(() => screen.getByRole("link", { name: "go home" }))

      expect(mockTrack).not.toHaveBeenCalled()
    })
  })
})
