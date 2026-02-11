import { useWriteContract, useWaitForTransactionReceipt } from "wagmi"
import { stakingAbi } from "@/abi/stakingAbi"
import { erc20Abi } from "@/abi/erc20Abi"
import { getContractAddresses } from "@/config/contracts"
import { activeChain } from "@/config/chains"
import type { Address } from "viem"

const addresses = getContractAddresses(activeChain.id)

export function useProposeWithdrawDelay() {
  const { writeContract, data: txHash, isPending, reset, error } = useWriteContract()
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash: txHash })

  function proposeWithdrawDelay(newDelay: bigint) {
    writeContract({
      address: addresses.staking,
      abi: stakingAbi,
      functionName: "proposeWithdrawDelay",
      args: [newDelay],
    })
  }

  return { proposeWithdrawDelay, isPending: isPending || isConfirming, isSuccess, error, reset, txHash }
}

export function useExecuteWithdrawDelayChange() {
  const { writeContract, data: txHash, isPending, reset, error } = useWriteContract()
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash: txHash })

  function executeWithdrawDelayChange() {
    writeContract({
      address: addresses.staking,
      abi: stakingAbi,
      functionName: "executeWithdrawDelayChange",
    })
  }

  return { executeWithdrawDelayChange, isPending: isPending || isConfirming, isSuccess, error, reset, txHash }
}

export function useProposeValidators() {
  const { writeContract, data: txHash, isPending, reset, error } = useWriteContract()
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash: txHash })

  function proposeValidators(validators: Address[], isRegistration: boolean[]) {
    writeContract({
      address: addresses.staking,
      abi: stakingAbi,
      functionName: "proposeValidators",
      args: [validators, isRegistration],
    })
  }

  return { proposeValidators, isPending: isPending || isConfirming, isSuccess, error, reset, txHash }
}

export function useExecuteValidatorChanges() {
  const { writeContract, data: txHash, isPending, reset, error } = useWriteContract()
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash: txHash })

  function executeValidatorChanges(validators: Address[], isRegistration: boolean[], executableAt: bigint) {
    writeContract({
      address: addresses.staking,
      abi: stakingAbi,
      functionName: "executeValidatorChanges",
      args: [validators, isRegistration, executableAt],
    })
  }

  return { executeValidatorChanges, isPending: isPending || isConfirming, isSuccess, error, reset, txHash }
}

export function useRecoverTokens() {
  const { writeContract, data: txHash, isPending, reset, error } = useWriteContract()
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash: txHash })

  function recoverTokens(token: Address, to: Address) {
    writeContract({
      address: addresses.staking,
      abi: stakingAbi,
      functionName: "recoverTokens",
      args: [token, to],
    })
  }

  return { recoverTokens, isPending: isPending || isConfirming, isSuccess, error, reset, txHash }
}

export function useMintToken() {
  const { writeContract, data: txHash, isPending, reset, error } = useWriteContract()
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash: txHash })

  function mintToken(to: Address, amount: bigint) {
    writeContract({
      address: addresses.token,
      abi: erc20Abi,
      functionName: "mint",
      args: [to, amount],
    })
  }

  return { mintToken, isPending: isPending || isConfirming, isSuccess, error, reset, txHash }
}
