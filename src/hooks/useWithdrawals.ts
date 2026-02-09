import { useReadContract, useAccount } from "wagmi"
import { stakingAbi } from "@/abi/stakingAbi"
import { getContractAddresses } from "@/config/contracts"
import { activeChain } from "@/config/chains"

const addresses = getContractAddresses(activeChain.id)

export function usePendingWithdrawals() {
  const { address } = useAccount()
  return useReadContract({
    address: addresses.staking,
    abi: stakingAbi,
    functionName: "getPendingWithdrawals",
    args: [address!],
    query: { enabled: !!address },
  })
}

export function useNextClaimable() {
  const { address } = useAccount()
  return useReadContract({
    address: addresses.staking,
    abi: stakingAbi,
    functionName: "getNextClaimableWithdrawal",
    args: [address!],
    query: { enabled: !!address },
  })
}
