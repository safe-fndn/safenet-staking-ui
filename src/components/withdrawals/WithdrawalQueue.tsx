import { useAccount } from "wagmi"
import { usePendingWithdrawals } from "@/hooks/useWithdrawals"
import { useClaimWithdrawal } from "@/hooks/useStakingWrites"
import { useToast } from "@/hooks/useToast"
import { formatContractError } from "@/lib/errorFormat"
import { WithdrawalCard } from "./WithdrawalCard"
import { Skeleton } from "@/components/ui/skeleton"
import { useEffect } from "react"

export function WithdrawalQueue() {
  const { isConnected } = useAccount()
  const { data: withdrawals, isLoading, refetch } = usePendingWithdrawals()
  const { claimWithdrawal, isPending: isClaiming, isSuccess: isClaimed, error: claimError, txHash: claimTxHash } = useClaimWithdrawal()
  const { toast } = useToast()

  useEffect(() => {
    if (isClaimed) {
      toast({ variant: "success", title: "Withdrawal claimed", description: "SAFE tokens sent to your wallet", txHash: claimTxHash! })
      refetch()
    }
  }, [isClaimed, refetch, toast, claimTxHash])

  useEffect(() => {
    if (claimError) {
      toast({ variant: "error", title: "Claim failed", description: formatContractError(claimError) })
    }
  }, [claimError, toast])

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

  const items = withdrawals as readonly { amount: bigint; claimableAt: bigint }[] | undefined

  if (!items || items.length === 0) {
    return (
      <div className="rounded-lg border p-8 text-center text-muted-foreground">
        No pending withdrawals.
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {items.map((w, i) => (
        <WithdrawalCard
          key={i}
          amount={w.amount}
          claimableAt={Number(w.claimableAt)}
          isFirst={i === 0}
          onClaim={claimWithdrawal}
          isClaiming={isClaiming}
        />
      ))}
    </div>
  )
}
