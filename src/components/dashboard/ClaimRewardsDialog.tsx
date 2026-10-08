import { useState, useEffect, useCallback } from "react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import { TxButton } from "@/components/ui/TxButton"
import { useAccount } from "wagmi"
import { useRewardProof } from "@/hooks/useRewardProof"
import { useRewards } from "@/hooks/useRewards"
import { useClaimRewards } from "@/hooks/useClaimRewards"
import { useTxToast } from "@/hooks/useTxToast"
import { formatTokenAmount } from "@/lib/format"

interface ClaimRewardsDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function ClaimRewardsDialog({ open, onOpenChange }: ClaimRewardsDialogProps) {
  const { address } = useAccount()
  const { data: proof } = useRewardProof(address)
  const { data: rewards } = useRewards()
  const {
    claimRewards,
    isSigningTx,
    isConfirmingTx,
    isSuccess,
    isSafeQueued,
    error,
    reset,
    txHash,
  } = useClaimRewards()
  // claimable drops to 0 once the claim lands, so the toast uses the amount captured on click.
  const [claimedAmount, setClaimedAmount] = useState(0n)

  const close = useCallback(() => {
    onOpenChange(false)
  }, [onOpenChange])

  useTxToast(
    {
      successTitle: "Rewards claimed",
      successDescription: `Claimed ${formatTokenAmount(claimedAmount)} SAFE`,
      errorTitle: "Claim failed",
      safeQueuedDescription: "Your claim has been sent to Safe Wallet for signing.",
    },
    {
      isSuccess,
      error,
      isSafeQueued,
      txHash,
      reset,
      onSuccess: close,
    },
  )

  useEffect(() => {
    if (!open) {
      reset()
    }
  }, [open, reset])

  function handleClaim() {
    if (!address || !proof || !proof.proof) return
    setClaimedAmount(rewards.claimable)
    claimRewards(
      address,
      BigInt(proof.cumulativeAmount),
      proof.merkleRoot,
      proof.proof,
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Claim Rewards</DialogTitle>
          <DialogDescription>
            Claim your accumulated SAFE staking rewards.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex items-center justify-between rounded-lg border p-4">
            <span className="text-sm text-muted-foreground">Claimable SAFE</span>
            <span className="text-lg font-semibold">
              {formatTokenAmount(rewards.claimable)}
            </span>
          </div>

          <TxButton
            className="w-full"
            isSigningTx={isSigningTx}
            isConfirmingTx={isConfirmingTx}
            onClick={handleClaim}
            disabled={!rewards.canClaim || !address || !proof?.proof}
          >
            Claim Rewards
          </TxButton>
        </div>
      </DialogContent>
    </Dialog>
  )
}
