import { useAccount, useReadContract } from "wagmi"
import { merkleDropAbi } from "@/abi/merkleDropAbi"
import { getContractAddresses } from "@/config/contracts"
import { activeChain } from "@/config/chains"
import { encodeLeaf, verifyProof } from "@/lib/merkle"
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

  const { data: onChainRoot, isLoading: isRootLoading } = useReadContract({
    address: merkleDrop,
    abi: merkleDropAbi,
    functionName: "merkleRoot",
    query: {
      enabled: !!merkleDrop && hasProof,
      staleTime: 60_000,
      refetchInterval: 15_000,
    },
  })

  const isLoading = isProofLoading || isClaimedLoading || isRootLoading

  if (!address || !proof || cumulativeClaimed === undefined) {
    return {
      data: { claimable: 0n, totalClaimed: 0n, canClaim: false, rootStale: false },
      isLoading,
    }
  }

  const cumulativeAmount = BigInt(proof.cumulativeAmount)
  const rootStale = !!onChainRoot && onChainRoot !== proof.merkleRoot
  // The proof file is untrusted: count its amount only if it proves into the onchain root.
  const verified =
    onChainRoot === proof.merkleRoot &&
    proof.proof !== null &&
    verifyProof(encodeLeaf(address, cumulativeAmount), proof.proof, onChainRoot)
  const claimable = verified && cumulativeAmount > cumulativeClaimed ? cumulativeAmount - cumulativeClaimed : 0n

  return {
    data: {
      claimable,
      totalClaimed: cumulativeClaimed,
      canClaim: claimable > 0n,
      rootStale,
    },
    isLoading,
  }
}
