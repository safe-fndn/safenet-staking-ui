import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { useRewards } from "@/hooks/useRewards"
import { useAccount } from "wagmi"
import { formatTokenAmount } from "@/lib/format"
import { ClaimRewardsDialog } from "./ClaimRewardsDialog"

export function RewardsSection() {
  const { isConnected } = useAccount()
  const { data: rewards } = useRewards()
  const [claimOpen, setClaimOpen] = useState(false)

  if (!isConnected) return null

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Rewards</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Claimable SAFE</span>
            <span className="font-semibold">{formatTokenAmount(rewards.claimable)}</span>
          </div>

          {rewards.rootStale ? (
            <p className="text-xs text-amber-600">
              Rewards data is being updated. Claiming will be available again shortly.
            </p>
          ) : (
            <p className="text-xs text-muted-foreground">
              Rewards become available for claiming every 2 weeks based on delegation activity.
            </p>
          )}

          <Button
            className="w-full"
            disabled={!rewards.canClaim}
            onClick={() => setClaimOpen(true)}
          >
            Claim Rewards
          </Button>
        </CardContent>
      </Card>

      <ClaimRewardsDialog open={claimOpen} onOpenChange={setClaimOpen} />
    </div>
  )
}
