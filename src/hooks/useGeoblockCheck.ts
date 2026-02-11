import { useState, useEffect } from "react"

// ITAR/OFAC blocked country codes (ISO 3166-1 alpha-2)
const BLOCKED_COUNTRIES = new Set([
  "CN", // China
  "RU", // Russia
  "CU", // Cuba
  "IR", // Iran
  "KP", // North Korea
  "SO", // Somalia
  "VE", // Venezuela
  "AF", // Afghanistan
  "BY", // Belarus
  "CD", // Congo, Democratic Republic of the
  "ER", // Eritrea
  "HT", // Haiti
  "LB", // Lebanon
  "MM", // Myanmar
  "SD", // Sudan
  "SY", // Syria
  "ZW", // Zimbabwe
  "IQ", // Iraq
  "LY", // Libya
  "SS", // South Sudan
  "CF", // Central African Republic
  "ET", // Ethiopia
  "KH", // Cambodia
  "UA", // Ukraine (Crimea / occupied territories — conservative: entire UA)
])

interface GeoblockResult {
  allowed: boolean
  isLoading: boolean
}

export function useGeoblockCheck(): GeoblockResult {
  const [allowed, setAllowed] = useState(true)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    let cancelled = false

    async function check() {
      try {
        const response = await fetch("https://api.country.is")
        if (!response.ok) throw new Error("Geo lookup failed")
        const data: { country: string } = await response.json()
        if (!cancelled) {
          setAllowed(!BLOCKED_COUNTRIES.has(data.country))
        }
      } catch {
        // Fail-open: if geo lookup fails, allow access
        if (!cancelled) {
          setAllowed(true)
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
