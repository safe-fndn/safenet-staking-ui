import { useState } from "react"
import { useAccount } from "wagmi"
import { Link } from "react-router-dom"
import { useNextClaimable } from "@/hooks/useWithdrawals"
import { formatTokenAmount } from "@/lib/format"
import X from "lucide-react/dist/esm/icons/x"
import ArrowRight from "lucide-react/dist/esm/icons/arrow-right"
import { Button } from "@/components/ui/button"

export function ClaimableBanner() {
  const { isConnected } = useAccount()
  const { data } = useNextClaimable()
  const [dismissed, setDismissed] = useState(false)

  if (!isConnected || dismissed) return null

  const result = data as readonly [bigint, bigint] | undefined
  if (!result) return null

  const [amount, claimableAt] = result
  if (amount === 0n) return null

  const now = Math.floor(Date.now() / 1000)
  if (Number(claimableAt) > now) return null

  return (
    <div className="flex items-center justify-between rounded-lg border border-success/50 bg-success/10 px-4 py-3">
      <div className="flex items-center gap-3">
        <div className="h-2 w-2 rounded-full bg-success animate-pulse" />
        <p className="text-sm font-medium">
          You have {formatTokenAmount(amount)} SAFE ready to claim
        </p>
      </div>
      <div className="flex items-center gap-2">
        <Button asChild variant="ghost" size="sm">
          <Link to="/withdrawals">
            Go to Withdrawals
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        </Button>
        <button onClick={() => setDismissed(true)} className="text-muted-foreground hover:text-foreground" aria-label="Dismiss banner">
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>
    </div>
  )
}
