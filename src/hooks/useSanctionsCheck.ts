import { useQuery } from "@tanstack/react-query"

const sanctionsApiUrl = import.meta.env.VITE_SANCTIONS_API_URL as
  | string
  | undefined

interface SanctionsResult {
  allowed: boolean
  isLoading: boolean
}

async function checkSanctions(): Promise<boolean> {
  const response = await fetch(sanctionsApiUrl as string)
  if (response.status === 403) return false
  if (!response.ok) throw new Error(`Sanctions check failed: ${response.status}`)
  return true
}

export function useSanctionsCheck(): SanctionsResult {
  const { data, isLoading, isError } = useQuery({
    queryKey: ["sanctions"],
    queryFn: checkSanctions,
    enabled: !!sanctionsApiUrl,
    retry: false,
    staleTime: Infinity,
  })

  if (!sanctionsApiUrl) return { allowed: true, isLoading: false }

  // Fail-closed: block on error
  if (isError) return { allowed: false, isLoading: false }

  return { allowed: data ?? true, isLoading }
}
