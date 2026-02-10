import { useAccount, useReadContract } from "wagmi"
import { sanctionsOracleAbi } from "@/abi/sanctionsOracleAbi"
import { getContractAddresses } from "@/config/contracts"
import { activeChain } from "@/config/chains"

const { sanctionsOracle } = getContractAddresses(activeChain.id)

export function useWalletSanctionsCheck() {
  const { address } = useAccount()

  const { data: isSanctioned, isLoading } = useReadContract({
    address: sanctionsOracle,
    abi: sanctionsOracleAbi,
    functionName: "isSanctioned",
    args: address ? [address] : undefined,
    query: {
      enabled: !!address && !!sanctionsOracle,
      staleTime: 60_000,
    },
  })

  // No oracle on this chain or wallet not connected → allow
  if (!sanctionsOracle || !address) {
    return { allowed: true, isLoading: false }
  }

  // Fail-closed: only allow when oracle explicitly returns false
  return {
    allowed: isSanctioned === false,
    isLoading,
  }
}
