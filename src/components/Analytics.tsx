import { useEffect } from "react"
import { init } from "@plausible-analytics/tracker"

const domain = import.meta.env.VITE_PLAUSIBLE_DOMAIN

/**
 * Initialises Plausible Analytics when VITE_PLAUSIBLE_DOMAIN is set.
 * Uses hash-based routing to track hash-based navigation.
 * No-op if the env var is not configured.
 */
export function Analytics() {
  useEffect(() => {
    if (!domain) return

    init({ domain, hashBasedRouting: true, autoCapturePageviews: true })
  }, [])

  return null
}
