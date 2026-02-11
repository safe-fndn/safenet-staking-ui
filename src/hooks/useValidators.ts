import { useQuery } from "@tanstack/react-query"
import { usePublicClient } from "wagmi"
import { parseAbiItem, type Address, type Log } from "viem"
import { getContractAddresses, deployBlock } from "@/config/contracts"
import { activeChain } from "@/config/chains"

const MAX_BLOCK_RANGE = 49_999n
const CONCURRENCY = 5

const EVENT = parseAbiItem("event ValidatorUpdated(address indexed validator, bool isRegistered)")

export interface ValidatorInfo {
  address: Address
  isActive: boolean
}

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

export function useValidators() {
  const client = usePublicClient()
  const { staking } = getContractAddresses(activeChain.id)

  return useQuery({
    queryKey: ["validators", staking],
    queryFn: async (): Promise<ValidatorInfo[]> => {
      if (!client) throw new Error("No public client")

      let logs: Log[]

      // Try full range first, fall back to chunked on RPC block-range limits
      try {
        logs = await client.getLogs({
          address: staking,
          event: EVENT,
          fromBlock: deployBlock,
          toBlock: "latest",
        })
      } catch {
        const latestBlock = await client.getBlockNumber()
        const minBlock = deployBlock > 0n ? deployBlock : 0n

        const chunks: { fromBlock: bigint; toBlock: bigint }[] = []
        let toBlock = latestBlock
        while (toBlock >= minBlock) {
          const fromBlock = toBlock - MAX_BLOCK_RANGE > minBlock ? toBlock - MAX_BLOCK_RANGE : minBlock
          chunks.push({ fromBlock, toBlock })
          if (fromBlock === minBlock) break
          toBlock = fromBlock - 1n
        }

        const tasks = chunks.map(({ fromBlock, toBlock }) => async () => {
          try {
            return await client.getLogs({
              address: staking,
              event: EVENT,
              fromBlock,
              toBlock,
            })
          } catch {
            return [] as Log[]
          }
        })

        const results = await runWithConcurrency(tasks, CONCURRENCY)
        logs = results.flat()
      }

      const validators = new Map<Address, boolean>()
      for (const log of logs) {
        const args = (log as unknown as { args: { validator: Address; isRegistered: boolean } }).args
        validators.set(args.validator, args.isRegistered)
      }

      const result: ValidatorInfo[] = []
      for (const [addr, isRegistered] of validators) {
        result.push({ address: addr, isActive: isRegistered })
      }

      // Sort: active first, then inactive
      return result.toSorted((a, b) => (a.isActive === b.isActive ? 0 : a.isActive ? -1 : 1))
    },
    staleTime: 60_000,
    enabled: !!client,
  })
}
