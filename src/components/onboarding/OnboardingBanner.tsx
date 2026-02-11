import { useState } from "react"
import { useAccount } from "wagmi"
import { useUserTotalStake } from "@/hooks/useStakingReads"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import X from "lucide-react/dist/esm/icons/x"
import Wallet from "lucide-react/dist/esm/icons/wallet"
import Users from "lucide-react/dist/esm/icons/users"
import BarChart3 from "lucide-react/dist/esm/icons/bar-chart-3"

const STORAGE_KEY = "onboarding_dismissed"

export function OnboardingBanner() {
  const { isConnected } = useAccount()
  const { data: userStake } = useUserTotalStake()
  const [dismissed, setDismissed] = useState(() => localStorage.getItem(STORAGE_KEY) === "true")

  if (dismissed) return null

  const hasStake = userStake !== undefined && (userStake as bigint) > 0n
  if (isConnected && hasStake) return null

  function handleDismiss() {
    localStorage.setItem(STORAGE_KEY, "true")
    setDismissed(true)
  }

  const steps = [
    { icon: Wallet, title: "Connect your wallet", description: "Connect your Ethereum wallet to get started" },
    { icon: Users, title: "Choose a validator", description: "Browse validators and stake your SAFE tokens" },
    { icon: BarChart3, title: "Track your rewards", description: "Monitor your rewards and manage withdrawals" },
  ]

  return (
    <Card className="relative border-primary/30 bg-primary/5">
      <button
        onClick={handleDismiss}
        className="absolute right-3 top-3 text-muted-foreground hover:text-foreground"
        aria-label="Dismiss onboarding"
      >
        <X className="h-4 w-4" aria-hidden="true" />
      </button>
      <CardContent className="pt-6">
        <h3 className="text-lg font-semibold mb-4">Welcome to Safe Staking</h3>
        <div className="grid gap-4 sm:grid-cols-3">
          {steps.map((step, i) => (
            <div key={i} className="flex gap-3">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                <step.icon className="h-4 w-4" aria-hidden="true" />
              </div>
              <div>
                <p className="text-sm font-medium">{step.title}</p>
                <p className="text-xs text-muted-foreground">{step.description}</p>
              </div>
            </div>
          ))}
        </div>
        <div className="mt-4 flex justify-end">
          <Button variant="ghost" size="sm" onClick={handleDismiss}>
            Dismiss
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
