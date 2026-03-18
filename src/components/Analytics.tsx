import { useEffect } from "react"

const scriptUrl = import.meta.env.VITE_PLAUSIBLE_SCRIPT_URL

/**
 * Injects the Plausible analytics script when VITE_PLAUSIBLE_SCRIPT_URL is set.
 * Uses hashBasedRouting to track hash-based navigation (HashRouter).
 * No-op if the env var is not configured.
 */
export function Analytics() {
  useEffect(() => {
    if (!scriptUrl) return

    window.plausible =
      window.plausible ||
      function (...args: unknown[]) {
        ;(window.plausible.q = window.plausible.q || []).push(args)
      }
    window.plausible.init =
      window.plausible.init ||
      function (i?: unknown) {
        ;(window.plausible as { o?: unknown }).o = i || {}
      }
    window.plausible.init({ hashBasedRouting: true })

    const script = document.createElement("script")
    script.src = scriptUrl
    script.async = true
    script.defer = true
    document.head.appendChild(script)

    return () => {
      document.head.removeChild(script)
    }
  }, [])

  return null
}

declare global {
  interface Window {
    plausible: ((...args: unknown[]) => void) & {
      q?: unknown[]
      init?: (i?: unknown) => void
    }
  }
}
