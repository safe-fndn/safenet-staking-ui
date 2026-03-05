import { useState, useMemo } from "react"
import { Link } from "react-router-dom"
import { useAccount } from "wagmi"
import { useValidators, findValidator, type ValidatorInfo } from "@/hooks/useValidators"
import { useUserStakesOnValidators } from "@/hooks/useStakingReads"
import { useRewards } from "@/hooks/useRewards"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip"
import { UndelegateDialog } from "@/components/staking/UndelegateDialog"
import { ClaimRewardsDialog } from "./ClaimRewardsDialog"
import { truncateAddress, formatTokenAmount } from "@/lib/format"
import Info from "lucide-react/dist/esm/icons/info"
import type { Address } from "viem"

const rewardsDocsUrl = "https://docs.safefoundation.org/safenet/protocol/rewards#minimum-payout-threshold"

interface Position {
  validator: Address
  amount: bigint
  isActive: boolean
}

function PositionRow({ position, validators }: { position: Position; validators?: ValidatorInfo[] }) {
  const metadata = findValidator(validators, position.validator)
  const [undelegateOpen, setUndelegateOpen] = useState(false)

  return (
    <>
      <tr className="border-b last:border-b-0">
        <td className="py-3 pr-4">
          <Link
            to={`/validators/${position.validator}`}
            className="text-sm font-medium hover:underline"
          >
            {metadata ? metadata.label : <span className="font-mono">{truncateAddress(position.validator)}</span>}
          </Link>
        </td>
        <td className="py-3 pr-4 text-sm font-semibold text-right">
          {formatTokenAmount(position.amount, 18, 0)}
        </td>
        <td className="py-3 pr-4 text-sm text-right text-muted-foreground">
          {metadata ? `${metadata.participationRate}%` : "—"}
        </td>
        <td className="py-3 pr-4 text-right">
          {position.isActive ? (
            <Badge variant="secondary">Active</Badge>
          ) : (
            <Badge className="bg-warning/20 text-warning hover:bg-warning/30">Inactive</Badge>
          )}
        </td>
        <td className="py-3 text-right">
          <Button
            size="sm"
            variant="outline"
            onClick={() => setUndelegateOpen(true)}
          >
            Unstake
          </Button>
        </td>
      </tr>
      {undelegateOpen && (
        <UndelegateDialog
          validator={position.validator}
          open={undelegateOpen}
          onOpenChange={setUndelegateOpen}
        />
      )}
    </>
  )
}

export function StakingSection() {
  const { isConnected } = useAccount()
  const { data: validators } = useValidators()
  const validatorAddresses = useMemo(
    () => (validators ?? []).map((v) => v.address),
    [validators],
  )
  const { data: stakes, isLoading } = useUserStakesOnValidators(validatorAddresses)
  const { data: rewards } = useRewards()
  const [claimOpen, setClaimOpen] = useState(false)

  if (!isConnected) {
    return null
  }

  if (isLoading || !validators) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Your Rewards</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {Array.from({ length: 2 }).map((_, i) => (
            <Skeleton key={i} className="h-12" />
          ))}
        </CardContent>
      </Card>
    )
  }

  const positions: Position[] = []
  if (stakes) {
    for (let i = 0; i < validatorAddresses.length; i++) {
      const result = stakes[i]
      if (result.status === "success" && typeof result.result === "bigint") {
        const amount = result.result
        if (amount > 0n) {
          const validator = validators.find((v) => v.address === validatorAddresses[i])
          positions.push({
            validator: validatorAddresses[i],
            amount,
            isActive: validator?.isActive ?? false,
          })
        }
      }
    }
  }

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <CardTitle>Your Rewards</CardTitle>
            <Tooltip>
              <TooltipTrigger asChild>
                <button className="text-muted-foreground hover:text-foreground" aria-label="Rewards info">
                  <Info className="h-4 w-4" aria-hidden="true" />
                </button>
              </TooltipTrigger>
              <TooltipContent className="max-w-xs text-xs">
                <p>Rewards are subject to a minimum payout threshold.</p>
                <p className="mt-1">KYC may be required to claim rewards.</p>
                <a
                  href={rewardsDocsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-1 inline-block underline text-primary-foreground/80 hover:text-primary-foreground"
                >
                  Learn more
                </a>
              </TooltipContent>
            </Tooltip>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Rewards */}
          <div className="flex items-center justify-between rounded-lg border p-3">
            <div>
              <span className="text-sm text-muted-foreground">Claimable SAFE</span>
              <p className="font-semibold">{formatTokenAmount(rewards.claimable, 18, 0)}</p>
              {rewards.totalClaimed > 0n && (
                <p className="text-xs text-muted-foreground mt-0.5">
                  Total claimed: {formatTokenAmount(rewards.totalClaimed, 18, 0)} SAFE
                </p>
              )}
            </div>
            <Button
              size="sm"
              disabled={!rewards.canClaim}
              onClick={() => setClaimOpen(true)}
            >
              Claim Rewards
            </Button>
          </div>

          {/* Positions */}
          {positions.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              You have no active stakes. Visit the{" "}
              <Link to="/validators" className="text-primary underline hover:text-primary/80">
                Validators
              </Link>{" "}
              page to stake.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b text-xs text-muted-foreground">
                    <th className="pb-2 pr-4 text-left font-medium">Validator</th>
                    <th className="pb-2 pr-4 text-right font-medium">SAFE Amount</th>
                    <th className="pb-2 pr-4 text-right font-medium">Participation (14d)</th>
                    <th className="pb-2 pr-4 text-right font-medium">Status</th>
                    <th className="pb-2 text-right font-medium">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {positions.map((pos) => (
                    <PositionRow key={pos.validator} position={pos} validators={validators} />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <ClaimRewardsDialog open={claimOpen} onOpenChange={setClaimOpen} />
    </>
  )
}
