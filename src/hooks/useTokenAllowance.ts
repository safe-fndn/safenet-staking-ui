import { useEffect } from "react"
import { useReadContract, useAccount, useWriteContract, useWaitForTransactionReceipt } from "wagmi"
import { maxUint256 } from "viem"
import { erc20Abi } from "@/abi/erc20Abi"
import { getContractAddresses } from "@/config/contracts"
import { activeChain } from "@/config/chains"
import { queryClient } from "@/main"

const isSafeApp = window.self !== window.top

export function useTokenAllowance() {
  const { address } = useAccount()
  const { token, staking } = getContractAddresses(activeChain.id)

  const allowance = useReadContract({
    address: token,
    abi: erc20Abi,
    functionName: "allowance",
    args: [address!, staking],
    query: { enabled: !!address },
  })

  const { writeContract, data: txHash, isPending, isSuccess: isSubmitted, reset, error } = useWriteContract()

  const { isLoading: isWaitingForApproval, isSuccess: isApproved } = useWaitForTransactionReceipt({
    hash: txHash,
  })

  // In Safe App mode, the approval tx is queued in Safe (not yet on-chain), so
  // isApproved never fires. Detect this so the UI can inform the user.
  const isSafeApprovalQueued = isSafeApp && isSubmitted && !isApproved

  useEffect(() => {
    if (isApproved) {
      queryClient.invalidateQueries({ queryKey: ["readContract"] })
      queryClient.invalidateQueries({ queryKey: ["readContracts"] })
    }
  }, [isApproved])

  function approve(amount: bigint) {
    writeContract({
      address: token,
      abi: erc20Abi,
      functionName: "approve",
      args: [staking, amount],
    })
  }

  function approveUnlimited() {
    writeContract({
      address: token,
      abi: erc20Abi,
      functionName: "approve",
      args: [staking, maxUint256],
    })
  }

  return {
    allowance: allowance.data as bigint | undefined,
    refetchAllowance: allowance.refetch,
    approve,
    approveUnlimited,
    isSigningApproval: isPending,
    isConfirmingApproval: isWaitingForApproval,
    isApproved,
    isSafeApprovalQueued,
    approvalError: error,
    approvalTxHash: txHash,
    resetApproval: reset,
  }
}
