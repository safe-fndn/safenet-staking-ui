import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { CountdownTimer } from "./CountdownTimer"
import { formatTokenAmount, formatTimestamp, truncateAddress } from "@/lib/format"
import { useCountdown } from "@/hooks/useCountdown"
import { useWithdrawDelay } from "@/hooks/useStakingReads"
import { useValidatorMetadata } from "@/hooks/useValidatorMetadata"
import type { Address } from "viem"
import Loader2 from "lucide-react/dist/esm/icons/loader-2"
import CheckCircle from "lucide-react/dist/esm/icons/check-circle"

interface WithdrawalCardProps {
  amount: bigint
  claimableAt: number
  isFirst: boolean
  onClaim: () => void
  isSigningTx: boolean
  isConfirmingTx: boolean
  validator?: Address
}

function ValidatorLabel({ address }: { address: Address }) {
  const metadata = useValidatorMetadata(address)
  if (address === "0x0000000000000000000000000000000000000000") return null
  return (
    <p className="text-xs text-muted-foreground">
      Validator: {metadata ? metadata.label : truncateAddress(address)}
    </p>
  )
}

export function WithdrawalCard({ amount, claimableAt, isFirst, onClaim, isSigningTx, isConfirmingTx, validator }: WithdrawalCardProps) {
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
            {validator && <ValidatorLabel address={validator} />}
            <p className="text-lg font-semibold">{formatTokenAmount(amount)} SAFE</p>
            <p className="text-xs text-muted-foreground">
              Claimable at: {formatTimestamp(claimableAt)}
            </p>
          </div>
          <div className="flex items-center gap-3">
            {secondsLeft > 0 ? (
              <CountdownTimer claimableAt={claimableAt} />
            ) : (
              <div className="flex items-center gap-1.5 text-success text-sm font-medium">
                <CheckCircle className="h-4 w-4" aria-hidden="true" />
                Ready to claim
              </div>
            )}
            {canClaim && (
              <Button size="sm" onClick={onClaim} disabled={isBusy}>
                {isSigningTx ? (
                  <>
                    <Loader2 className="animate-spin" aria-hidden="true" />
                    Confirm in Wallet…
                  </>
                ) : isConfirmingTx ? (
                  <>
                    <Loader2 className="animate-spin" aria-hidden="true" />
                    Confirming on chain…
                  </>
                ) : (
                  "Claim"
                )}
              </Button>
            )}
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
