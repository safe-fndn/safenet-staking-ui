import { useAccount, useReadContract } from "wagmi"
import { merkleDropAbi } from "@/abi/merkleDropAbi"
import { getContractAddresses } from "@/config/contracts"
import { activeChain } from "@/config/chains"
import { useRewardProof } from "./useRewardProof"

const { merkleDrop } = getContractAddresses(activeChain.id)

export interface RewardsData {
  claimable: bigint
  totalClaimed: bigint
  canClaim: boolean
  rootStale: boolean
}

export function useRewards() {
  const { address } = useAccount()

  const { data: proof, isLoading: isProofLoading } = useRewardProof(address, !!merkleDrop)

  const hasProof = !!proof

  const { data: cumulativeClaimed, isLoading: isClaimedLoading } = useReadContract({
    address: merkleDrop,
    abi: merkleDropAbi,
    functionName: "cumulativeClaimed",
    args: address ? [address] : undefined,
    query: {
      enabled: !!address && !!merkleDrop && hasProof,
      refetchInterval: 15_000,
    },
  })

  const { data: onChainRoot } = useReadContract({
    address: merkleDrop,
    abi: merkleDropAbi,
    functionName: "merkleRoot",
    query: {
      enabled: !!merkleDrop && hasProof,
      staleTime: 60_000,
    },
  })

  const isLoading = isProofLoading || isClaimedLoading

  if (!proof || cumulativeClaimed === undefined) {
    return {
      data: { claimable: 0n, totalClaimed: 0n, canClaim: false, rootStale: false },
      isLoading,
    }
  }

  const cumulativeAmount = BigInt(proof.cumulativeAmount)
  const claimable = cumulativeAmount > cumulativeClaimed ? cumulativeAmount - cumulativeClaimed : 0n
  const rootStale = !!onChainRoot && onChainRoot !== proof.merkleRoot

  return {
    data: {
      claimable,
      totalClaimed: cumulativeClaimed,
      canClaim: claimable > 0n && !rootStale,
      rootStale,
    },
    isLoading,
  }
}
