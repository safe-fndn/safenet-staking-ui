import { useEffect } from "react"
import { useWriteContract, useWaitForTransactionReceipt } from "wagmi"
import { stakingAbi } from "@/abi/stakingAbi"
import { getContractAddresses } from "@/config/contracts"
import { activeChain } from "@/config/chains"
import { queryClient } from "@/main"
import type { Address } from "viem"

const addresses = getContractAddresses(activeChain.id)

function useInvalidateOnSuccess(isSuccess: boolean) {
  useEffect(() => {
    if (isSuccess) {
      queryClient.invalidateQueries({ queryKey: ["readContract"] })
      queryClient.invalidateQueries({ queryKey: ["readContracts"] })
      queryClient.invalidateQueries({ queryKey: ["validators"] })
    }
  }, [isSuccess])
}

export function useStake() {
  const { writeContract, data: txHash, isPending, reset, error } = useWriteContract()
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash: txHash })

  useInvalidateOnSuccess(isSuccess)

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

  useInvalidateOnSuccess(isSuccess)

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

  useInvalidateOnSuccess(isSuccess)

  function claimWithdrawal() {
    writeContract({
      address: addresses.staking,
      abi: stakingAbi,
      functionName: "claimWithdrawal",
    })
  }

  return { claimWithdrawal, isSigningTx: isPending, isConfirmingTx: isConfirming, isSuccess, error, reset, txHash }
}
