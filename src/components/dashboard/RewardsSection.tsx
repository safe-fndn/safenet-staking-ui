import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip"
import { useRewards } from "@/hooks/useRewards"
import { useAccount } from "wagmi"
import { formatTokenAmount } from "@/lib/format"
import { RewardsCalculator } from "./RewardsCalculator"

export function RewardsSection() {
  const { isConnected } = useAccount()
  const { data: rewards } = useRewards()

  if (!isConnected) return null

  const capPercent = rewards.weeklyCapTotal > 0
    ? Math.round((rewards.weeklyCapUsed / rewards.weeklyCapTotal) * 100)
    : 0

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Rewards</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Claimable SAFE</span>
            <span className="font-semibold">{formatTokenAmount(rewards.claimable)} SAFE</span>
          </div>

          <div className="space-y-1">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Weekly Cap Usage</span>
              <span>${rewards.weeklyCapUsed} / ${rewards.weeklyCapTotal} ({capPercent}%)</span>
            </div>
            <div className="h-2 rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-primary transition-[width] duration-300"
                style={{ width: `${capPercent}%` }}
              />
            </div>
          </div>

          {rewards.expiresAt > 0 && (
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Oldest Rewards Expire</span>
              <span>{new Date(rewards.expiresAt * 1000).toLocaleDateString()}</span>
            </div>
          )}

          <p className="text-xs text-muted-foreground">
            Rewards become available for claiming every 2 weeks based on delegation activity.
            Unclaimed rewards expire after 6 months.
          </p>

          <Tooltip>
            <TooltipTrigger asChild>
              <span className="w-full">
                <Button className="w-full" disabled>
                  Claim Rewards
                </Button>
              </span>
            </TooltipTrigger>
            <TooltipContent>
              Rewards claiming will be available soon.
            </TooltipContent>
          </Tooltip>
        </CardContent>
      </Card>

      <RewardsCalculator />
    </div>
  )
}
