import { useState, useEffect } from "react"

const sanctionsApiUrl = import.meta.env.VITE_SANCTIONS_API_URL as string | undefined

interface SanctionsResult {
  allowed: boolean
  isLoading: boolean
}

export function useSanctionsCheck(): SanctionsResult {
  const [allowed, setAllowed] = useState(true)
  const [isLoading, setIsLoading] = useState(!!sanctionsApiUrl)

  useEffect(() => {
    if (!sanctionsApiUrl) {
      setAllowed(true)
      setIsLoading(false)
      return
    }

    let cancelled = false

    async function check() {
      try {
        const response = await fetch(sanctionsApiUrl as string)
        if (!cancelled) {
          setAllowed(response.status !== 403)
        }
      } catch {
        // On network error, block access (fail-closed when sanctions API is configured)
        if (!cancelled) {
          setAllowed(false)
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false)
        }
      }
    }

    check()

    return () => {
      cancelled = true
    }
  }, [])

  return { allowed, isLoading }
}
