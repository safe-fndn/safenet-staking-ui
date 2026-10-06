import { useWriteContract, useWaitForTransactionReceipt } from "wagmi"
import { merkleDropAbi } from "@/abi/merkleDropAbi"
import { getContractAddresses } from "@/config/contracts"
import { activeChain } from "@/config/chains"
import { useInvalidateOnSuccess, REWARD_FN_NAMES, REWARD_EXTRA_KEYS } from "./useStakingWrites"
import { getAddress } from "viem"
import type { Address, Hex } from "viem"
import { isSafeApp } from "@/lib/safe"

const { merkleDrop } = getContractAddresses(activeChain.id)

export function useClaimRewards() {
  const { writeContract, data: txHash, isPending, isSuccess: isSubmitted, reset, error: writeError } = useWriteContract()
  const { isLoading: isConfirming, isSuccess, error: receiptError } = useWaitForTransactionReceipt({ hash: txHash })
  const error = writeError ?? receiptError

  // When running as a Safe App, writeContract resolves with a Safe tx hash (not an
  // on-chain hash). useWaitForTransactionReceipt never resolves, so detect the
  // "queued in Safe" state via useWriteContract's own isSuccess.
  const isSafeQueued = isSafeApp && isSubmitted && !isSuccess

  useInvalidateOnSuccess(isSuccess, REWARD_FN_NAMES, REWARD_EXTRA_KEYS)

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
    isSafeQueued,
    error,
    reset,
    txHash,
  }
}
