import { useState, useEffect } from "react"
import { Link } from "react-router-dom"
import type { Address } from "viem"
import { useAccount } from "wagmi"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { DelegateDialog } from "@/components/staking/DelegateDialog"
import { UndelegateDialog } from "@/components/staking/UndelegateDialog"
import { useUserStakeOnValidator } from "@/hooks/useStakingReads"
import { useValidatorMetadata } from "@/hooks/useValidatorMetadata"
import { truncateAddress, formatTokenAmount } from "@/lib/format"
import { copyToClipboard } from "@/lib/clipboard"
import { useToast } from "@/hooks/useToast"

interface ValidatorCardProps {
  validator: Address
  isActive: boolean
  autoOpenDelegate?: boolean
  totalStake?: bigint
  loadingTotalStake?: boolean
}

export function ValidatorCard({ validator, isActive, autoOpenDelegate, totalStake, loadingTotalStake }: ValidatorCardProps) {
  const { isConnected } = useAccount()
  const loadingTotal = loadingTotalStake ?? false
  const { data: userStake, isLoading: loadingUser } = useUserStakeOnValidator(validator)
  const metadata = useValidatorMetadata(validator)
  const { toast } = useToast()
  const [delegateOpen, setDelegateOpen] = useState(false)
  const [undelegateOpen, setUndelegateOpen] = useState(false)

  const userStakeAmount = userStake as bigint | undefined
  const hasStake = userStakeAmount !== undefined && userStakeAmount > 0n

  useEffect(() => {
    if (autoOpenDelegate && isActive) {
      setDelegateOpen(true)
    }
  }, [autoOpenDelegate, isActive])

  return (
    <>
      <Card className={!isActive ? "opacity-60" : undefined}>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">
              <Link to={`/validators/${validator}`} className="hover:underline">
                {metadata ? metadata.label : <span className="font-mono">{truncateAddress(validator)}</span>}
              </Link>
            </CardTitle>
            {isActive ? (
              <Badge variant="secondary">Active</Badge>
            ) : (
              <Badge className="bg-warning/20 text-warning hover:bg-warning/30">Inactive</Badge>
            )}
          </div>
          {metadata && (
            <button
              className="text-xs font-mono text-muted-foreground hover:text-foreground transition-colors text-left"
              onClick={async () => {
                const ok = await copyToClipboard(validator)
                if (ok) toast({ variant: "success", title: "Address copied" })
              }}
              title="Copy validator address"
            >
              {truncateAddress(validator)}
            </button>
          )}
        </CardHeader>
        <CardContent className="space-y-3">
          {metadata && (
            <div className="flex gap-4 text-xs text-muted-foreground">
              <span>Commission: {metadata.commission}%</span>
              <span>Uptime: {metadata.uptime}%</span>
            </div>
          )}

          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Total SAFE Staked</span>
            {loadingTotal ? (
              <Skeleton className="h-4 w-24" />
            ) : (
              <span className="font-medium">
                {formatTokenAmount(totalStake ?? 0n, 18, 0)}
              </span>
            )}
          </div>

          {isConnected && (
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Your SAFE Staked</span>
              {loadingUser ? (
                <Skeleton className="h-4 w-24" />
              ) : (
                <span className="font-medium">
                  {formatTokenAmount(userStakeAmount ?? 0n, 18, 0)}
                </span>
              )}
            </div>
          )}

          {!isActive && (
            <p className="text-xs text-warning">Validator is inactive</p>
          )}

          {isConnected && (
            <div className="flex gap-2 pt-2">
              <Button size="sm" className="flex-1" onClick={() => setDelegateOpen(true)} disabled={!isActive}>
                Stake
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="flex-1"
                disabled={!hasStake}
                onClick={() => setUndelegateOpen(true)}
              >
                Unstake
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <DelegateDialog validator={validator} open={delegateOpen} onOpenChange={setDelegateOpen} />
      <UndelegateDialog validator={validator} open={undelegateOpen} onOpenChange={setUndelegateOpen} />
    </>
  )
}
