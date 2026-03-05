import { useReadContract, useAccount } from "wagmi"
import { stakingAbi } from "@/abi/stakingAbi"
import { getContractAddresses } from "@/config/contracts"
import { activeChain } from "@/config/chains"

const addresses = getContractAddresses(activeChain.id)
const POLL_INTERVAL = 15_000

export function usePendingWithdrawals() {
  const { address } = useAccount()
  return useReadContract({
    address: addresses.staking,
    abi: stakingAbi,
    functionName: "getPendingWithdrawals",
    args: address ? [address] : undefined,
    query: { enabled: !!address, refetchInterval: POLL_INTERVAL },
  })
}

export function useNextClaimable() {
  const { address } = useAccount()
  return useReadContract({
    address: addresses.staking,
    abi: stakingAbi,
    functionName: "getNextClaimableWithdrawal",
    args: address ? [address] : undefined,
    query: { enabled: !!address, refetchInterval: POLL_INTERVAL },
  })
}
