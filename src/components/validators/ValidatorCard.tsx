import { useState, useEffect } from "react"
import { Link } from "react-router-dom"
import type { Address } from "viem"
import { useAccount } from "wagmi"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { DelegateDialog } from "@/components/staking/DelegateDialog"
import { UndelegateDialog } from "@/components/staking/UndelegateDialog"
import { type ValidatorInfo, findValidator } from "@/hooks/useValidators"
import { truncateAddress, formatTokenAmount } from "@/lib/format"
import { copyToClipboard } from "@/lib/clipboard"
import { useToast } from "@/hooks/useToast"
import { useWrongNetwork } from "@/hooks/useWrongNetwork"

interface ValidatorCardProps {
  validator: Address
  isActive: boolean
  autoOpenDelegate?: boolean
  totalStake?: bigint
  loadingTotalStake?: boolean
  userStake?: bigint
  loadingUserStake?: boolean
  validators?: ValidatorInfo[]
}

export function ValidatorCard({
  validator,
  isActive,
  autoOpenDelegate,
  totalStake,
  loadingTotalStake,
  userStake,
  loadingUserStake,
  validators,
}: ValidatorCardProps) {
  const { isConnected } = useAccount()
  const loadingTotal = loadingTotalStake ?? false
  const loadingUser = loadingUserStake ?? false
  const metadata = findValidator(validators, validator)
  const { toast } = useToast()
  const wrongNetwork = useWrongNetwork()
  const [delegateOpen, setDelegateOpen] = useState(false)
  const [undelegateOpen, setUndelegateOpen] = useState(false)

  const hasStake = userStake !== undefined && userStake > 0n

  useEffect(() => {
    if (autoOpenDelegate && isActive) {
      setDelegateOpen(true)
    }
  }, [autoOpenDelegate, isActive])

  const cardBorder = isActive
    ? "border-black/12 dark:border-white/32"
    : "border-black/[0.06] dark:border-white/[0.06]"

  const cardBg = isActive
    ? "bg-white dark:bg-card"
    : "bg-[#F7F7F7] dark:bg-[#1A1B1A]/60"

  // Inactive cards dim the name and values to 60% opacity
  const nameColor = isActive
    ? "text-foreground"
    : "text-black/60 dark:text-white/60"
  const valueColor = isActive
    ? "text-foreground"
    : "text-black/60 dark:text-white/60"

  return (
    <>
      <div
        className={`flex flex-col border ${cardBorder} ${cardBg}`}
      >
        {/* Header: name + badge, 78px, border-bottom */}
        <div
          className="flex items-center justify-between
            px-6 py-4 border-b border-black/12 dark:border-white/12"
          style={{ minHeight: 78 }}
        >
          <div className="min-w-0 flex flex-col gap-1">
            <Link
              to={`/validators/${validator}`}
              className={`text-2xl font-normal hover:underline truncate block
                leading-none ${nameColor}`}
            >
              {metadata
                ? metadata.label
                : <span className="font-mono">
                    {truncateAddress(validator)}
                  </span>}
            </Link>
            {metadata && (
              <button
                className="text-sm font-mono
                  text-black/30 dark:text-white/30
                  hover:text-foreground transition-colors text-left
                  leading-[18px]"
                onClick={async () => {
                  const ok = await copyToClipboard(validator)
                  if (ok) {
                    toast({ variant: "success", title: "Address copied" })
                  }
                }}
                title="Copy validator address"
              >
                {truncateAddress(validator)}
              </button>
            )}
          </div>
          {isActive ? (
            <span
              className="shrink-0 inline-flex items-center
                px-[7px] py-[3px] text-sm font-mono uppercase
                leading-[18px]
                text-[#007441] dark:text-[#27D18B]
                bg-[#27D18B]/[0.18]
                border border-[#27D18B]/[0.42]"
            >
              Active
            </span>
          ) : (
            <span
              className="shrink-0 inline-flex items-center
                px-[7px] py-[3px] text-sm font-mono uppercase
                leading-[18px]
                text-[#4E0B00] dark:text-[#FF7A66]
                bg-[#FF7A66]/[0.20]
                border border-[#FF7A66]/[0.45]"
            >
              Inactive
            </span>
          )}
        </div>

        {/* Content: two columns with vertical divider */}
        <div className="flex flex-1 min-h-0">
          {/* Left column — Commission */}
          <div className="flex-1 flex flex-col gap-1 px-6 py-4">
            <span className="text-base font-heading text-black/30 dark:text-white/30 leading-none">
              Commission:
            </span>
            <span className={`text-xl font-mono leading-none uppercase ${valueColor}`}>
              {metadata ? `${metadata.commission}%` : "—"}
            </span>
          </div>
          {/* Vertical divider */}
          <div className="w-px bg-black/12 dark:bg-white/12 self-stretch" />
          {/* Right column — Participation */}
          <div className="flex-1 flex flex-col gap-1 px-6 py-4">
            <span className="text-base font-heading text-black/30 dark:text-white/30 leading-none">
              Participation (14d):
            </span>
            <span className={`text-xl font-mono leading-none uppercase ${valueColor}`}>
              {metadata ? `${metadata.participationRate}%` : "—"}
            </span>
          </div>
        </div>

        {/* Footer: Total SAFE Staked, border-top */}
        <div
          className="flex items-center justify-between
            px-6 py-4 border-t border-black/12 dark:border-white/12"
          style={{ minHeight: 52 }}
        >
          <span className="text-base font-heading text-black/30 dark:text-white/30 leading-none">
            Total SAFE Staked
          </span>
          {loadingTotal ? (
            <Skeleton className="h-5 w-28" />
          ) : (
            <span className={`text-xl font-mono leading-none uppercase ${valueColor}`}>
              {formatTokenAmount(totalStake ?? 0n, 18, 0)}
            </span>
          )}
        </div>

        {/* Connected: user stake + actions */}
        {isConnected && (
          <>
            <div
              className="flex items-center justify-between
                px-6 py-4 border-t border-black/12 dark:border-white/12"
              style={{ minHeight: 52 }}
            >
              <span className="text-base font-heading text-black/30 dark:text-white/30 leading-none">
                Your Stake
              </span>
              {loadingUser ? (
                <Skeleton className="h-5 w-28" />
              ) : (
                <span className={`text-xl font-mono leading-none uppercase ${valueColor}`}>
                  {formatTokenAmount(userStake ?? 0n, 18, 0)}
                </span>
              )}
            </div>
            <div
              className="flex gap-3 px-6 py-3
                border-t border-black/12 dark:border-white/12"
            >
              <Button
                size="sm"
                variant="gradient"
                className="flex-1"
                onClick={() => setDelegateOpen(true)}
                disabled={!isActive || wrongNetwork}
              >
                Stake
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="flex-1"
                disabled={!hasStake || wrongNetwork}
                onClick={() => setUndelegateOpen(true)}
              >
                Unstake
              </Button>
            </div>
          </>
        )}
      </div>

      {delegateOpen && (
        <DelegateDialog
          validator={validator}
          open={delegateOpen}
          onOpenChange={setDelegateOpen}
        />
      )}
      {undelegateOpen && (
        <UndelegateDialog
          validator={validator}
          open={undelegateOpen}
          onOpenChange={setUndelegateOpen}
        />
      )}
    </>
  )
}
