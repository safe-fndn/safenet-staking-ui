import { useState } from "react"
import { Link } from "react-router-dom"
import { useAccount } from "wagmi"
import { useValidators } from "@/hooks/useValidators"
import { useUserStakesOnValidators } from "@/hooks/useStakingReads"
import { useValidatorMetadata } from "@/hooks/useValidatorMetadata"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { UndelegateDialog } from "@/components/staking/UndelegateDialog"
import { truncateAddress, formatTokenAmount } from "@/lib/format"
import type { Address } from "viem"

interface Position {
  validator: Address
  amount: bigint
  isActive: boolean
}

function PositionRow({ position }: { position: Position }) {
  const metadata = useValidatorMetadata(position.validator)
  const [undelegateOpen, setUndelegateOpen] = useState(false)

  return (
    <>
      <tr className="border-b last:border-b-0">
        <td className="py-3 pr-4">
          <Link
            to={`/validators/${position.validator}`}
            className="text-sm font-medium hover:underline"
          >
            {metadata ? metadata.label : <span className="font-mono">{truncateAddress(position.validator)}</span>}
          </Link>
        </td>
        <td className="py-3 pr-4 text-sm font-semibold text-right">
          {formatTokenAmount(position.amount)}
        </td>
        <td className="py-3 pr-4 text-sm text-right text-muted-foreground">
          {metadata ? `${metadata.uptime}%` : "—"}
        </td>
        <td className="py-3 pr-4 text-right">
          {position.isActive ? (
            <Badge variant="secondary">Active</Badge>
          ) : (
            <Badge className="bg-warning/20 text-warning hover:bg-warning/30">Inactive</Badge>
          )}
        </td>
        <td className="py-3 text-right">
          <Button
            size="sm"
            variant="outline"
            onClick={() => setUndelegateOpen(true)}
          >
            Undelegate
          </Button>
        </td>
      </tr>
      <UndelegateDialog
        validator={position.validator}
        open={undelegateOpen}
        onOpenChange={setUndelegateOpen}
      />
    </>
  )
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
          Connect your wallet to view your delegations.
        </CardContent>
      </Card>
    )
  }

  if (isLoading || !validators) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>My Delegations</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {Array.from({ length: 2 }).map((_, i) => (
            <Skeleton key={i} className="h-12" />
          ))}
        </CardContent>
      </Card>
    )
  }

  const positions: Position[] = []
  if (stakes) {
    for (let i = 0; i < validatorAddresses.length; i++) {
      const result = stakes[i]
      if (result.status === "success" && typeof result.result === "bigint") {
        const amount = result.result
        if (amount > 0n) {
          const validator = validators.find((v) => v.address === validatorAddresses[i])
          positions.push({
            validator: validatorAddresses[i],
            amount,
            isActive: validator?.isActive ?? false,
          })
        }
      }
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>My Delegations</CardTitle>
      </CardHeader>
      <CardContent>
        {positions.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            You have no active delegations. Visit the{" "}
            <Link to="/validators" className="text-primary underline hover:text-primary/80">
              Validators
            </Link>{" "}
            page to delegate.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b text-xs text-muted-foreground">
                  <th className="pb-2 pr-4 text-left font-medium">Validator</th>
                  <th className="pb-2 pr-4 text-right font-medium">SAFE Amount</th>
                  <th className="pb-2 pr-4 text-right font-medium">Uptime</th>
                  <th className="pb-2 pr-4 text-right font-medium">Status</th>
                  <th className="pb-2 text-right font-medium">Action</th>
                </tr>
              </thead>
              <tbody>
                {positions.map((pos) => (
                  <PositionRow key={pos.validator} position={pos} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
