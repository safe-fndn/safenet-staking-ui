import { useQuery } from "@tanstack/react-query"
import { usePublicClient } from "wagmi"
import { parseAbiItem, type Address } from "viem"
import { getContractAddresses, deployBlock } from "@/config/contracts"
import { activeChain } from "@/config/chains"

export interface ValidatorProposal {
  validators: Address[]
  isRegistration: boolean[]
  executableAt: bigint
  validatorsHash: string
}

const MAX_BLOCK_RANGE = 49_999n

const EVENT = parseAbiItem(
  "event ValidatorsProposed(bytes32 indexed validatorsHash, address[] validator, bool[] isRegistration, uint256 executableAt)",
)

export function useValidatorProposalEvents() {
  const client = usePublicClient()
  const { staking } = getContractAddresses(activeChain.id)

  return useQuery({
    queryKey: ["validatorProposals", staking],
    queryFn: async (): Promise<ValidatorProposal | null> => {
      if (!client) throw new Error("No public client")

      // Try full range first, then fall back to chunked search
      try {
        const logs = await client.getLogs({
          address: staking,
          event: EVENT,
          fromBlock: deployBlock,
          toBlock: "latest",
        })
        if (logs.length > 0) {
          const latest = logs[logs.length - 1]
          return {
            validators: [...latest.args.validator!] as Address[],
            isRegistration: [...latest.args.isRegistration!],
            executableAt: latest.args.executableAt!,
            validatorsHash: latest.args.validatorsHash!,
          }
        }
        return null
      } catch {
        // RPC likely limits block range — search backwards in chunks
      }

      const latestBlock = await client.getBlockNumber()
      let toBlock = latestBlock
      const minBlock = deployBlock > 0n ? deployBlock : 0n

      while (toBlock > minBlock) {
        const fromBlock = toBlock - MAX_BLOCK_RANGE > minBlock ? toBlock - MAX_BLOCK_RANGE : minBlock
        try {
          const logs = await client.getLogs({
            address: staking,
            event: EVENT,
            fromBlock,
            toBlock,
          })
          if (logs.length > 0) {
            const latest = logs[logs.length - 1]
            return {
              validators: [...latest.args.validator!] as Address[],
              isRegistration: [...latest.args.isRegistration!],
              executableAt: latest.args.executableAt!,
              validatorsHash: latest.args.validatorsHash!,
            }
          }
        } catch {
          // skip this chunk on error
        }
        toBlock = fromBlock - 1n
      }

      return null
    },
    staleTime: 30_000,
    enabled: !!client,
  })
}
