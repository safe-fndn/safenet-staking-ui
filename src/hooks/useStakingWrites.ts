import { useEffect } from "react"
import { useWriteContract, useWaitForTransactionReceipt } from "wagmi"
import { stakingAbi } from "@/abi/stakingAbi"
import { getContractAddresses } from "@/config/contracts"
import { activeChain } from "@/config/chains"
import { queryClient } from "@/main"
import type { Address } from "viem"

const addresses = getContractAddresses(activeChain.id)

export function useInvalidateOnSuccess(isSuccess: boolean, extraKeys: string[][] = []) {
  useEffect(() => {
    if (isSuccess) {
      queryClient.invalidateQueries({ queryKey: ["readContract"] })
      queryClient.invalidateQueries({ queryKey: ["readContracts"] })
      for (const key of extraKeys) {
        queryClient.invalidateQueries({ queryKey: key })
      }
    }
  }, [isSuccess, extraKeys])
}

const STAKING_EXTRA_KEYS = [["validators"]]

export function useStake() {
  const { writeContract, data: txHash, isPending, reset, error } = useWriteContract()
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash: txHash })

  useInvalidateOnSuccess(isSuccess, STAKING_EXTRA_KEYS)

  function stake(validator: Address, amount: bigint) {
    writeContract({
      address: addresses.staking,
      abi: stakingAbi,
      functionName: "stake",
      args: [validator, amount],
    })
  }

  return { stake, isSigningTx: isPending, isConfirmingTx: isConfirming, isSuccess, error, reset, txHash }
}

export function useInitiateWithdrawal() {
  const { writeContract, data: txHash, isPending, reset, error } = useWriteContract()
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash: txHash })

  useInvalidateOnSuccess(isSuccess, STAKING_EXTRA_KEYS)

  function initiateWithdrawal(validator: Address, amount: bigint) {
    writeContract({
      address: addresses.staking,
      abi: stakingAbi,
      functionName: "initiateWithdrawal",
      args: [validator, amount],
    })
  }

  return { initiateWithdrawal, isSigningTx: isPending, isConfirmingTx: isConfirming, isSuccess, error, reset, txHash }
}

export function useClaimWithdrawal() {
  const { writeContract, data: txHash, isPending, reset, error } = useWriteContract()
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash: txHash })

  useInvalidateOnSuccess(isSuccess, STAKING_EXTRA_KEYS)

  function claimWithdrawal() {
    writeContract({
      address: addresses.staking,
      abi: stakingAbi,
      functionName: "claimWithdrawal",
    })
  }

  return { claimWithdrawal, isSigningTx: isPending, isConfirmingTx: isConfirming, isSuccess, error, reset, txHash }
}
