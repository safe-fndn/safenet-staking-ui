import { http, type Chain } from "viem"
import { sepolia, mainnet } from "wagmi/chains"

const chainId = Number(import.meta.env.VITE_CHAIN_ID || 11155111)
const rpcUrl = import.meta.env.VITE_RPC_URL as string | undefined

const chainMap: Record<number, Chain> = {
  1: mainnet,
  11155111: sepolia,
}

export const activeChain: Chain = chainMap[chainId] ?? sepolia

export const transports = {
  [activeChain.id]: http(rpcUrl, { batch: true }),
}
