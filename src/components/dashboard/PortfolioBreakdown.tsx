import { useAccount } from "wagmi"
import { useValidators } from "@/hooks/useValidators"
import { useUserStakesOnValidators, useUserTotalStake } from "@/hooks/useStakingReads"
import { useValidatorMetadata } from "@/hooks/useValidatorMetadata"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { truncateAddress, formatTokenAmount } from "@/lib/format"
import type { Address } from "viem"

function ValidatorRow({ address, amount, totalStake }: { address: Address; amount: bigint; totalStake: bigint }) {
  const metadata = useValidatorMetadata(address)
  const pct = totalStake > 0n ? Number((amount * 10000n) / totalStake) / 100 : 0

  return (
    <div className="flex items-center justify-between py-2">
      <span className="text-sm font-medium">
        {metadata ? metadata.label : <span className="font-mono">{truncateAddress(address)}</span>}
      </span>
      <div className="flex items-center gap-4 text-sm">
        <span className="font-semibold">{formatTokenAmount(amount)} SAFE</span>
        <span className="text-muted-foreground w-16 text-right">{pct.toFixed(1)}%</span>
      </div>
    </div>
  )
}

export function PortfolioBreakdown() {
  const { isConnected } = useAccount()
  const { data: validators } = useValidators()
  const validatorAddresses = validators?.map((v) => v.address) ?? []
  const { data: stakes, isLoading } = useUserStakesOnValidators(validatorAddresses)
  const { data: userTotalStake } = useUserTotalStake()

  if (!isConnected) return null

  if (isLoading || !validators) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Portfolio Breakdown</CardTitle>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-24" />
        </CardContent>
      </Card>
    )
  }

  const positions: { validator: Address; amount: bigint }[] = []
  if (stakes) {
    for (let i = 0; i < validatorAddresses.length; i++) {
      const result = stakes[i]
      if (result.status === "success") {
        const amount = result.result as bigint
        if (amount > 0n) {
          positions.push({ validator: validatorAddresses[i], amount })
        }
      }
    }
  }

  const sorted = positions.toSorted((a, b) => (a.amount > b.amount ? -1 : a.amount < b.amount ? 1 : 0))

  if (sorted.length === 0) return null

  const totalStake = (userTotalStake as bigint) ?? 0n

  return (
    <Card>
      <CardHeader>
        <CardTitle>Portfolio Breakdown</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="divide-y">
          {sorted.map((pos) => (
            <ValidatorRow
              key={pos.validator}
              address={pos.validator}
              amount={pos.amount}
              totalStake={totalStake}
            />
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
