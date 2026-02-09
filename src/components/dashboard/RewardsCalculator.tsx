import { useState } from "react"
import { useAccount } from "wagmi"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { useUserTotalStake } from "@/hooks/useStakingReads"
import { useRewardsEstimate } from "@/hooks/useRewardsEstimate"
import { formatTokenAmount } from "@/lib/format"
import { Calculator } from "lucide-react"

function formatEstimate(value: string): string {
  const num = parseFloat(value)
  if (isNaN(num) || num === 0) return "0"
  if (num < 0.0001) return "< 0.0001"
  return num.toFixed(4)
}

export function RewardsCalculator() {
  const { isConnected } = useAccount()
  const { data: userStake } = useUserTotalStake()
  const stakeAmount = userStake as bigint | undefined

  const [amount, setAmount] = useState(() =>
    stakeAmount ? formatTokenAmount(stakeAmount, 18, 4) : "",
  )
  const [apr, setApr] = useState("5")

  const estimate = useRewardsEstimate(amount, parseFloat(apr) || 0)

  if (!isConnected) return null

  const periods = [
    { label: "Daily", value: estimate.daily },
    { label: "Weekly", value: estimate.weekly },
    { label: "Monthly", value: estimate.monthly },
    { label: "Yearly", value: estimate.yearly },
  ]

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Calculator className="h-5 w-5" />
          Rewards Calculator
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Delegation Amount (SAFE)</label>
            <Input
              type="text"
              inputMode="decimal"
              placeholder="0.0"
              value={amount}
              onChange={(e) => {
                if (/^[0-9]*\.?[0-9]*$/.test(e.target.value)) {
                  setAmount(e.target.value)
                }
              }}
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium">APR (%)</label>
            <Input
              type="text"
              inputMode="decimal"
              placeholder="5"
              value={apr}
              onChange={(e) => {
                if (/^[0-9]*\.?[0-9]*$/.test(e.target.value)) {
                  setApr(e.target.value)
                }
              }}
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {periods.map((p) => (
            <div key={p.label} className="rounded-lg border p-3 text-center">
              <p className="text-xs text-muted-foreground">{p.label}</p>
              <p className="text-sm font-semibold mt-1">{formatEstimate(p.value)}</p>
              <p className="text-xs text-muted-foreground">SAFE</p>
            </div>
          ))}
        </div>

        <p className="text-xs text-muted-foreground">
          Estimates are based on a fixed APR and do not account for compounding or changing rates. Actual rewards may vary.
        </p>
      </CardContent>
    </Card>
  )
}
