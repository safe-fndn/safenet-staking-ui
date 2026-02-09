import { useReadContract, useReadContracts } from "wagmi"
import { stakingAbi } from "@/abi/stakingAbi"
import { getContractAddresses } from "@/config/contracts"
import { activeChain } from "@/config/chains"

const addresses = getContractAddresses(activeChain.id)

export function useOwner() {
  return useReadContract({
    address: addresses.staking,
    abi: stakingAbi,
    functionName: "owner",
  })
}

export function useWithdrawDelay() {
  return useReadContract({
    address: addresses.staking,
    abi: stakingAbi,
    functionName: "withdrawDelay",
  })
}

export function useConfigTimeDelay() {
  return useReadContract({
    address: addresses.staking,
    abi: stakingAbi,
    functionName: "CONFIG_TIME_DELAY",
  })
}

export function usePendingWithdrawDelayChange() {
  return useReadContract({
    address: addresses.staking,
    abi: stakingAbi,
    functionName: "pendingWithdrawDelayChange",
  })
}

export function usePendingValidatorChangeHash() {
  return useReadContract({
    address: addresses.staking,
    abi: stakingAbi,
    functionName: "pendingValidatorChangeHash",
  })
}

export function useContractStatus() {
  return useReadContracts({
    contracts: [
      {
        address: addresses.staking,
        abi: stakingAbi,
        functionName: "owner",
      },
      {
        address: addresses.staking,
        abi: stakingAbi,
        functionName: "withdrawDelay",
      },
      {
        address: addresses.staking,
        abi: stakingAbi,
        functionName: "CONFIG_TIME_DELAY",
      },
      {
        address: addresses.staking,
        abi: stakingAbi,
        functionName: "pendingWithdrawDelayChange",
      },
      {
        address: addresses.staking,
        abi: stakingAbi,
        functionName: "pendingValidatorChangeHash",
      },
      {
        address: addresses.staking,
        abi: stakingAbi,
        functionName: "totalStakedAmount",
      },
      {
        address: addresses.staking,
        abi: stakingAbi,
        functionName: "totalPendingWithdrawals",
      },
    ],
  })
}
