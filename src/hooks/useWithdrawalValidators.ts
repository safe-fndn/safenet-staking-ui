import { useQuery } from "@tanstack/react-query"
import { usePublicClient, useAccount, useReadContract } from "wagmi"
import { parseAbiItem, type Address } from "viem"
import { stakingAbi } from "@/abi/stakingAbi"
import { getContractAddresses, deployBlock } from "@/config/contracts"
import { activeChain } from "@/config/chains"

const MAX_BLOCK_RANGE = 49_999n

const WITHDRAWAL_INITIATED_EVENT = parseAbiItem(
  "event WithdrawalInitiated(address indexed staker, address indexed validator, uint64 indexed withdrawalId, uint256 amount)"
)

const addresses = getContractAddresses(activeChain.id)

/**
 * Maps pending withdrawal indices to validator addresses using on-chain events.
 *
 * `getPendingWithdrawals(staker)` returns `(amount, claimableAt)[]` but no validator address.
 * We fetch `WithdrawalInitiated` events and align them with the FIFO queue
 * (IDs `head` through `tail - 1`) to determine which validator each withdrawal belongs to.
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

      if (head >= tail) return []

      // Fetch WithdrawalInitiated events for this user
      let logs
      try {
        logs = await client.getLogs({
          address: addresses.staking,
          event: WITHDRAWAL_INITIATED_EVENT,
          args: { staker: address },
          fromBlock: deployBlock,
          toBlock: "latest",
        })
      } catch {
        // Chunked fallback for RPC block-range limits
        const latestBlock = await client.getBlockNumber()
        logs = []
        let toBlock = latestBlock
        const minBlock = deployBlock > 0n ? deployBlock : 0n

        while (toBlock >= minBlock) {
          const fromBlock = toBlock - MAX_BLOCK_RANGE > minBlock ? toBlock - MAX_BLOCK_RANGE : minBlock
          try {
            const chunk = await client.getLogs({
              address: addresses.staking,
              event: WITHDRAWAL_INITIATED_EVENT,
              args: { staker: address },
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

      // Build a map from withdrawalId → validator
      const idToValidator = new Map<bigint, Address>()
      for (const log of logs) {
        if (log.args.withdrawalId !== undefined && log.args.validator) {
          idToValidator.set(log.args.withdrawalId, log.args.validator)
        }
      }

      // Pending items are IDs head through tail - 1
      const validators: Address[] = []
      for (let id = head; id < tail; id++) {
        const validator = idToValidator.get(id)
        if (validator) {
          validators.push(validator)
        } else {
          validators.push("0x0000000000000000000000000000000000000000" as Address)
        }
      }

      return validators
    },
    staleTime: 60_000,
    enabled: !!client && !!address && head !== undefined && tail !== undefined,
  })
}
