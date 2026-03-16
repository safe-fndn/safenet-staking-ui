import { useAccount } from "wagmi"
import { usePendingWithdrawals } from "@/hooks/useWithdrawals"
import { useWithdrawDelay } from "@/hooks/useStakingReads"
import { useWithdrawalValidators } from "@/hooks/useWithdrawalValidators"
import { useValidators } from "@/hooks/useValidators"
import { useClaimWithdrawal, useBatchClaimWithdrawals } from "@/hooks/useStakingWrites"
import { useToast } from "@/hooks/useToast"
import { useTxToast } from "@/hooks/useTxToast"
import { formatContractError } from "@/lib/errorFormat"
import { WithdrawalCard } from "./WithdrawalCard"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip"
import { useState, useEffect, useMemo, useCallback } from "react"
import Info from "lucide-react/dist/esm/icons/info"
import Loader2 from "lucide-react/dist/esm/icons/loader-2"

export function WithdrawalQueue() {
  const { isConnected } = useAccount()
  const { data: withdrawals, isLoading } = usePendingWithdrawals()
  const { data: withdrawDelay } = useWithdrawDelay()
  const { data: withdrawalValidators } = useWithdrawalValidators()
  const { data: allValidators } = useValidators()
  const { claimWithdrawal, isSigningTx, isConfirmingTx, isSuccess: isClaimed, isSafeQueued: isClaimSafeQueued, error: claimError, txHash: claimTxHash, reset: resetClaim } = useClaimWithdrawal()
  const {
    batchClaimWithdrawals,
    supportsBatching,
    isSigningTx: isBatchSigning,
    isConfirmingTx: isBatchConfirming,
    isSuccess: isBatchClaimed,
    isReverted: isBatchReverted,
    error: batchError,
    reset: resetBatch,
    txHash: batchTxHash,
  } = useBatchClaimWithdrawals()
  const { toast } = useToast()
  const [claimingIndex, setClaimingIndex] = useState<number | null>(null)

  const [now, setNow] = useState(() => Math.floor(Date.now() / 1000))
  const nextClaimableAt = useMemo(
    () => {
      if (!withdrawals) return null
      const upcoming = withdrawals
        .map((w) => Number(w.claimableAt))
        .filter((t) => t > now)
      return upcoming.length > 0 ? Math.min(...upcoming) : null
    },
    [withdrawals, now],
  )
  useEffect(() => {
    if (nextClaimableAt === null) return
    const ms = (nextClaimableAt - Math.floor(Date.now() / 1000)) * 1000 + 500
    const delay = ms <= 0 ? 0 : ms
    const id = setTimeout(() => setNow(Math.floor(Date.now() / 1000)), delay)
    return () => clearTimeout(id)
  }, [nextClaimableAt])
  const claimableCount = withdrawals
    ? withdrawals.filter((w) => Number(w.claimableAt) <= now).length
    : 0
  const showClaimAll = supportsBatching && claimableCount >= 2
  const isBatchBusy = isBatchSigning || isBatchConfirming

  const handleClaimReset = useCallback(() => {
    resetClaim()
    setClaimingIndex(null)
  }, [resetClaim])

  useTxToast(
    {
      successTitle: "Withdrawal claimed",
      successDescription: "SAFE tokens sent to your wallet",
      errorTitle: "Claim failed",
      safeQueuedDescription: "Your claim has been sent to Safe Wallet for signing.",
    },
    {
      isSuccess: isClaimed,
      error: claimError,
      isSafeQueued: isClaimSafeQueued,
      txHash: claimTxHash,
      reset: handleClaimReset,
    },
  )

  useEffect(() => {
    if (isBatchClaimed) {
      toast({ variant: "success", title: "All withdrawals claimed", description: "SAFE tokens sent to your wallet", txHash: batchTxHash })
      resetBatch()
    }
  }, [isBatchClaimed, toast, batchTxHash, resetBatch])

  useEffect(() => {
    if (batchError) {
      toast({ variant: "error", title: "Batch claim failed", description: formatContractError(batchError) })
    }
  }, [batchError, toast])

  useEffect(() => {
    if (isBatchReverted) {
      toast({ variant: "error", title: "Batch claim reverted", description: "The batch transaction was reverted onchain" })
      resetBatch()
    }
  }, [isBatchReverted, resetBatch, toast])

  if (!isConnected) {
    return (
      <div className="rounded-lg border p-8 text-center text-muted-foreground">
        Connect your wallet to view withdrawal queue.
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 2 }).map((_, i) => (
          <Skeleton key={i} className="h-20" />
        ))}
      </div>
    )
  }

  if (!withdrawals || withdrawals.length === 0) {
    return (
      <div className="rounded-lg border p-8 text-center text-muted-foreground">
        No pending withdrawals.
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-semibold">Pending Withdrawals</h2>
          <Tooltip>
            <TooltipTrigger asChild>
              <button className="text-muted-foreground hover:text-foreground" aria-label="Withdrawal queue info">
                <Info className="h-4 w-4" aria-hidden="true" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="right" className="max-w-xs">
              Withdrawals are processed in FIFO order. The oldest withdrawal must be claimed first before newer ones become available.
            </TooltipContent>
          </Tooltip>
        </div>
        {showClaimAll && (
          <Button
            size="sm"
            onClick={() => batchClaimWithdrawals(claimableCount)}
            disabled={isBatchBusy}
          >
            {isBatchSigning ? (
              <>
                <Loader2 className="animate-spin" aria-hidden="true" />
                Confirm in Wallet…
              </>
            ) : isBatchConfirming ? (
              <>
                <Loader2 className="animate-spin" aria-hidden="true" />
                Confirming onchain…
              </>
            ) : (
              `Claim All (${claimableCount})`
            )}
          </Button>
        )}
      </div>
      {withdrawals.map((w, i) => (
        <WithdrawalCard
          key={`${w.amount}-${w.claimableAt}`}
          amount={w.amount}
          claimableAt={Number(w.claimableAt)}
          isFirst={i === 0}
          onClaim={() => { setClaimingIndex(i); claimWithdrawal() }}
          isSigningTx={claimingIndex === i && isSigningTx}
          isConfirmingTx={claimingIndex === i && isConfirmingTx}
          withdrawDelay={withdrawDelay !== undefined ? Number(withdrawDelay) : undefined}
          validator={withdrawalValidators?.[i]}
          validators={allValidators}
        />
      ))}
    </div>
  )
}
