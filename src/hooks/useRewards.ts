import { useAccount, useReadContract } from "wagmi"
import { merkleDropAbi } from "@/abi/merkleDropAbi"
import { getContractAddresses } from "@/config/contracts"
import { activeChain } from "@/config/chains"
import { useRewardProof } from "./useRewardProof"

const { merkleDrop } = getContractAddresses(activeChain.id)

export interface RewardsData {
  claimable: bigint
  canClaim: boolean
}

export function useRewards() {
  const { address } = useAccount()

  const { data: proof, isLoading: isProofLoading } = useRewardProof(address, !!merkleDrop)

  const { data: cumulativeClaimed, isLoading: isClaimedLoading } = useReadContract({
    address: merkleDrop,
    abi: merkleDropAbi,
    functionName: "cumulativeClaimed",
    args: address ? [address] : undefined,
    query: {
      enabled: !!address && !!merkleDrop,
    },
  })

  const isLoading = isProofLoading || isClaimedLoading

  if (!proof || cumulativeClaimed === undefined) {
    return {
      data: { claimable: 0n, canClaim: false },
      isLoading,
    }
  }

  const cumulativeAmount = BigInt(proof.cumulativeAmount)
  const claimable = cumulativeAmount > cumulativeClaimed ? cumulativeAmount - cumulativeClaimed : 0n

  return {
    data: {
      claimable,
      canClaim: claimable > 0n,
    },
    isLoading,
  }
}
