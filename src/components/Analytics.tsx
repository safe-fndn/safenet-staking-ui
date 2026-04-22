import { useEffect } from "react"
import { useLocation } from "react-router-dom"
import { init, track } from "@plausible-analytics/tracker"

const domain = import.meta.env.VITE_PLAUSIBLE_DOMAIN

// Called at module load time — runs once, outside React's lifecycle.
if (domain) {
  init({
    domain,
    // Keep hashBasedRouting so the tracker adds h=1 to every event payload.
    // The Plausible server uses this flag to preserve the hash in the recorded
    // URL (e.g. /#/validators); without it the server strips the hash and
    // every page reports as /.
    hashBasedRouting: true,
    // Disable auto-capture: HashRouter navigates via pushState, which fires
    // popstate not hashchange, so Plausible's built-in listener never sees
    // in-app transitions. Pageviews are fired manually via useLocation().
    autoCapturePageviews: false,
  })
}

/**
 * Tracks a pageview on every route change.
 * Must render inside a Router so useLocation() is available.
 */
export function Analytics() {
  const location = useLocation()

  useEffect(() => {
    if (!domain) return
    track("pageview", {})
  }, [location.pathname, location.search])

  return null
}
