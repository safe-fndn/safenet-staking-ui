import { useQuery } from "@tanstack/react-query"
import { usePublicClient } from "wagmi"
import {
  decodeEventLog,
  formatUnits,
  parseAbiItem,
  type Address,
  type Log,
} from "viem"
import { getContractAddresses, deployBlock } from "@/config/contracts"
import { activeChain } from "@/config/chains"

const MAX_BLOCK_RANGE = 49_999n

export interface DecodedEvent {
  name: string
  blockNumber: bigint
  transactionHash: string
  args: Record<string, string>
}

const eventAbis = [
  parseAbiItem("event StakeIncreased(address indexed staker, address indexed validator, uint256 amount)"),
  parseAbiItem("event WithdrawalInitiated(address indexed staker, address indexed validator, uint64 indexed withdrawalId, uint256 amount)"),
  parseAbiItem("event WithdrawalClaimed(address indexed staker, uint64 indexed withdrawalId, uint256 amount)"),
  parseAbiItem("event ValidatorUpdated(address indexed validator, bool isRegistered)"),
  parseAbiItem("event WithdrawDelayProposed(uint256 currentDelay, uint256 proposedDelay, uint256 executableAt)"),
  parseAbiItem("event ValidatorsProposed(bytes32 indexed validatorsHash, address[] validator, bool[] isRegistration, uint256 executableAt)"),
  parseAbiItem("event WithdrawDelayChanged(uint256 oldDelay, uint256 newDelay)"),
  parseAbiItem("event TokensRecovered(address indexed token, address indexed to, uint256 amount)"),
  parseAbiItem("event OwnershipTransferred(address indexed previousOwner, address indexed newOwner)"),
] as const

function formatArgValue(name: string, value: unknown): string {
  if (typeof value === "bigint") {
    if (name === "amount") return `${formatUnits(value, 18)} SAFE`
    if (name === "executableAt") {
      return `${value.toString()} (${new Date(Number(value) * 1000).toLocaleString()})`
    }
    return value.toString()
  }
  if (typeof value === "boolean") return value ? "true" : "false"
  if (Array.isArray(value)) {
    return value.map((v) => String(v)).join(", ")
  }
  return String(value)
}

function tryDecodeLog(log: Log): DecodedEvent | null {
  for (const eventAbi of eventAbis) {
    try {
      const decoded = decodeEventLog({
        abi: [eventAbi],
        data: log.data,
        topics: log.topics,
      })
      const args: Record<string, string> = {}
      if (decoded.args && typeof decoded.args === "object") {
        for (const [key, val] of Object.entries(decoded.args as Record<string, unknown>)) {
          args[key] = formatArgValue(key, val)
        }
      }
      return {
        name: decoded.eventName,
        blockNumber: log.blockNumber!,
        transactionHash: log.transactionHash!,
        args,
      }
    } catch {
      // Not this event
    }
  }
  return null
}

async function fetchLogsChunked(
  client: NonNullable<ReturnType<typeof usePublicClient>>,
  address: Address,
  fromBlock: bigint,
  toBlock: bigint,
): Promise<Log[]> {
  // Try full range first
  try {
    return await client.getLogs({ address, fromBlock, toBlock })
  } catch {
    // Fall back to chunked
  }

  const allLogs: Log[] = []
  let currentTo = toBlock
  while (currentTo >= fromBlock) {
    const currentFrom = currentTo - MAX_BLOCK_RANGE > fromBlock ? currentTo - MAX_BLOCK_RANGE : fromBlock
    try {
      const logs = await client.getLogs({ address, fromBlock: currentFrom, toBlock: currentTo })
      allLogs.unshift(...logs)
    } catch {
      // skip chunk on error
    }
    if (currentFrom === fromBlock) break
    currentTo = currentFrom - 1n
  }
  return allLogs
}

export function useContractEvents(limit = 50) {
  const client = usePublicClient()
  const { staking } = getContractAddresses(activeChain.id)

  return useQuery({
    queryKey: ["contractEvents", staking, limit],
    queryFn: async (): Promise<DecodedEvent[]> => {
      if (!client) throw new Error("No public client")

      const latestBlock = await client.getBlockNumber()
      const fromBlock = deployBlock > 0n ? deployBlock : (latestBlock > 50000n ? latestBlock - 50000n : 0n)

      const rawLogs = await fetchLogsChunked(client, staking, fromBlock, latestBlock)

      const decoded: DecodedEvent[] = []
      for (const log of rawLogs) {
        const event = tryDecodeLog(log)
        if (event) decoded.push(event)
      }

      // Most recent first, limited
      return decoded.reverse().slice(0, limit)
    },
    staleTime: 30_000,
    enabled: !!client,
  })
}
