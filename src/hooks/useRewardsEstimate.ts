import { useMemo } from "react"
import { parseEther, formatEther } from "viem"

const DEFAULT_APR = 5 // 5% default APR

export interface RewardsEstimate {
  daily: string
  weekly: string
  monthly: string
  yearly: string
}

export function useRewardsEstimate(amountStr: string, aprPercent: number = DEFAULT_APR): RewardsEstimate {
  return useMemo(() => {
    const empty: RewardsEstimate = { daily: "0", weekly: "0", monthly: "0", yearly: "0" }

    if (!amountStr || isNaN(Number(amountStr)) || Number(amountStr) <= 0 || aprPercent <= 0) {
      return empty
    }

    try {
      const amount = parseEther(amountStr)
      // yearly = amount * apr / 100
      const yearly = (amount * BigInt(Math.round(aprPercent * 100))) / 10000n
      const daily = yearly / 365n
      const weekly = yearly / 52n
      const monthly = yearly / 12n

      return {
        daily: formatEther(daily),
        weekly: formatEther(weekly),
        monthly: formatEther(monthly),
        yearly: formatEther(yearly),
      }
    } catch {
      return empty
    }
  }, [amountStr, aprPercent])
}
