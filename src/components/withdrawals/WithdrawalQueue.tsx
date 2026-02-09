import { useAccount } from "wagmi"
import { usePendingWithdrawals } from "@/hooks/useWithdrawals"
import { useClaimWithdrawal } from "@/hooks/useStakingWrites"
import { useToast } from "@/hooks/useToast"
import { formatContractError } from "@/lib/errorFormat"
import { WithdrawalCard } from "./WithdrawalCard"
import { Skeleton } from "@/components/ui/skeleton"
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip"
import { useEffect } from "react"
import { Info } from "lucide-react"

export function WithdrawalQueue() {
  const { isConnected } = useAccount()
  const { data: withdrawals, isLoading } = usePendingWithdrawals()
  const { claimWithdrawal, isSigningTx, isConfirmingTx, isSuccess: isClaimed, error: claimError, txHash: claimTxHash } = useClaimWithdrawal()
  const { toast } = useToast()

  useEffect(() => {
    if (isClaimed) {
      toast({ variant: "success", title: "Withdrawal claimed", description: "SAFE tokens sent to your wallet", txHash: claimTxHash! })
    }
  }, [isClaimed, toast, claimTxHash])

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
      <div className="flex items-center gap-2">
        <h2 className="text-lg font-semibold">Pending Withdrawals</h2>
        <Tooltip>
          <TooltipTrigger asChild>
            <button className="text-muted-foreground hover:text-foreground">
              <Info className="h-4 w-4" />
            </button>
          </TooltipTrigger>
          <TooltipContent side="right" className="max-w-xs">
            Withdrawals are processed in FIFO order. The oldest withdrawal must be claimed first before newer ones become available.
          </TooltipContent>
        </Tooltip>
      </div>
      {items.map((w, i) => (
        <WithdrawalCard
          key={i}
          amount={w.amount}
          claimableAt={Number(w.claimableAt)}
          isFirst={i === 0}
          onClaim={claimWithdrawal}
          isSigningTx={isSigningTx}
          isConfirmingTx={isConfirmingTx}
        />
      ))}
    </div>
  )
}
