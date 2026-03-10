import { useQuery } from "@tanstack/react-query"

const CACHE_KEY = "geoblock_check"
const DEFAULT_CACHE_DAYS = 7
const cacheDays =
  Number(import.meta.env.VITE_GEOBLOCK_CACHE_DAYS) || DEFAULT_CACHE_DAYS
const CACHE_TTL_MS = cacheDays * 24 * 60 * 60 * 1000

interface CachedGeoblock {
  country: string
  timestamp: number
}

function readCache(): string | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY)
    if (!raw) return null
    const cached: CachedGeoblock = JSON.parse(raw)
    if (Date.now() - cached.timestamp > CACHE_TTL_MS) {
      localStorage.removeItem(CACHE_KEY)
      return null
    }
    return cached.country
  } catch {
    localStorage.removeItem(CACHE_KEY)
    return null
  }
}

function writeCache(country: string): void {
  const entry: CachedGeoblock = { country, timestamp: Date.now() }
  localStorage.setItem(CACHE_KEY, JSON.stringify(entry))
}

async function fetchCountry(): Promise<string> {
  const cached = readCache()
  if (cached) return cached

  const response = await fetch("https://api.country.is")
  if (!response.ok) throw new Error("Geo lookup failed")
  const data: { country: string } = await response.json()
  writeCache(data.country)
  return data.country
}

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
  "SY", // Syrian Arab Republic
  "ZW", // Zimbabwe
  "IQ", // Iraq
  "LY", // Libyan Arab Jamahiriya
  "SS", // South Sudan
  "CF", // Central African Republic
  "ET", // Ethiopia
  "KH", // Cambodia
  "UA", // Ukraine (Crimea / occupied territories)
])

interface GeoblockResult {
  allowed: boolean
  isLoading: boolean
}

export function useGeoblockCheck(): GeoblockResult {
  const { data: country, isLoading, isError } = useQuery({
    queryKey: ["geoblock"],
    queryFn: fetchCountry,
    staleTime: CACHE_TTL_MS,
    gcTime: CACHE_TTL_MS,
    retry: false,
  })

  if (isLoading) return { allowed: true, isLoading: true }

  // Fail-closed: block on error or blocked country
  const allowed = !isError && !!country && !BLOCKED_COUNTRIES.has(country)
  return { allowed, isLoading: false }
}
