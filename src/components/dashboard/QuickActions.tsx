import { useNavigate } from "react-router-dom"
import { useAccount } from "wagmi"
import { Button } from "@/components/ui/button"
import ArrowUpRight from "lucide-react/dist/esm/icons/arrow-up-right"
import ArrowDownLeft from "lucide-react/dist/esm/icons/arrow-down-left"
import HandCoins from "lucide-react/dist/esm/icons/hand-coins"

export function QuickActions() {
  const { isConnected } = useAccount()
  const navigate = useNavigate()

  if (!isConnected) return null

  return (
    <div className="flex flex-wrap gap-3">
      <Button variant="outline" onClick={() => navigate("/validators")}>
        <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
        Delegate
      </Button>
      <Button variant="outline" onClick={() => navigate("/validators")}>
        <ArrowDownLeft className="h-4 w-4" aria-hidden="true" />
        Undelegate
      </Button>
      <Button variant="outline" onClick={() => navigate("/withdrawals")}>
        <HandCoins className="h-4 w-4" aria-hidden="true" />
        Claim Withdrawals
      </Button>
    </div>
  )
}
