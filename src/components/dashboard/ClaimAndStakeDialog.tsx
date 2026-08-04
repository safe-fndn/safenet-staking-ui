import { useState, useEffect, useCallback } from "react"
import { useAccount } from "wagmi"
import type { Address } from "viem"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import { TxButton } from "@/components/ui/TxButton"
import { useValidators, findValidator } from "@/hooks/useValidators"
import { useRewardProof } from "@/hooks/useRewardProof"
import { useRewards } from "@/hooks/useRewards"
import { useApprovalFlow } from "@/hooks/useApprovalFlow"
import { useClaimRewards } from "@/hooks/useClaimRewards"
import { useStake, useBatchClaimAndStake } from "@/hooks/useStakingWrites"
import { useTxToast } from "@/hooks/useTxToast"
import { useToast } from "@/hooks/useToast"
import { formatTokenAmount, truncateAddress } from "@/lib/format"

interface ClaimAndStakeDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  defaultValidator?: Address
}

export function ClaimAndStakeDialog({ open, onOpenChange, defaultValidator }: ClaimAndStakeDialogProps) {
  const { address } = useAccount()
  const { data: validators } = useValidators()
  const { data: proof } = useRewardProof(address)
  const { data: rewards } = useRewards()
  const { toast } = useToast()

  const [selectedValidator, setSelectedValidator] = useState<Address | undefined>(defaultValidator)
  const [claimed, setClaimed] = useState(false)
  const [stakeAmount, setStakeAmount] = useState(0n)

  // rewards.claimable resets to 0 as soon as the claim leg is invalidated, so the
  // amount that still needs to be staked is snapshotted once the claim succeeds.
  const amountToStake = claimed ? stakeAmount : rewards.claimable

  useEffect(() => {
    if (open) {
      setSelectedValidator(defaultValidator)
    }
  }, [open, defaultValidator])

  const {
    needsApproval,
    approvalType,
    isApprovalPending,
    isSigningApproval,
    isConfirmingApproval,
    approveExact,
    approveUnlimited,
    resetApprovalFlow,
  } = useApprovalFlow(amountToStake)

  const {
    claimRewards,
    isSigningTx: isClaimSigning,
    isConfirmingTx: isClaimConfirming,
    isSuccess: isClaimSuccess,
    isSafeQueued: isClaimSafeQueued,
    error: claimError,
    reset: resetClaim,
    txHash: claimTxHash,
  } = useClaimRewards()

  const {
    stake,
    isSigningTx: isStakeSigning,
    isConfirmingTx: isStakeConfirming,
    isSuccess: isStaked,
    isSafeQueued: isStakeSafeQueued,
    error: stakeError,
    reset: resetStake,
    txHash: stakeTxHash,
  } = useStake()

  const {
    batchClaimAndStake,
    supportsBatching,
    isSigningTx: isBatchSigning,
    isConfirmingTx: isBatchConfirming,
    isSuccess: isBatchSuccess,
    isReverted: isBatchReverted,
    error: batchError,
    reset: resetBatch,
    txHash: batchTxHash,
  } = useBatchClaimAndStake()

  const isBatchFlow = supportsBatching
  const validatorLabel = selectedValidator ? truncateAddress(selectedValidator) : "validator"

  const closeAndReset = useCallback(() => {
    setClaimed(false)
    setStakeAmount(0n)
    onOpenChange(false)
  }, [onOpenChange])

  // Claim leg toasts (sequential flow, step 1)
  useTxToast(
    {
      successTitle: "Rewards claimed",
      successDescription: `Claimed ${formatTokenAmount(rewards.claimable)} SAFE — now stake it below`,
      errorTitle: "Claim failed",
      safeQueuedDescription:
        "Your claim has been sent to Safe Wallet for signing. Return here once it executes to continue staking.",
    },
    {
      isSuccess: isClaimSuccess,
      error: claimError,
      isSafeQueued: isClaimSafeQueued,
      txHash: claimTxHash,
      reset: resetClaim,
      onSuccess: () => {
        setStakeAmount(rewards.claimable)
        setClaimed(true)
      },
    },
  )

  // Stake leg toasts (sequential flow, final step)
  useTxToast(
    {
      successTitle: "Claim + stake successful",
      successDescription: `Staked ${formatTokenAmount(amountToStake)} SAFE to ${validatorLabel}`,
      errorTitle: "Staking failed",
      safeQueuedDescription: "Your delegation has been sent to Safe Wallet for signing.",
    },
    {
      isSuccess: isStaked,
      error: stakeError,
      isSafeQueued: isStakeSafeQueued,
      txHash: stakeTxHash,
      reset: resetStake,
      onSuccess: closeAndReset,
    },
  )

  // Batch flow toasts
  useTxToast(
    {
      successTitle: "Claim + stake successful",
      successDescription: `Claimed and staked ${formatTokenAmount(amountToStake)} SAFE to ${validatorLabel}`,
      errorTitle: "Claim + stake failed",
    },
    {
      isSuccess: isBatchSuccess,
      error: batchError,
      isSafeQueued: false,
      txHash: batchTxHash,
      reset: resetBatch,
      onSuccess: closeAndReset,
    },
  )

  useEffect(() => {
    if (isBatchReverted) {
      toast({ variant: "error", title: "Transaction reverted", description: "The batch transaction was reverted onchain" })
      resetBatch()
    }
  }, [isBatchReverted, resetBatch, toast])

  useEffect(() => {
    if (!open) {
      setClaimed(false)
      setStakeAmount(0n)
      resetApprovalFlow()
      resetClaim()
      resetStake()
      resetBatch()
    }
  }, [open, resetApprovalFlow, resetClaim, resetStake, resetBatch])

  const totalSteps = needsApproval ? 3 : 2
  const currentStep = !claimed ? 1 : needsApproval ? 2 : totalSteps
  const stepLabel = !claimed ? "Claim rewards" : needsApproval ? "Approve SAFE for staking" : "Stake"

  function handleConfirm() {
    if (!address || !proof || !proof.proof || !selectedValidator) return
    if (isBatchFlow) {
      batchClaimAndStake(
        address,
        BigInt(proof.cumulativeAmount),
        proof.merkleRoot,
        proof.proof,
        selectedValidator,
        rewards.claimable,
        needsApproval,
      )
    } else {
      claimRewards(address, BigInt(proof.cumulativeAmount), proof.merkleRoot, proof.proof)
    }
  }

  const selectedMeta = selectedValidator ? findValidator(validators, selectedValidator) : null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Claim + Stake</DialogTitle>
          <DialogDescription>
            Claim your accumulated SAFE rewards and stake them to a validator in one action.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex items-center justify-between rounded-lg border p-4">
            <span className="text-sm text-muted-foreground">Claimable SAFE</span>
            <span className="text-lg font-semibold">{formatTokenAmount(rewards.claimable)}</span>
          </div>

          <div className="space-y-1.5">
            <label htmlFor="claim-stake-validator" className="text-sm text-muted-foreground">
              Validator
            </label>
            <select
              id="claim-stake-validator"
              className="flex h-9 w-full rounded-md border border-input/60 bg-card px-3 py-1 text-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 md:text-sm"
              value={selectedValidator ?? ""}
              disabled={claimed || !validators}
              onChange={(e) => setSelectedValidator(e.target.value as Address)}
            >
              <option value="" disabled>
                {validators ? "Select a validator" : "Loading validators…"}
              </option>
              {(validators ?? []).map((v) => (
                <option key={v.address} value={v.address}>
                  {v.label || truncateAddress(v.address)}
                </option>
              ))}
            </select>
          </div>

          {selectedValidator && (
            <div className="space-y-1 rounded-lg border p-4 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Validator</span>
                <span>{selectedMeta ? selectedMeta.label : truncateAddress(selectedValidator)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Amount to stake</span>
                <span>{formatTokenAmount(amountToStake)} SAFE</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Execution</span>
                <span>{isBatchFlow ? "One transaction (batched)" : "Multiple transactions"}</span>
              </div>
            </div>
          )}

          {!isBatchFlow && (
            <p className="text-xs text-muted-foreground">
              Step {currentStep} of {totalSteps}: {stepLabel}
            </p>
          )}

          <div className="flex flex-col gap-2">
            {isBatchFlow ? (
              <TxButton
                className="w-full"
                isSigningTx={isBatchSigning}
                isConfirmingTx={isBatchConfirming}
                signingLabel="Confirm in Safe…"
                onClick={handleConfirm}
                disabled={!rewards.canClaim || !selectedValidator}
              >
                Claim + Stake
              </TxButton>
            ) : !claimed ? (
              <TxButton
                className="w-full"
                isSigningTx={isClaimSigning}
                isConfirmingTx={isClaimConfirming}
                onClick={handleConfirm}
                disabled={!rewards.canClaim || !selectedValidator}
              >
                Claim Rewards
              </TxButton>
            ) : needsApproval ? (
              <>
                {approvalType !== "unlimited" && (
                  <TxButton
                    className="w-full"
                    isSigningTx={isSigningApproval && approvalType === "exact"}
                    isConfirmingTx={isConfirmingApproval && approvalType === "exact"}
                    signingLabel="Confirm Approval in Wallet…"
                    confirmingLabel="Approval confirming…"
                    onClick={approveExact}
                    disabled={isApprovalPending}
                  >
                    Approve exact amount
                  </TxButton>
                )}
                {approvalType !== "exact" && (
                  <TxButton
                    className="w-full"
                    variant="outline"
                    isSigningTx={isSigningApproval && approvalType === "unlimited"}
                    isConfirmingTx={isConfirmingApproval && approvalType === "unlimited"}
                    signingLabel="Confirm Approval in Wallet…"
                    confirmingLabel="Approval confirming…"
                    onClick={approveUnlimited}
                    disabled={isApprovalPending}
                  >
                    Approve unlimited
                  </TxButton>
                )}
              </>
            ) : (
              <TxButton
                className="w-full"
                isSigningTx={isStakeSigning}
                isConfirmingTx={isStakeConfirming}
                onClick={() => selectedValidator && stake(selectedValidator, amountToStake)}
                disabled={!selectedValidator}
              >
                Stake
              </TxButton>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
