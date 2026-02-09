import { useReadContract, useAccount, useWriteContract, useWaitForTransactionReceipt } from "wagmi"
import { erc20Abi } from "@/abi/erc20Abi"
import { getContractAddresses } from "@/config/contracts"
import { activeChain } from "@/config/chains"

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

  const { writeContract, data: txHash, isPending: isApproving, reset } = useWriteContract()

  const { isLoading: isWaitingForApproval, isSuccess: isApproved } = useWaitForTransactionReceipt({
    hash: txHash,
  })

  function approve(amount: bigint) {
    writeContract({
      address: token,
      abi: erc20Abi,
      functionName: "approve",
      args: [staking, amount],
    })
  }

  return {
    allowance: allowance.data as bigint | undefined,
    refetchAllowance: allowance.refetch,
    approve,
    isApproving: isApproving || isWaitingForApproval,
    isApproved,
    resetApproval: reset,
  }
}
