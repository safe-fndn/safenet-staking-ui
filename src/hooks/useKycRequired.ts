import { useQuery } from "@tanstack/react-query"
import type { Address } from "viem"

const DEFAULT_KYC_REQUIRED_URL =
  "https://raw.githubusercontent.com/safe-fndn/safenet-beta-data/refs/heads/main/assets/rewards/kyc_required.json"

const KYC_REQUIRED_URL =
  (import.meta.env.VITE_KYC_REQUIRED_URL as string | undefined) || DEFAULT_KYC_REQUIRED_URL

async function fetchKycRequired(): Promise<string[]> {
  const response = await fetch(KYC_REQUIRED_URL)
  if (!response.ok) throw new Error(`KYC required fetch failed: ${response.status}`)
  const json: unknown = await response.json()
  if (!Array.isArray(json)) throw new Error("Invalid KYC required data format")
  return json.filter((entry): entry is string => typeof entry === "string")
}

export function useKycRequired(address: Address | undefined): boolean {
  const { data: kycRequired } = useQuery({
    queryKey: ["kycRequired"],
    queryFn: fetchKycRequired,
    staleTime: 5 * 60_000,
    retry: false,
  })

  if (!address || !kycRequired) return false

  const normalizedAddress = address.toLowerCase()
  return kycRequired.some((addr) => addr.toLowerCase() === normalizedAddress)
}
