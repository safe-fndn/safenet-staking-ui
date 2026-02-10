import { parseAbi } from "viem"

export const sanctionsOracleAbi = parseAbi([
  "function isSanctioned(address addr) external view returns (bool)",
])
