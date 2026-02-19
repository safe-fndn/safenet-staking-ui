import { useNavigate } from "react-router-dom"
import { useAccount } from "wagmi"
import { Button } from "@/components/ui/button"
import { useNextClaimable } from "@/hooks/useWithdrawals"
import ArrowUpRight from "lucide-react/dist/esm/icons/arrow-up-right"
import ArrowDownLeft from "lucide-react/dist/esm/icons/arrow-down-left"
import HandCoins from "lucide-react/dist/esm/icons/hand-coins"

export function QuickActions() {
  const { isConnected } = useAccount()
  const navigate = useNavigate()
  const { data } = useNextClaimable()

  if (!isConnected) return null

  const result = data as readonly [bigint, bigint] | undefined
  const hasClaimable = result !== undefined
    && result[0] > 0n
    && Number(result[1]) <= Math.floor(Date.now() / 1000)

  return (
    <div className="flex flex-wrap gap-3">
      <Button variant="outline" onClick={() => navigate("/validators")}>
        <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
        Stake
      </Button>
      <Button variant="outline" onClick={() => navigate("/validators")}>
        <ArrowDownLeft className="h-4 w-4" aria-hidden="true" />
        Unstake
      </Button>
      <Button
        variant={hasClaimable ? "default" : "outline"}
        className={hasClaimable ? "bg-safe-green hover:bg-safe-green-dark text-primary-foreground" : ""}
        onClick={() => navigate("/withdrawals")}
      >
        <HandCoins className="h-4 w-4" aria-hidden="true" />
        Claim Withdrawals
      </Button>
    </div>
  )
}
