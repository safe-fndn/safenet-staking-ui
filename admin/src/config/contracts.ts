import type { Address } from "viem"

type ContractAddresses = {
  staking: Address
  token: Address
}

const addresses: Record<number, ContractAddresses> = {
  11155111: {
    staking: "0x6E4D214A7FA04be157b1Aae498b395bd21Da0aF5",
    token: "0xef98bcc90b1373b2ae0d23ec318d3ee70ea61af4",
  },
}

export function getContractAddresses(chainId: number): ContractAddresses {
  const addrs = addresses[chainId]
  if (!addrs) throw new Error(`No contract addresses for chain ${chainId}`)
  return addrs
}

export const deployBlock = BigInt(import.meta.env.VITE_STAKING_DEPLOY_BLOCK || "0")
