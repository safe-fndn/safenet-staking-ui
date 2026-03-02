import { useEffect, useRef } from "react"
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
import { useToast } from "@/hooks/useToast"
import { formatTokenAmount } from "@/lib/format"
import { formatContractError } from "@/lib/errorFormat"

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
    error,
    reset,
    txHash,
  } = useClaimRewards()
  const { toast } = useToast()
  const claimedAmountRef = useRef(0n)

  useEffect(() => {
    if (isSuccess) {
      toast({
        variant: "success",
        title: "Rewards claimed",
        description: `Claimed ${formatTokenAmount(claimedAmountRef.current)} SAFE`,
        txHash: txHash!,
      })
      reset()
      onOpenChange(false)
    }
  }, [isSuccess, reset, onOpenChange, toast, txHash])

  useEffect(() => {
    if (error) {
      toast({
        variant: "error",
        title: "Claim failed",
        description: formatContractError(error),
      })
    }
  }, [error, toast])

  useEffect(() => {
    if (!open) {
      reset()
    }
  }, [open, reset])

  function handleClaim() {
    if (!address || !proof) return
    claimedAmountRef.current = rewards.claimable
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
            disabled={!rewards.canClaim}
          >
            Claim Rewards
          </TxButton>
        </div>
      </DialogContent>
    </Dialog>
  )
}
