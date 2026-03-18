import { useAccount } from "wagmi"
import { activeChain } from "@/config/chains"

/** Returns true when the wallet is connected to a chain that doesn't match the configured chain. */
export function useWrongNetwork(): boolean {
  const { chainId } = useAccount()
  if (chainId === undefined) return false
  return chainId !== activeChain.id
}
