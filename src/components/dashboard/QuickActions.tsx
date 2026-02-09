import { useNavigate } from "react-router-dom"
import { useAccount } from "wagmi"
import { Button } from "@/components/ui/button"
import { ArrowUpRight, ArrowDownLeft, HandCoins } from "lucide-react"

export function QuickActions() {
  const { isConnected } = useAccount()
  const navigate = useNavigate()

  if (!isConnected) return null

  return (
    <div className="flex flex-wrap gap-3">
      <Button variant="outline" onClick={() => navigate("/validators")}>
        <ArrowUpRight className="h-4 w-4" />
        Delegate
      </Button>
      <Button variant="outline" onClick={() => navigate("/validators")}>
        <ArrowDownLeft className="h-4 w-4" />
        Undelegate
      </Button>
      <Button variant="outline" onClick={() => navigate("/withdrawals")}>
        <HandCoins className="h-4 w-4" />
        Claim Withdrawals
      </Button>
    </div>
  )
}
