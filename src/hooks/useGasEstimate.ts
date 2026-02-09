import { useState, useEffect, useRef } from "react"
import { usePublicClient, useAccount } from "wagmi"
import { formatEther, type Address, encodeFunctionData } from "viem"
import { stakingAbi } from "@/abi/stakingAbi"
import { getContractAddresses } from "@/config/contracts"
import { activeChain } from "@/config/chains"

const { staking } = getContractAddresses(activeChain.id)

interface GasEstimateResult {
  estimatedCost: string | null
  isLoading: boolean
}

export function useGasEstimate(
  functionName: "stake" | "initiateWithdrawal",
  validator: Address,
  amount: bigint,
): GasEstimateResult {
  const client = usePublicClient()
  const { address } = useAccount()
  const [estimatedCost, setEstimatedCost] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined)

  useEffect(() => {
    setEstimatedCost(null)

    if (!client || !address || amount <= 0n) {
      setIsLoading(false)
      return
    }

    // Debounce 500ms
    if (timerRef.current) clearTimeout(timerRef.current)

    timerRef.current = setTimeout(async () => {
      setIsLoading(true)
      try {
        const [gasEstimate, gasPrice] = await Promise.all([
          client.estimateGas({
            account: address,
            to: staking,
            data: encodeFunctionData({
              abi: stakingAbi,
              functionName,
              args: [validator, amount],
            }),
          }),
          client.getGasPrice(),
        ])

        const cost = gasEstimate * gasPrice
        setEstimatedCost(formatEther(cost))
      } catch {
        setEstimatedCost(null)
      } finally {
        setIsLoading(false)
      }
    }, 500)

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [client, address, functionName, validator, amount])

  return { estimatedCost, isLoading }
}
