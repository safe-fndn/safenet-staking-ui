import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { Badge } from "@/components/ui/badge"
import { formatTokenAmount, formatCountdown, truncateAddress } from "@/lib/format"
import { useCountdown } from "@/hooks/useCountdown"
import { useWithdrawDelay } from "@/hooks/useStakingReads"
import { findValidator, type ValidatorInfo } from "@/hooks/useValidators"
import type { Address } from "viem"
import Loader2 from "lucide-react/dist/esm/icons/loader-2"
import { SafeTokenBadge } from "@/components/ui/SafeTokenBadge"


interface WithdrawalCardProps {
  amount: bigint
  claimableAt: number
  isFirst: boolean
  onClaim: () => void
  isSigningTx: boolean
  isConfirmingTx: boolean
  validator?: Address
  validators?: ValidatorInfo[]
}

function ValidatorLabel({ address, validators }: { address: Address; validators?: ValidatorInfo[] }) {
  const metadata = findValidator(validators, address)
  const isZero = address === "0x0000000000000000000000000000000000000000"
  const label = isZero ? "Unknown validator" : (metadata ? metadata.label : truncateAddress(address))
  return (
    <p className="text-xs text-muted-foreground">
      Validator: {label}
    </p>
  )
}

export function WithdrawalCard({ amount, claimableAt, isFirst, onClaim, isSigningTx, isConfirmingTx, validator, validators }: WithdrawalCardProps) {
  const secondsLeft = useCountdown(claimableAt)
  const { data: withdrawDelay } = useWithdrawDelay()
  const canClaim = isFirst && secondsLeft === 0
  const isBusy = isSigningTx || isConfirmingTx

  const totalDelay = withdrawDelay !== undefined ? Number(withdrawDelay) : 0
  const progress = totalDelay > 0 ? Math.min(100, ((totalDelay - secondsLeft) / totalDelay) * 100) : (secondsLeft === 0 ? 100 : 0)

  return (
    <Card>
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            {validator && <ValidatorLabel address={validator} validators={validators} />}
            <p className="text-lg font-semibold">{formatTokenAmount(amount, 18, 0)} <SafeTokenBadge /></p>
            {secondsLeft > 0 ? (
              <p className="text-xs text-muted-foreground">
                Claimable in {formatCountdown(secondsLeft)}
              </p>
            ) : (
              <p className="text-xs text-success font-medium">Ready to withdraw</p>
            )}
          </div>
          <div className="flex items-center gap-3">
            {secondsLeft > 0 && (
              <Badge variant="outline" className="font-mono">
                {formatCountdown(secondsLeft)}
              </Badge>
            )}
            <Button size="sm" onClick={onClaim} disabled={!canClaim || isBusy}>
              {isSigningTx ? (
                <>
                  <Loader2 className="animate-spin" aria-hidden="true" />
                  Confirm in Wallet…
                </>
              ) : isConfirmingTx ? (
                <>
                  <Loader2 className="animate-spin" aria-hidden="true" />
                  Confirming onchain…
                </>
              ) : (
                "Claim"
              )}
            </Button>
          </div>
        </div>
        {secondsLeft > 0 && (
          <div className="space-y-1">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>Cooldown progress</span>
              <span>{Math.round(progress)}%</span>
            </div>
            <Progress value={progress} size="sm" />
          </div>
        )}
      </CardContent>
    </Card>
  )
}
