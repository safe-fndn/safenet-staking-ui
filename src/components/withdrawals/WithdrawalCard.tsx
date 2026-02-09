import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { CountdownTimer } from "./CountdownTimer"
import { formatTokenAmount, formatTimestamp } from "@/lib/format"
import { useCountdown } from "@/hooks/useCountdown"
import { Loader2 } from "lucide-react"

interface WithdrawalCardProps {
  amount: bigint
  claimableAt: number
  isFirst: boolean
  onClaim: () => void
  isSigningTx: boolean
  isConfirmingTx: boolean
}

export function WithdrawalCard({ amount, claimableAt, isFirst, onClaim, isSigningTx, isConfirmingTx }: WithdrawalCardProps) {
  const secondsLeft = useCountdown(claimableAt)
  const canClaim = isFirst && secondsLeft === 0
  const isBusy = isSigningTx || isConfirmingTx

  return (
    <Card>
      <CardContent className="flex items-center justify-between p-4">
        <div className="space-y-1">
          <p className="text-lg font-semibold">{formatTokenAmount(amount)} SAFE</p>
          <p className="text-xs text-muted-foreground">
            Claimable at: {formatTimestamp(claimableAt)}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <CountdownTimer claimableAt={claimableAt} />
          {canClaim && (
            <Button size="sm" onClick={onClaim} disabled={isBusy}>
              {isSigningTx ? (
                <>
                  <Loader2 className="animate-spin" />
                  Confirm in Wallet...
                </>
              ) : isConfirmingTx ? (
                <>
                  <Loader2 className="animate-spin" />
                  Confirming on chain...
                </>
              ) : (
                "Claim"
              )}
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
