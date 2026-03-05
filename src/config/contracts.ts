import type { Address } from "viem"

type ContractAddresses = {
  staking: Address
  token: Address
  merkleDrop?: Address
  sanctionsOracle?: Address
}

const addresses: Record<number, ContractAddresses> = {
  1: {
    staking: "0x115E78f160e1E3eF163B05C84562Fa16fA338509" as Address, // https://etherscan.io/address/0x115E78f160e1E3eF163B05C84562Fa16fA338509#code
    token: "0x5aFE3855358E112B5647B952709E6165e1c1eEEe",
    merkleDrop: import.meta.env.VITE_MERKLE_DROP_ADDRESS as Address | undefined,
    sanctionsOracle: "0x40C57923924B5c5c5455c48D93317139ADDaC8fb",
  },
  11155111: {
    staking: "0x40745eec3fD6E4C005de1dec0031b2EA9f9D7c42",
    token: "0xef98bcc90b1373b2ae0d23ec318d3ee70ea61af4",
    merkleDrop: import.meta.env.VITE_MERKLE_DROP_ADDRESS as Address | undefined,
  },
}

export function getContractAddresses(chainId: number): ContractAddresses {
  const addrs = addresses[chainId]
  if (!addrs) throw new Error(`No contract addresses for chain ${chainId}`)
  if (addrs.staking === "0x0000000000000000000000000000000000000000") {
    throw new Error(`Staking contract address not configured for chain ${chainId}`)
  }
  return addrs
}

export const deployBlock = BigInt(import.meta.env.VITE_STAKING_DEPLOY_BLOCK || "0")
