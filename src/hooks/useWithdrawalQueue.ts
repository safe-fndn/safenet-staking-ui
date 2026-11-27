import { useQuery, useQueryClient } from "@tanstack/react-query"
import { usePublicClient, useAccount } from "wagmi"
import { parseAbiItem, type Address } from "viem"
import { stakingAbi } from "@/abi/stakingAbi"
import { getContractAddresses, deployBlock } from "@/config/contracts"
import { activeChain } from "@/config/chains"

const MAX_BLOCK_RANGE = 49_999n
/** Older log chunks fetched at once after the newest one comes up short. */
const LOG_SCAN_PARALLELISM = 4
const POLL_INTERVAL = 15_000
/** Poll interval while the snapshot is older than a confirmed transaction. */
const CATCH_UP_INTERVAL = 2_000
/** Retry interval for validator lookups that found no event yet. */
const MISSING_RETRY_INTERVAL = 30_000
export const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000" as Address

const WITHDRAWAL_INITIATED_EVENT = parseAbiItem(
  "event WithdrawalInitiated(address indexed staker, address indexed validator, uint64 indexed withdrawalId, uint256 amount)"
)

const addresses = getContractAddresses(activeChain.id)

export interface QueuedWithdrawal {
  id: bigint
  amount: bigint
  claimableAt: bigint
}

export interface WithdrawalQueueSnapshot {
  /** The block every read was pinned to. */
  blockNumber: bigint
  head: bigint
  tail: bigint
  rows: QueuedWithdrawal[]
}

/**
 * The connected staker's pending withdrawals in queue order, with their
 * global withdrawal IDs.
 *
 * Every read is pinned to one freshly fetched block (bypassing viem's block
 * number cache), so rows and IDs always come from the same queue state, and a
 * refetch right after a confirmed transaction does not reread an older block.
 *
 * Each poll costs three calls: the block number, then `withdrawalQueues` and
 * `getPendingWithdrawals` together. The linked list (one call per node) is
 * only walked again when head, tail or length changed: withdrawals leave only
 * at the head, so an unchanged triple means an unchanged ID list.
 *
 * `minBlock`: the block of a transaction the caller is waiting for. While the
 * snapshot is older, it polls every 2s instead of every 15s.
 */
export function useWithdrawalQueue({ minBlock }: { minBlock?: bigint } = {}) {
  const client = usePublicClient()
  const { address } = useAccount()
  const queryClient = useQueryClient()
  const queryKey = ["withdrawalQueue", address]

  return useQuery({
    queryKey,
    queryFn: async (): Promise<WithdrawalQueueSnapshot> => {
      if (!client || !address) return { blockNumber: 0n, head: 0n, tail: 0n, rows: [] }
      const blockNumber = await client.getBlockNumber({ cacheTime: 0 })
      const read = { address: addresses.staking, abi: stakingAbi, blockNumber } as const
      const [[head, tail], pending] = await Promise.all([
        client.readContract({ ...read, functionName: "withdrawalQueues", args: [address] }),
        client.readContract({ ...read, functionName: "getPendingWithdrawals", args: [address] }),
      ])

      const previous = queryClient.getQueryData<WithdrawalQueueSnapshot>(queryKey)
      let ids: bigint[]
      if (previous && previous.head === head && previous.tail === tail && previous.rows.length === pending.length) {
        ids = previous.rows.map((r) => r.id)
      } else {
        ids = []
        for (let id = head; id !== 0n; ) {
          ids.push(id)
          // node = [amount, claimableAt, previous, next]
          const node = await client.readContract({ ...read, functionName: "withdrawalNodes", args: [address, id] })
          id = node[3]
        }
      }
      if (ids.length !== pending.length) {
        throw new Error(`Withdrawal queue has ${ids.length} nodes but ${pending.length} pending withdrawals`)
      }
      return {
        blockNumber,
        head,
        tail,
        rows: pending.map((w, i) => ({ id: ids[i], amount: w.amount, claimableAt: w.claimableAt })),
      }
    },
    enabled: !!client && !!address,
    refetchInterval: (query) => {
      const snapshot = query.state.data
      return minBlock !== undefined && snapshot && snapshot.blockNumber < minBlock ? CATCH_UP_INTERVAL : POLL_INTERVAL
    },
  })
}

/** Validators found so far, keyed by `<staker>:<id>`. A withdrawal's validator never changes. */
const knownValidators = new Map<string, Address>()

/** Test hook: forget every cached validator. */
export function clearKnownValidators() {
  knownValidators.clear()
}

/**
 * Resolves withdrawal IDs to validator addresses via `WithdrawalInitiated`
 * events, keyed by ID (never by position).
 *
 * Found validators are cached for the session, so only new IDs cost a scan.
 * The scan starts with the newest 50k blocks (pending withdrawals are
 * recent), then fetches older chunks a few at a time, stopping once every ID
 * is found. Chunk errors propagate so React Query retries. An ID still missing
 * after a full scan (e.g. the log node lagged behind the queue read) maps to
 * the zero address for now, is not cached, and is looked up again every 30s.
 */
export function useWithdrawalValidators(ids: bigint[] | undefined) {
  const client = usePublicClient()
  const { address } = useAccount()
  const sortedIds = [...(ids ?? [])].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0))
  const cacheKey = (id: bigint) => `${address?.toLowerCase()}:${id}`

  return useQuery({
    queryKey: ["withdrawalValidators", address, sortedIds.map(String)],
    queryFn: async (): Promise<Record<string, Address>> => {
      if (!client || !address) return {}
      const missing = new Set(sortedIds.filter((id) => !knownValidators.has(cacheKey(id))))
      const collect = (logs: Awaited<ReturnType<typeof getLogs>>) => {
        for (const log of logs) {
          const { withdrawalId, validator } = log.args
          if (withdrawalId === undefined || !validator) continue
          const id = BigInt(withdrawalId)
          if (missing.delete(id)) knownValidators.set(cacheKey(id), validator)
        }
      }
      const getLogs = (fromBlock: bigint, toBlock: bigint) =>
        client.getLogs({
          address: addresses.staking,
          event: WITHDRAWAL_INITIATED_EVENT,
          args: { staker: address },
          fromBlock,
          toBlock,
        })

      if (missing.size > 0) {
        const minBlock = deployBlock > 0n ? deployBlock : 0n
        // Chunk ranges from newest to oldest.
        const ranges: [bigint, bigint][] = []
        for (let to = await client.getBlockNumber({ cacheTime: 0 }); to >= minBlock; ) {
          const from = to - MAX_BLOCK_RANGE > minBlock ? to - MAX_BLOCK_RANGE : minBlock
          ranges.push([from, to])
          to = from - 1n
        }
        // The newest chunk alone first: it usually holds every pending withdrawal.
        if (ranges.length > 0) collect(await getLogs(...ranges[0]))
        for (let i = 1; i < ranges.length && missing.size > 0; i += LOG_SCAN_PARALLELISM) {
          const group = ranges.slice(i, i + LOG_SCAN_PARALLELISM)
          for (const logs of await Promise.all(group.map((r) => getLogs(...r)))) collect(logs)
        }
      }

      return Object.fromEntries(
        sortedIds.map((id) => [id.toString(), knownValidators.get(cacheKey(id)) ?? ZERO_ADDRESS]),
      )
    },
    // Complete results never go stale; ones with a missing ID are retried.
    staleTime: (query) => (hasMissing(query.state.data) ? 0 : Infinity),
    refetchInterval: (query) => (hasMissing(query.state.data) ? MISSING_RETRY_INTERVAL : false),
    // Keep known labels while a new ID is resolved; lookups are by ID, so a
    // previous result can never label the wrong row.
    placeholderData: (previous) => previous,
    enabled: !!client && !!address && sortedIds.length > 0,
  })
}

function hasMissing(result: Record<string, Address> | undefined): boolean {
  return !!result && Object.values(result).some((v) => v === ZERO_ADDRESS)
}
