import { useAccount } from "wagmi"
import { useUserTotalStake } from "@/hooks/useStakingReads"
import { Card, CardContent } from "@/components/ui/card"
import Wallet from "lucide-react/dist/esm/icons/wallet"
import Users from "lucide-react/dist/esm/icons/users"
import BarChart3 from "lucide-react/dist/esm/icons/bar-chart-3"

export function OnboardingBanner() {
  const { isConnected } = useAccount()
  const { data: userStake } = useUserTotalStake()

  const hasStake = userStake !== undefined && (userStake as bigint) > 0n
  if (isConnected && hasStake) return null

  const steps = [
    { icon: Wallet, title: "Connect your wallet" },
    { icon: Users, title: "Select a validator to stake your tokens" },
    { icon: BarChart3, title: "Track your rewards" },
  ]

  return (
    <Card className="border-primary/30 bg-primary/5">
      <CardContent className="pt-6">
        <div className="flex flex-wrap items-center justify-center gap-6 sm:gap-10">
          {steps.map((step, i) => (
            <div key={i} className="flex items-center gap-3">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-core-gradient text-foreground dark:text-background">
                <step.icon className="h-4 w-4" aria-hidden="true" />
              </div>
              <p className="text-sm font-medium">{step.title}</p>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
