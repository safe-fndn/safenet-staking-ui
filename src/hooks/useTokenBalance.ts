import { useReadContract, useAccount } from "wagmi"
import { erc20Abi } from "@/abi/erc20Abi"
import { getContractAddresses } from "@/config/contracts"
import { activeChain } from "@/config/chains"

export function useTokenBalance() {
  const { address } = useAccount()
  const { token } = getContractAddresses(activeChain.id)

  return useReadContract({
    address: token,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: [address!],
    query: { enabled: !!address },
  })
}
