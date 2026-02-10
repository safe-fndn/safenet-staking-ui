import { useQuery } from "@tanstack/react-query"
import { getAddress } from "viem"
import type { Address, Hex } from "viem"

export interface RewardProof {
  cumulativeAmount: string
  merkleRoot: Hex
  proof: Hex[]
}

function isValidProof(data: unknown): data is RewardProof {
  if (typeof data !== "object" || data === null) return false
  const obj = data as Record<string, unknown>
  return (
    typeof obj.cumulativeAmount === "string" &&
    typeof obj.merkleRoot === "string" &&
    obj.merkleRoot.startsWith("0x") &&
    Array.isArray(obj.proof) &&
    obj.proof.every((p) => typeof p === "string" && (p as string).startsWith("0x"))
  )
}

async function fetchProof(address: Address): Promise<RewardProof | null> {
  const normalized = getAddress(address)
  const url = `${import.meta.env.BASE_URL}rewards/proofs/${normalized.toLowerCase()}.json`
  const response = await fetch(url)
  if (response.status === 404) return null
  if (!response.ok) throw new Error(`Failed to fetch reward proof: ${response.status}`)
  const json: unknown = await response.json()
  if (!isValidProof(json)) throw new Error("Invalid reward proof format")
  return json
}

export function useRewardProof(address: Address | undefined, enabled = true) {
  return useQuery({
    queryKey: ["rewardProof", address],
    queryFn: () => fetchProof(address!),
    enabled: !!address && enabled,
    staleTime: 5 * 60 * 1000,
    retry: false,
  })
}
