import { useQuery } from "@tanstack/react-query"
import { usePublicClient } from "wagmi"
import { parseAbiItem, type Address, type Log } from "viem"
import { getContractAddresses, deployBlock } from "@/config/contracts"
import { activeChain } from "@/config/chains"

const MAX_BLOCK_RANGE = 49_999n

const EVENT = parseAbiItem("event ValidatorUpdated(address indexed validator, bool isRegistered)")

export interface ValidatorInfo {
  address: Address
  isActive: boolean
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
        logs = []
        let toBlock = latestBlock
        const minBlock = deployBlock > 0n ? deployBlock : 0n

        while (toBlock >= minBlock) {
          const fromBlock = toBlock - MAX_BLOCK_RANGE > minBlock ? toBlock - MAX_BLOCK_RANGE : minBlock
          try {
            const chunk = await client.getLogs({
              address: staking,
              event: EVENT,
              fromBlock,
              toBlock,
            })
            logs.unshift(...chunk)
          } catch {
            // skip chunk on error
          }
          if (fromBlock === minBlock) break
          toBlock = fromBlock - 1n
        }
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
      result.sort((a, b) => (a.isActive === b.isActive ? 0 : a.isActive ? -1 : 1))

      return result
    },
    staleTime: 60_000,
    enabled: !!client,
  })
}
