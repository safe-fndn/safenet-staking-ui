import { useAccount } from "wagmi"
import { useValidators } from "@/hooks/useValidators"
import { useUserStakesOnValidators } from "@/hooks/useStakingReads"
import { useValidatorMetadata } from "@/hooks/useValidatorMetadata"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { truncateAddress, formatTokenAmount } from "@/lib/format"
import type { Address } from "viem"

function ValidatorLabel({ address }: { address: Address }) {
  const metadata = useValidatorMetadata(address)
  return <span className="font-mono text-sm">{metadata ? metadata.label : truncateAddress(address)}</span>
}

export function UserPositions() {
  const { isConnected } = useAccount()
  const { data: validators } = useValidators()
  const validatorAddresses = validators?.map((v) => v.address) ?? []
  const { data: stakes, isLoading } = useUserStakesOnValidators(validatorAddresses)

  if (!isConnected) {
    return (
      <Card>
        <CardContent className="p-8 text-center text-muted-foreground">
          Connect your wallet to view your positions.
        </CardContent>
      </Card>
    )
  }

  if (isLoading || !validators) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Your Positions</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {Array.from({ length: 2 }).map((_, i) => (
            <Skeleton key={i} className="h-12" />
          ))}
        </CardContent>
      </Card>
    )
  }

  // Build positions from multicall results
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

  return (
    <Card>
      <CardHeader>
        <CardTitle>Your Positions</CardTitle>
      </CardHeader>
      <CardContent>
        {positions.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            You have no active delegations. Visit the Validators page to delegate.
          </p>
        ) : (
          <div className="space-y-3">
            {positions.map((pos) => (
              <div
                key={pos.validator}
                className="flex items-center justify-between rounded-lg border p-3"
              >
                <ValidatorLabel address={pos.validator} />
                <span className="font-semibold">{formatTokenAmount(pos.amount)} SAFE</span>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
