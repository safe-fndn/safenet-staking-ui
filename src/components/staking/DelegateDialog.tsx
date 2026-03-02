import { useState, useEffect, useMemo, useCallback } from "react"
import { type Address } from "viem"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import { TxButton } from "@/components/ui/TxButton"
import { Stepper } from "@/components/ui/stepper"
import { AmountInput } from "./AmountInput"
import { useTokenBalance } from "@/hooks/useTokenBalance"
import { useApprovalFlow } from "@/hooks/useApprovalFlow"
import { useStake, useBatchStake } from "@/hooks/useStakingWrites"
import { useWithdrawDelay } from "@/hooks/useStakingReads"
import { useToast } from "@/hooks/useToast"
import { useTxToast } from "@/hooks/useTxToast"
import { truncateAddress, formatCountdown, safeParseEther } from "@/lib/format"
import { useGasEstimate } from "@/hooks/useGasEstimate"
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip"
import Info from "lucide-react/dist/esm/icons/info"
import Fuel from "lucide-react/dist/esm/icons/fuel"

interface DelegateDialogProps {
  validator: Address
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function DelegateDialog({ validator, open, onOpenChange }: DelegateDialogProps) {
  const [amount, setAmount] = useState("")
  const { data: balance } = useTokenBalance()

  const parsedAmount = safeParseEther(amount)

  const {
    needsApproval,
    approvalType,
    isApprovalPending,
    isSigningApproval,
    isConfirmingApproval,
    approveExact,
    approveUnlimited,
    resetApprovalFlow,
  } = useApprovalFlow(parsedAmount)

  const {
    stake,
    isSigningTx,
    isConfirmingTx,
    isSuccess: isStaked,
    isSafeQueued: isStakeSafeQueued,
    error: stakeError,
    reset: resetStake,
    txHash: stakeTxHash,
  } = useStake()
  const {
    batchApproveAndStake,
    supportsBatching,
    isSigningTx: isBatchSigning,
    isConfirmingTx: isBatchConfirming,
    isSuccess: isBatchSuccess,
    isReverted: isBatchReverted,
    error: batchError,
    reset: resetBatch,
    txHash: batchTxHash,
  } = useBatchStake()
  const { data: withdrawDelay } = useWithdrawDelay()
  const { toast } = useToast()

  const balanceValue = typeof balance === "bigint" ? balance : undefined
  const hasZeroBalance = balanceValue !== undefined && balanceValue === 0n
  const insufficientBalance = balanceValue !== undefined && parsedAmount > 0n && parsedAmount > balanceValue
  const canDelegate = parsedAmount > 0n && !needsApproval && balanceValue !== undefined && parsedAmount <= balanceValue
  const { estimatedCost: gasEstimate } = useGasEstimate("stake", validator, parsedAmount)

  const isBatchFlow = supportsBatching && needsApproval

  // Stepper logic
  const steps = useMemo(
    () => {
      if (isBatchFlow) return ["Stake", "Done"]
      if (needsApproval) return ["Approve", "Stake", "Done"]
      return ["Stake", "Done"]
    },
    [needsApproval, isBatchFlow],
  )

  const { currentStep, completedSteps } = useMemo(() => {
    if (isStaked || isBatchSuccess) {
      return { currentStep: steps.length - 1, completedSteps: steps.map((_, i) => i) }
    }
    if (isBatchFlow) {
      return { currentStep: 0, completedSteps: [] as number[] }
    }
    if (needsApproval) {
      if (isApprovalPending) {
        return { currentStep: 0, completedSteps: [] as number[] }
      }
      if (isSigningTx || isConfirmingTx) {
        return { currentStep: 1, completedSteps: [0] }
      }
      return { currentStep: 0, completedSteps: [] as number[] }
    }
    if (isSigningTx || isConfirmingTx) {
      return { currentStep: 0, completedSteps: [] as number[] }
    }
    return { currentStep: 0, completedSteps: [] as number[] }
  }, [needsApproval, isBatchFlow, isApprovalPending, isSigningTx, isConfirmingTx, isStaked, isBatchSuccess, steps])

  const closeAndClearAmount = useCallback(() => {
    setAmount("")
    onOpenChange(false)
  }, [onOpenChange])

  // Stake transaction toasts
  useTxToast(
    {
      successTitle: "Staking successful",
      successDescription: `Staked ${amount} SAFE to ${truncateAddress(validator)}`,
      errorTitle: "Staking failed",
      safeQueuedDescription: "Your delegation has been sent to Safe Wallet for signing.",
    },
    {
      isSuccess: isStaked,
      error: stakeError,
      isSafeQueued: isStakeSafeQueued,
      txHash: stakeTxHash,
      reset: resetStake,
      onSuccess: closeAndClearAmount,
    },
  )

  // Batch transaction toasts
  useTxToast(
    {
      successTitle: "Delegation successful",
      successDescription: `Approved and staked ${amount} SAFE to ${truncateAddress(validator)}`,
      errorTitle: "Delegation failed",
    },
    {
      isSuccess: isBatchSuccess,
      error: batchError,
      isSafeQueued: false,
      txHash: batchTxHash,
      reset: resetBatch,
      onSuccess: closeAndClearAmount,
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
      setAmount("")
      resetApprovalFlow()
      resetStake()
      resetBatch()
    }
  }, [open, resetApprovalFlow, resetStake, resetBatch])

  const showStepper = parsedAmount > 0n && (needsApproval || isSigningTx || isConfirmingTx || isBatchSigning || isBatchConfirming)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Stake SAFE</DialogTitle>
          <DialogDescription>
            Stake tokens to validator {truncateAddress(validator)}
          </DialogDescription>
        </DialogHeader>

        {showStepper && (
          <Stepper steps={steps} currentStep={currentStep} completedSteps={completedSteps} />
        )}

        <AmountInput
          value={amount}
          onChange={setAmount}
          maxAmount={balanceValue}
          disabled={hasZeroBalance}
        />

        {hasZeroBalance && (
          <p className="text-sm text-destructive">
            You do not have enough SAFE to stake.
          </p>
        )}

        {insufficientBalance && !hasZeroBalance && (
          <p className="text-sm text-destructive">
            You do not have enough SAFE to stake this amount.
          </p>
        )}

        {!isBatchFlow && gasEstimate && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Fuel className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Estimated gas: ~{parseFloat(gasEstimate).toFixed(6)} ETH</span>
          </div>
        )}

        {withdrawDelay !== undefined && (
          <div className="flex items-center gap-2 rounded-md bg-muted px-3 py-2 text-sm text-muted-foreground">
            <Tooltip>
              <TooltipTrigger asChild>
                <button type="button" className="shrink-0" aria-label="Unstaking period info">
                  <Info className="h-4 w-4" aria-hidden="true" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="top" className="max-w-xs text-xs">
                <p>If you undelegate, your tokens will be locked during the unstaking period and will not earn rewards.</p>
                <p className="mt-1">After the period ends, you must manually claim them from the Withdrawals page.</p>
              </TooltipContent>
            </Tooltip>
            <span>Unstaking period: {formatCountdown(Number(withdrawDelay))}</span>
          </div>
        )}

        <div className="flex flex-col gap-2">
          {isBatchFlow ? (
            <TxButton
              isSigningTx={isBatchSigning}
              isConfirmingTx={isBatchConfirming}
              signingLabel="Confirm in Safe…"
              onClick={() => batchApproveAndStake(validator, parsedAmount)}
              disabled={parsedAmount === 0n || insufficientBalance}
            >
              Stake
            </TxButton>
          ) : needsApproval ? (
            <>
              {approvalType !== "unlimited" && (
                <TxButton
                  isSigningTx={isSigningApproval && approvalType === "exact"}
                  isConfirmingTx={isConfirmingApproval && approvalType === "exact"}
                  signingLabel="Confirm Approval in Wallet…"
                  confirmingLabel="Approval confirming…"
                  onClick={approveExact}
                  disabled={isApprovalPending || parsedAmount === 0n}
                >
                  Approve exact amount
                </TxButton>
              )}
              {approvalType !== "exact" && (
                <TxButton
                  variant="outline"
                  isSigningTx={isSigningApproval && approvalType === "unlimited"}
                  isConfirmingTx={isConfirmingApproval && approvalType === "unlimited"}
                  signingLabel="Confirm Approval in Wallet…"
                  confirmingLabel="Approval confirming…"
                  onClick={approveUnlimited}
                  disabled={isApprovalPending || parsedAmount === 0n}
                >
                  Approve unlimited
                </TxButton>
              )}
            </>
          ) : (
            <TxButton
              isSigningTx={isSigningTx}
              isConfirmingTx={isConfirmingTx}
              onClick={() => stake(validator, parsedAmount)}
              disabled={!canDelegate}
            >
              Stake
            </TxButton>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
