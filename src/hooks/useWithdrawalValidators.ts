import { useQuery } from "@tanstack/react-query"
import { usePublicClient, useAccount, useReadContract } from "wagmi"
import { parseAbiItem, type Address } from "viem"
import { stakingAbi } from "@/abi/stakingAbi"
import { getContractAddresses, deployBlock } from "@/config/contracts"
import { activeChain } from "@/config/chains"

const MAX_BLOCK_RANGE = 49_999n
const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000" as Address

const WITHDRAWAL_INITIATED_EVENT = parseAbiItem(
  "event WithdrawalInitiated(address indexed staker, address indexed validator, uint64 indexed withdrawalId, uint256 amount)"
)

const addresses = getContractAddresses(activeChain.id)

/**
 * Maps pending withdrawals to validator addresses.
 *
 * The on-chain withdrawal queue is a doubly linked list keyed by global
 * withdrawal IDs. `getPendingWithdrawals` returns `(amount, claimableAt)[]`
 * but no validator. This hook traverses the linked list from `head` to
 * collect the node IDs, then matches them against `WithdrawalInitiated`
 * events to resolve each withdrawal's validator.
 */
export function useWithdrawalValidators() {
  const client = usePublicClient()
  const { address } = useAccount()

  const { data: queueData } = useReadContract({
    address: addresses.staking,
    abi: stakingAbi,
    functionName: "withdrawalQueues",
    args: address ? [address] : undefined,
    query: { enabled: !!address },
  })

  const head = queueData?.[0]
  const tail = queueData?.[1]

  return useQuery({
    queryKey: ["withdrawalValidators", address, head?.toString(), tail?.toString()],
    queryFn: async (): Promise<Address[]> => {
      if (!client || !address || head === undefined || tail === undefined) return []

      // head == 0 means the queue is empty
      if (head === 0n) return []

      // 1. Traverse the linked list to collect node IDs in queue order.
      const nodeIds: bigint[] = []
      let currentId = head
      while (currentId !== 0n) {
        nodeIds.push(currentId)
        const node = await client.readContract({
          address: addresses.staking,
          abi: stakingAbi,
          functionName: "withdrawalNodes",
          args: [address, currentId],
        })
        // node = [amount, claimableAt, previous, next]
        currentId = node[3]
      }

      // 2. Fetch WithdrawalInitiated events and build withdrawalId → validator map.
      const getEventLogs = () =>
        client.getLogs({
          address: addresses.staking,
          event: WITHDRAWAL_INITIATED_EVENT,
          args: { staker: address },
          fromBlock: deployBlock,
          toBlock: "latest",
        })
      type EventLog = Awaited<ReturnType<typeof getEventLogs>>
      let logs: EventLog
      try {
        logs = await getEventLogs()
      } catch {
        // Chunked fallback for RPC block-range limits.
        // Fetch all chunks in parallel for better latency.
        const latestBlock = await client.getBlockNumber()
        const minBlock = deployBlock > 0n ? deployBlock : 0n

        const chunkPromises: Promise<EventLog>[] = []
        let from = minBlock
        while (from <= latestBlock) {
          const to =
            from + MAX_BLOCK_RANGE > latestBlock
              ? latestBlock
              : from + MAX_BLOCK_RANGE
          chunkPromises.push(
            client
              .getLogs({
                address: addresses.staking,
                event: WITHDRAWAL_INITIATED_EVENT,
                args: { staker: address },
                fromBlock: from,
                toBlock: to,
              })
              .catch(() => [])
          )
          from = to + 1n
        }

        const chunkResults = await Promise.all(chunkPromises)
        logs = chunkResults.flat()
      }

      const idToValidator = new Map<bigint, Address>()
      for (const log of logs) {
        const { withdrawalId, validator } = log.args
        if (withdrawalId !== undefined && validator) {
          idToValidator.set(BigInt(withdrawalId), validator)
        }
      }

      // 3. Map each linked-list node ID to its validator.
      return nodeIds.map((id) => idToValidator.get(id) ?? ZERO_ADDRESS)
    },
    staleTime: 60_000,
    enabled: !!client && !!address && head !== undefined && tail !== undefined && head !== 0n,
  })
}
