import { useState } from "react"
import { useParams, Link } from "react-router-dom"
import { useAccount } from "wagmi"
import { isAddress, type Address } from "viem"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { DelegateDialog } from "@/components/staking/DelegateDialog"
import { UndelegateDialog } from "@/components/staking/UndelegateDialog"
import { useValidatorTotalStake, useUserStakeOnValidator } from "@/hooks/useStakingReads"
import { useValidators, findValidator } from "@/hooks/useValidators"
import { formatTokenAmount, asBigint } from "@/lib/format"
import { copyToClipboard } from "@/lib/clipboard"
import { useToast } from "@/hooks/useToast"
import { useWrongNetwork } from "@/hooks/useWrongNetwork"
import ArrowLeft from "lucide-react/dist/esm/icons/arrow-left"
import Copy from "lucide-react/dist/esm/icons/copy"
export function ValidatorDetailPage() {
  const { address: validatorAddress } = useParams<{ address: string }>()
  const { isConnected } = useAccount()
  const wrongNetwork = useWrongNetwork()
  const { toast } = useToast()

  const isValidAddress = !!validatorAddress && isAddress(validatorAddress)
  const validator = isValidAddress ? (validatorAddress as Address) : ("0x0000000000000000000000000000000000000000" as Address)

  const { data: validators, isLoading: loadingValidators } = useValidators()
  const validatorInfo = findValidator(validators, validator)
  const { data: totalStake, isLoading: loadingTotal } = useValidatorTotalStake(validator)
  const { data: userStake, isLoading: loadingUser } = useUserStakeOnValidator(validator)
  const [delegateOpen, setDelegateOpen] = useState(false)
  const [undelegateOpen, setUndelegateOpen] = useState(false)

  const userStakeAmount = typeof userStake === "bigint" ? userStake : undefined
  const hasStake = userStakeAmount !== undefined && userStakeAmount > 0n
  const isActive = validatorInfo?.isActive ?? false

  if (!isValidAddress) {
    return (
      <div className="space-y-4">
        <Link to="/validators" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Back to Validators
        </Link>
        <div className="rounded-lg border p-8 text-center text-muted-foreground">
          Invalid validator address.
        </div>
      </div>
    )
  }

  if (loadingValidators) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64" />
      </div>
    )
  }

  if (!validatorInfo) {
    return (
      <div className="space-y-4">
        <Link to="/validators" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Back to Validators
        </Link>
        <div className="rounded-lg border p-8 text-center text-muted-foreground">
          Validator not found.
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <Link to="/validators" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        Back to Validators
      </Link>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <CardTitle className="text-2xl tracking-tight">
                {validatorInfo.label}
              </CardTitle>
              <div className="flex items-center gap-2">
                <span className="text-sm font-mono text-muted-foreground">{validator}</span>
                <button
                  onClick={async () => {
                    const ok = await copyToClipboard(validator)
                    if (ok) toast({ variant: "success", title: "Address copied" })
                  }}
                  className="text-muted-foreground hover:text-foreground"
                  aria-label="Copy address"
                >
                  <Copy className="h-3.5 w-3.5" aria-hidden="true" />
                </button>
              </div>
            </div>
            {isActive ? (
              <Badge variant="secondary" className="text-sm">Active</Badge>
            ) : (
              <Badge className="bg-warning/20 text-warning hover:bg-warning/30 text-sm">Inactive</Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-6 text-sm">
            <div>
              <span className="text-muted-foreground">Commission: </span>
              <span className="font-medium">{validatorInfo.commission}%</span>
            </div>
            <div>
              <span className="text-muted-foreground">Participation (14d): </span>
              <span className="font-medium">{validatorInfo.participationRate}%</span>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-lg bg-muted/30 p-4">
              <p className="text-sm text-muted-foreground">Total SAFE Staked</p>
              {loadingTotal ? (
                <Skeleton className="h-7 w-32 mt-1" />
              ) : (
                <p className="text-xl font-bold">{formatTokenAmount(asBigint(totalStake), 18, 0)}</p>
              )}
            </div>
            {isConnected && (
              <div className="rounded-lg bg-muted/30 p-4">
                <p className="text-sm text-muted-foreground">Your SAFE Staked</p>
                {loadingUser ? (
                  <Skeleton className="h-7 w-32 mt-1" />
                ) : (
                  <p className="text-xl font-bold">{formatTokenAmount(userStakeAmount ?? 0n, 18, 0)}</p>
                )}
              </div>
            )}
          </div>

          {isConnected && (
            <div className="flex gap-3">
              <Button variant="gradient" onClick={() => setDelegateOpen(true)} disabled={!isActive || wrongNetwork}>
                Stake
              </Button>
              <Button variant="outline" disabled={!hasStake || wrongNetwork} onClick={() => setUndelegateOpen(true)}>
                Unstake
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {delegateOpen && <DelegateDialog validator={validator} open={delegateOpen} onOpenChange={setDelegateOpen} />}
      {undelegateOpen && <UndelegateDialog validator={validator} open={undelegateOpen} onOpenChange={setUndelegateOpen} />}
    </div>
  )
}
