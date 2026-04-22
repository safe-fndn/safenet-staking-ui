import { useEffect, useRef } from "react"
import { useLocation } from "react-router-dom"
import { init, track } from "@plausible-analytics/tracker"

/**
 * Tracks pageviews via Plausible Analytics.
 *
 * Must render inside a Router so useLocation() is available.
 * We drive pageviews manually via useLocation() because HashRouter
 * navigates via pushState (which fires popstate, not hashchange), so
 * Plausible's hashBasedRouting option never sees in-app transitions.
 */
export function Analytics() {
  const location = useLocation()
  const initialized = useRef(false)

  useEffect(() => {
    const domain = import.meta.env.VITE_PLAUSIBLE_DOMAIN
    if (!domain) return

    if (!initialized.current) {
      init({ domain, autoCapturePageviews: false })
      initialized.current = true
    }

    // Reconstruct a clean URL so Plausible records "/validators" rather
    // than "/#/validators" — location.pathname is the in-hash path that
    // React Router exposes, e.g. "/validators" or "/withdrawals".
    const url = new URL(
      location.pathname + location.search,
      window.location.origin,
    ).href

    track("pageview", { url })
  }, [location.pathname, location.search])

  return null
}
