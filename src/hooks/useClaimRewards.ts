import { useWriteContract, useWaitForTransactionReceipt } from "wagmi"
import { merkleDropAbi } from "@/abi/merkleDropAbi"
import { getContractAddresses } from "@/config/contracts"
import { activeChain } from "@/config/chains"
import { useInvalidateOnSuccess } from "./useStakingWrites"
import { getAddress } from "viem"
import type { Address, Hex } from "viem"

const { merkleDrop } = getContractAddresses(activeChain.id)

const REWARD_EXTRA_KEYS = [["rewardProof"]]

export function useClaimRewards() {
  const { writeContract, data: txHash, isPending, reset, error } = useWriteContract()
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash: txHash })

  useInvalidateOnSuccess(isSuccess, REWARD_EXTRA_KEYS)

  function claimRewards(
    account: Address,
    cumulativeAmount: bigint,
    expectedMerkleRoot: Hex,
    merkleProof: Hex[],
  ) {
    if (!merkleDrop) return
    const normalizedAccount = getAddress(account)
    writeContract({
      address: merkleDrop,
      abi: merkleDropAbi,
      functionName: "claim",
      args: [normalizedAccount, cumulativeAmount, expectedMerkleRoot, merkleProof],
    })
  }

  return {
    claimRewards,
    isSigningTx: isPending,
    isConfirmingTx: isConfirming,
    isSuccess,
    error,
    reset,
    txHash,
  }
}
