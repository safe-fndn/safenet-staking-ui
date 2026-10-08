import { useState, useEffect, useCallback } from "react"
import { useAccount } from "wagmi"
import { zeroAddress, type Address } from "viem"
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
import { useStake, useBatchClaimAndStake, useInvalidateOnSuccess } from "@/hooks/useStakingWrites"
import { useTxToast } from "@/hooks/useTxToast"
import { useToast } from "@/hooks/useToast"
import { useGasEstimate } from "@/hooks/useGasEstimate"
import { formatTokenAmount, truncateAddress } from "@/lib/format"
import Fuel from "lucide-react/dist/esm/icons/fuel"
import CheckCircle from "lucide-react/dist/esm/icons/check-circle"

interface ClaimAndStakeDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  defaultValidator?: Address
}

/** What the user reviewed when they confirmed. Cleared if the attempt fails before the claim executes. */
interface ConfirmedFlow {
  amount: bigint
  validator: Address
  withApproval: boolean
  batched: boolean
}

/** Reads to refresh after a failed attempt, so a retry sees the real allowance and balance. */
const RETRY_REFRESH_FN_NAMES = ["allowance", "balanceOf"]
const NO_EXTRA_KEYS: string[][] = []

export function ClaimAndStakeDialog({ open, onOpenChange, defaultValidator }: ClaimAndStakeDialogProps) {
  const { address } = useAccount()
  const { data: validators } = useValidators()
  const { data: proof } = useRewardProof(address)
  const { data: rewards } = useRewards()
  const { toast } = useToast()

  const [selectedValidator, setSelectedValidator] = useState<Address | undefined>(defaultValidator)
  const [flow, setFlow] = useState<ConfirmedFlow | null>(null)
  const [claimed, setClaimed] = useState(false)

  // useRewards polls cumulativeClaimed, so claimable can drop to 0 before the claim
  // receipt resolves. Once the user confirms, everything uses the captured values, so a
  // later change to defaultValidator cannot swap the validator either.
  const amount = flow?.amount ?? rewards.claimable
  const validator = flow?.validator ?? selectedValidator
  const formattedAmount = formatTokenAmount(amount)

  useEffect(() => {
    if (open) {
      setSelectedValidator(defaultValidator)
    }
  }, [open, defaultValidator])

  const {
    allowance,
    needsApproval,
    approvalType,
    isApprovalPending,
    isSigningApproval,
    isConfirmingApproval,
    approveExact,
    approveUnlimited,
    resetApprovalFlow,
  } = useApprovalFlow(amount)

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

  const isBatchFlow = flow?.batched ?? supportsBatching
  // After the claim, a refreshed allowance can still add an approval the user did not see at confirm.
  const withApproval = (flow?.withApproval ?? needsApproval) || (claimed && needsApproval)

  const activeValidators = validators?.filter((v) => v.isActive)
  const selectedMeta = validator ? findValidator(validators, validator) : null
  const validatorName = validator ? (selectedMeta?.label || truncateAddress(validator)) : "validator"
  const isBusy = isClaimSigning || isClaimConfirming || isBatchSigning || isBatchConfirming
  // The allowance must be known so the approval step and the batch calls are right.
  const canConfirm =
    rewards.canClaim && !!address && !!proof?.proof && !!selectedMeta?.isActive && allowance !== undefined

  // The stake call only succeeds after the claim and any approval, so skip the estimate until then.
  const { estimatedCost: gasEstimate } = useGasEstimate(
    "stake",
    validator ?? zeroAddress,
    claimed && !needsApproval ? amount : 0n,
  )

  const closeAndReset = useCallback(() => {
    setFlow(null)
    setClaimed(false)
    onOpenChange(false)
  }, [onOpenChange])

  const advanceAfterClaim = useCallback(() => {
    setClaimed(true)
  }, [])

  // Claim leg toasts (sequential flow, step 1). useTxToast calls onSuccess both when the
  // claim executes and when it is only queued in Safe. A queued claim has not executed
  // yet, so close the dialog instead of moving on to approve and stake.
  useTxToast(
    {
      successTitle: "Rewards claimed",
      successDescription: `Claimed ${formattedAmount} SAFE. Continue below to stake it.`,
      errorTitle: "Claim failed",
      safeQueuedDescription:
        "Your claim has been sent to Safe Wallet for signing. Once it executes, you can stake the claimed SAFE from the Validators page.",
    },
    {
      isSuccess: isClaimSuccess,
      error: claimError,
      isSafeQueued: isClaimSafeQueued,
      txHash: claimTxHash,
      reset: resetClaim,
      onSuccess: isClaimSafeQueued ? closeAndReset : advanceAfterClaim,
    },
  )

  // Stake leg toasts (sequential flow, final step)
  useTxToast(
    {
      successTitle: "Claim + stake successful",
      successDescription: `Staked ${formattedAmount} SAFE to ${validatorName}`,
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
      successDescription: `Claimed and staked ${formattedAmount} SAFE to ${validatorName}`,
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

  // Until the claim executes, a failure leaves nothing worth keeping. Go back to live values
  // so a retry picks up a new epoch, a changed allowance or batching support.
  useEffect(() => {
    if (!claimed && (claimError || batchError || isBatchReverted)) {
      setFlow(null)
    }
  }, [claimed, claimError, batchError, isBatchReverted])

  // Keep an approval that appeared after the claim in the step count once it confirms.
  useEffect(() => {
    if (claimed && needsApproval) {
      setFlow((f) => (f && !f.withApproval ? { ...f, withApproval: true } : f))
    }
  }, [claimed, needsApproval])

  // The dialog stays mounted and the allowance does not poll, so it can be stale (used up in
  // another tab). Re-read it and the balance after a failure so the next attempt sees real values.
  useInvalidateOnSuccess(isBatchReverted || !!batchError || !!stakeError, RETRY_REFRESH_FN_NAMES, NO_EXTRA_KEYS)

  useEffect(() => {
    if (!open) {
      setFlow(null)
      setClaimed(false)
      resetApprovalFlow()
      resetClaim()
      resetStake()
      resetBatch()
    }
  }, [open, resetApprovalFlow, resetClaim, resetStake, resetBatch])

  const totalSteps = withApproval ? 3 : 2
  const currentStep = !claimed ? 1 : needsApproval ? 2 : totalSteps
  const stepLabel = !claimed ? "Claim rewards" : needsApproval ? "Approve SAFE for staking" : "Stake"

  const actions = [
    { key: "claim", label: `Claim ${formattedAmount} SAFE`, done: claimed },
    ...(withApproval
      ? [{ key: "approve", label: `Approve ${formattedAmount} SAFE for staking`, done: claimed && !needsApproval }]
      : []),
    { key: "stake", label: `Stake ${formattedAmount} SAFE to ${validatorName}`, done: false },
  ]

  function handleConfirm() {
    if (!address || !proof || !proof.proof || !validator) return
    // Capture what the user reviewed, so polling cannot change it mid-flow.
    setFlow({ amount, validator, withApproval, batched: isBatchFlow })
    if (isBatchFlow) {
      batchClaimAndStake(
        address,
        BigInt(proof.cumulativeAmount),
        proof.merkleRoot,
        proof.proof,
        validator,
        amount,
        withApproval,
      )
    } else {
      claimRewards(address, BigInt(proof.cumulativeAmount), proof.merkleRoot, proof.proof)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Claim + Stake</DialogTitle>
          <DialogDescription>
            Claim your accumulated SAFE rewards and stake the full amount to one validator.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex items-center justify-between rounded-lg border p-4">
            <span className="text-sm text-muted-foreground">{claimed ? "Claimed SAFE" : "Claimable SAFE"}</span>
            <span className="text-lg font-semibold">{formattedAmount}</span>
          </div>

          <div className="space-y-1.5">
            <label htmlFor="claim-stake-validator" className="text-sm text-muted-foreground">
              Validator
            </label>
            <select
              id="claim-stake-validator"
              className="flex h-9 w-full rounded-md border border-input/60 bg-card px-3 py-1 text-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 md:text-sm"
              value={validator ?? ""}
              disabled={claimed || isBusy || !validators}
              onChange={(e) => setSelectedValidator(e.target.value as Address)}
            >
              <option value="" disabled>
                {validators ? "Select a validator" : "Loading validators…"}
              </option>
              {(activeValidators ?? []).map((v) => (
                <option key={v.address} value={v.address}>
                  {v.label || truncateAddress(v.address)}
                </option>
              ))}
            </select>
          </div>

          {validator && (
            <div className="space-y-1 rounded-lg border p-4 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Execution</span>
                <span>{isBatchFlow ? "One transaction (batched)" : `${totalSteps} transactions, signed one by one`}</span>
              </div>
              <ol className="space-y-1">
                {actions.map((action, i) => (
                  <li key={action.key} className="flex items-center justify-between gap-2">
                    <span>{i + 1}. {action.label}</span>
                    {action.done && (
                      <span className="flex items-center gap-1 text-success">
                        <CheckCircle className="h-3.5 w-3.5" aria-hidden="true" />
                        Done
                      </span>
                    )}
                  </li>
                ))}
              </ol>
            </div>
          )}

          {!isBatchFlow && gasEstimate && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Fuel className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Estimated gas: ~{parseFloat(gasEstimate).toFixed(6)} ETH</span>
            </div>
          )}

          {!isBatchFlow && (
            <p className="text-xs text-muted-foreground">
              Step {currentStep} of {totalSteps}: {stepLabel}
            </p>
          )}

          {claimed && (
            <p className="text-xs text-muted-foreground">
              The claimed SAFE is now in your wallet. You can also stake it later from the Validators page.
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
                disabled={!canConfirm}
              >
                Claim + Stake
              </TxButton>
            ) : !claimed ? (
              <TxButton
                className="w-full"
                isSigningTx={isClaimSigning}
                isConfirmingTx={isClaimConfirming}
                onClick={handleConfirm}
                disabled={!canConfirm}
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
                onClick={() => validator && stake(validator, amount)}
                disabled={!validator}
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
