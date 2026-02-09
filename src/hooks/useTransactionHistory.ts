import { useQuery } from "@tanstack/react-query"
import { usePublicClient, useAccount } from "wagmi"
import { parseAbiItem, type Address, type Log } from "viem"
import { getContractAddresses, deployBlock } from "@/config/contracts"
import { activeChain } from "@/config/chains"

const MAX_BLOCK_RANGE = 49_999n

const STAKE_EVENT = parseAbiItem("event StakeIncreased(address indexed staker, address indexed validator, uint256 amount)")
const WITHDRAWAL_INITIATED_EVENT = parseAbiItem("event WithdrawalInitiated(address indexed staker, address indexed validator, uint64 indexed withdrawalId, uint256 amount)")
const WITHDRAWAL_CLAIMED_EVENT = parseAbiItem("event WithdrawalClaimed(address indexed staker, uint64 indexed withdrawalId, uint256 amount)")

export type TxType = "delegation" | "withdrawal_initiated" | "withdrawal_claimed"

export interface TransactionRecord {
  type: TxType
  validator?: Address
  amount: bigint
  blockNumber: bigint
  txHash: string
  timestamp?: number
}

async function fetchLogsChunked(
  client: NonNullable<ReturnType<typeof usePublicClient>>,
  params: { address: Address; event: ReturnType<typeof parseAbiItem>; args: Record<string, unknown>; fromBlock: bigint; toBlock: string | bigint },
): Promise<Log[]> {
  try {
    return await client.getLogs(params as Parameters<typeof client.getLogs>[0])
  } catch {
    const latestBlock = await client.getBlockNumber()
    const logs: Log[] = []
    let toBlock = latestBlock
    const minBlock = deployBlock > 0n ? deployBlock : 0n

    while (toBlock >= minBlock) {
      const fromBlock = toBlock - MAX_BLOCK_RANGE > minBlock ? toBlock - MAX_BLOCK_RANGE : minBlock
      try {
        const chunk = await client.getLogs({
          ...params,
          fromBlock,
          toBlock,
        } as Parameters<typeof client.getLogs>[0])
        logs.unshift(...chunk)
      } catch {
        // skip chunk on error
      }
      if (fromBlock === minBlock) break
      toBlock = fromBlock - 1n
    }
    return logs
  }
}

export function useTransactionHistory(validatorFilter?: Address) {
  const client = usePublicClient()
  const { address } = useAccount()
  const { staking } = getContractAddresses(activeChain.id)

  return useQuery({
    queryKey: ["transactionHistory", address, validatorFilter],
    queryFn: async (): Promise<TransactionRecord[]> => {
      if (!client || !address) return []

      const baseParams = { address: staking, fromBlock: deployBlock, toBlock: "latest" as const }

      const [stakeLogs, withdrawInitLogs, withdrawClaimLogs] = await Promise.all([
        fetchLogsChunked(client, {
          ...baseParams,
          event: STAKE_EVENT,
          args: { staker: address, ...(validatorFilter ? { validator: validatorFilter } : {}) },
        }),
        fetchLogsChunked(client, {
          ...baseParams,
          event: WITHDRAWAL_INITIATED_EVENT,
          args: { staker: address, ...(validatorFilter ? { validator: validatorFilter } : {}) },
        }),
        fetchLogsChunked(client, {
          ...baseParams,
          event: WITHDRAWAL_CLAIMED_EVENT,
          args: { staker: address },
        }),
      ])

      const records: TransactionRecord[] = []

      for (const log of stakeLogs) {
        const args = (log as unknown as { args: { validator: Address; amount: bigint } }).args
        records.push({
          type: "delegation",
          validator: args.validator,
          amount: args.amount,
          blockNumber: log.blockNumber ?? 0n,
          txHash: log.transactionHash ?? "",
        })
      }

      for (const log of withdrawInitLogs) {
        const args = (log as unknown as { args: { validator: Address; amount: bigint } }).args
        records.push({
          type: "withdrawal_initiated",
          validator: args.validator,
          amount: args.amount,
          blockNumber: log.blockNumber ?? 0n,
          txHash: log.transactionHash ?? "",
        })
      }

      for (const log of withdrawClaimLogs) {
        const args = (log as unknown as { args: { amount: bigint } }).args
        records.push({
          type: "withdrawal_claimed",
          amount: args.amount,
          blockNumber: log.blockNumber ?? 0n,
          txHash: log.transactionHash ?? "",
        })
      }

      // Sort by block number descending, limit to 50
      return records
        .toSorted((a, b) => (a.blockNumber > b.blockNumber ? -1 : a.blockNumber < b.blockNumber ? 1 : 0))
        .slice(0, 50)
    },
    staleTime: 60_000,
    enabled: !!client && !!address,
  })
}
