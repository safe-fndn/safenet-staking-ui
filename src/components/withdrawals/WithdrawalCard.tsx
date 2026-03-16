import { Progress } from "@/components/ui/progress"
import {
  formatTokenAmount,
  formatCountdown,
  truncateAddress,
} from "@/lib/format"
import { useCountdown } from "@/hooks/useCountdown"
import { findValidator, type ValidatorInfo } from "@/hooks/useValidators"
import type { Address } from "viem"
import Loader2 from "lucide-react/dist/esm/icons/loader-2"
import ArrowUpRight from "lucide-react/dist/esm/icons/arrow-up-right"

interface WithdrawalCardProps {
  amount: bigint
  claimableAt: number
  isFirst: boolean
  onClaim: () => void
  isSigningTx: boolean
  isConfirmingTx: boolean
  withdrawDelay?: number
  validator?: Address
  validators?: ValidatorInfo[]
}

export function WithdrawalCard({
  amount,
  claimableAt,
  isFirst,
  onClaim,
  isSigningTx,
  isConfirmingTx,
  withdrawDelay,
  validator,
  validators,
}: WithdrawalCardProps) {
  const secondsLeft = useCountdown(claimableAt)
  const canClaim = isFirst && secondsLeft === 0
  const isBusy = isSigningTx || isConfirmingTx

  const totalDelay = withdrawDelay ?? 0
  const progress =
    totalDelay > 0
      ? Math.min(100, ((totalDelay - secondsLeft) / totalDelay) * 100)
      : secondsLeft === 0
        ? 100
        : 0

  const metadata = validator ? findValidator(validators, validator) : undefined
  const isZero =
    validator === "0x0000000000000000000000000000000000000000"
  const validatorLabel = isZero
    ? "Unknown validator"
    : metadata
      ? metadata.label
      : validator
        ? truncateAddress(validator)
        : undefined

  return (
    <div className="border border-black/12 dark:border-white/32 bg-white dark:bg-card">
      <div className="flex items-center justify-between px-6 py-4">
        {/* Left: validator info + status badge */}
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            {validatorLabel && (
              <span className="text-2xl font-heading font-normal leading-none">
                {validatorLabel}
              </span>
            )}
            {validator && !isZero && (
              <span
                className="text-sm font-mono uppercase leading-[18px]
                  text-black/30 dark:text-white/30"
              >
                {truncateAddress(validator)}
              </span>
            )}
          </div>
          {secondsLeft === 0 ? (
            <span
              className="inline-flex items-center self-start
                px-[7px] py-[3px] text-sm font-mono uppercase
                leading-[18px]
                text-[#007441] dark:text-[#27D18B]
                bg-[#27D18B]/[0.18]
                border border-[#27D18B]/[0.42]"
            >
              Ready to withdraw
            </span>
          ) : (
            <span
              className="inline-flex items-center self-start
                px-[7px] py-[3px] text-sm font-mono uppercase
                leading-[18px]
                text-black/60 dark:text-white/60
                bg-black/[0.06] dark:bg-white/[0.06]
                border border-black/12 dark:border-white/12"
            >
              {formatCountdown(secondsLeft)}
            </span>
          )}
        </div>

        {/* Right: amount + claim button */}
        <div className="flex flex-col items-end gap-4">
          <span className="text-xl font-mono leading-none uppercase">
            {formatTokenAmount(amount, 18, 0)} SAFE
          </span>
          {canClaim && (
            <button
              onClick={onClaim}
              disabled={isBusy}
              className="inline-flex items-center gap-[5px]
                px-2 py-1 text-[11.5px] font-mono uppercase
                leading-[15px] border border-foreground
                bg-background hover:bg-accent
                disabled:opacity-50 transition-colors"
            >
              {isSigningTx ? (
                <>
                  <Loader2
                    className="h-4 w-4 animate-spin"
                    aria-hidden="true"
                  />
                  Signing…
                </>
              ) : isConfirmingTx ? (
                <>
                  <Loader2
                    className="h-4 w-4 animate-spin"
                    aria-hidden="true"
                  />
                  Confirming…
                </>
              ) : (
                <>
                  Claim
                  <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
                </>
              )}
            </button>
          )}
        </div>
      </div>

      {/* Cooldown progress bar (only when waiting) */}
      {secondsLeft > 0 && (
        <div className="px-6 pb-4 space-y-1">
          <div
            className="flex items-center justify-between
              text-xs text-muted-foreground"
          >
            <span>Cooldown progress</span>
            <span>{Math.round(progress)}%</span>
          </div>
          <Progress value={progress} size="sm" />
        </div>
      )}
    </div>
  )
}
