import { useReadContract, useAccount, useReadContracts } from "wagmi"
import { stakingAbi } from "@/abi/stakingAbi"
import { getContractAddresses } from "@/config/contracts"
import { activeChain } from "@/config/chains"
import type { Address } from "viem"

const addresses = getContractAddresses(activeChain.id)

export function useTotalStaked() {
  return useReadContract({
    address: addresses.staking,
    abi: stakingAbi,
    functionName: "totalStakedAmount",
  })
}

export function useTotalPendingWithdrawals() {
  return useReadContract({
    address: addresses.staking,
    abi: stakingAbi,
    functionName: "totalPendingWithdrawals",
  })
}

export function useWithdrawDelay() {
  return useReadContract({
    address: addresses.staking,
    abi: stakingAbi,
    functionName: "withdrawDelay",
  })
}

export function useUserTotalStake() {
  const { address } = useAccount()
  return useReadContract({
    address: addresses.staking,
    abi: stakingAbi,
    functionName: "totalStakerStakes",
    args: [address!],
    query: { enabled: !!address },
  })
}

export function useUserStakeOnValidator(validator: Address) {
  const { address } = useAccount()
  return useReadContract({
    address: addresses.staking,
    abi: stakingAbi,
    functionName: "stakes",
    args: [address!, validator],
    query: { enabled: !!address },
  })
}

export function useValidatorTotalStake(validator: Address) {
  return useReadContract({
    address: addresses.staking,
    abi: stakingAbi,
    functionName: "totalValidatorStakes",
    args: [validator],
  })
}

export function useUserStakesOnValidators(validators: Address[]) {
  const { address } = useAccount()
  return useReadContracts({
    contracts: validators.map((v) => ({
      address: addresses.staking,
      abi: stakingAbi,
      functionName: "stakes" as const,
      args: [address!, v],
    })),
    query: { enabled: !!address && validators.length > 0 },
  })
}

export function useValidatorTotalStakes(validators: Address[]) {
  return useReadContracts({
    contracts: validators.map((v) => ({
      address: addresses.staking,
      abi: stakingAbi,
      functionName: "totalValidatorStakes" as const,
      args: [v],
    })),
    query: { enabled: validators.length > 0 },
  })
}
