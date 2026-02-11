import { useQuery } from "@tanstack/react-query"
import { usePublicClient, useAccount } from "wagmi"
import { parseAbiItem, type Address, type Log } from "viem"
import { getContractAddresses, deployBlock } from "@/config/contracts"
import { activeChain } from "@/config/chains"

const MAX_BLOCK_RANGE = 9_999n

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

const CONCURRENCY = 5

async function runWithConcurrency<T>(tasks: (() => Promise<T>)[], concurrency: number): Promise<T[]> {
  const results: T[] = new Array(tasks.length)
  let nextIndex = 0

  async function worker() {
    while (nextIndex < tasks.length) {
      const index = nextIndex++
      results[index] = await tasks[index]()
    }
  }

  await Promise.all(Array.from({ length: Math.min(concurrency, tasks.length) }, () => worker()))
  return results
}

async function fetchLogsChunked(
  client: NonNullable<ReturnType<typeof usePublicClient>>,
  params: { address: Address; event: ReturnType<typeof parseAbiItem>; args: Record<string, unknown>; fromBlock: bigint; toBlock: string | bigint },
): Promise<Log[]> {
  try {
    return await client.getLogs(params as Parameters<typeof client.getLogs>[0])
  } catch {
    const latestBlock = await client.getBlockNumber()
    const minBlock = deployBlock > 0n ? deployBlock : 0n

    const chunks: { fromBlock: bigint; toBlock: bigint }[] = []
    let to = latestBlock
    while (to >= minBlock) {
      const from = to - MAX_BLOCK_RANGE > minBlock ? to - MAX_BLOCK_RANGE : minBlock
      chunks.push({ fromBlock: from, toBlock: to })
      if (from === minBlock) break
      to = from - 1n
    }

    const tasks = chunks.map(({ fromBlock, toBlock }) => async () => {
      try {
        return await client.getLogs({
          ...params,
          fromBlock,
          toBlock,
        } as Parameters<typeof client.getLogs>[0])
      } catch {
        return [] as Log[]
      }
    })

    const results = await runWithConcurrency(tasks, CONCURRENCY)
    return results.flat()
  }
}

export function useTransactionHistory(validatorFilter?: Address, { enabled = true }: { enabled?: boolean } = {}) {
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
    enabled: !!client && !!address && enabled,
  })
}
