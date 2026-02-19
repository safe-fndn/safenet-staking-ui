import { useState, useEffect, useMemo } from "react"
import { parseEther, type Address } from "viem"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Stepper } from "@/components/ui/stepper"
import { AmountInput } from "./AmountInput"
import { useTokenBalance } from "@/hooks/useTokenBalance"
import { useTokenAllowance } from "@/hooks/useTokenAllowance"
import { useStake, useBatchStake } from "@/hooks/useStakingWrites"
import { useWithdrawDelay } from "@/hooks/useStakingReads"
import { useToast } from "@/hooks/useToast"
import { truncateAddress, formatCountdown } from "@/lib/format"
import { formatContractError } from "@/lib/errorFormat"
import { useGasEstimate } from "@/hooks/useGasEstimate"
import Loader2 from "lucide-react/dist/esm/icons/loader-2"
import Info from "lucide-react/dist/esm/icons/info"
import Fuel from "lucide-react/dist/esm/icons/fuel"

interface DelegateDialogProps {
  validator: Address
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function DelegateDialog({ validator, open, onOpenChange }: DelegateDialogProps) {
  const [amount, setAmount] = useState("")
  const [approvalType, setApprovalType] = useState<"exact" | "unlimited" | null>(null)
  const { data: balance } = useTokenBalance()
  const {
    allowance,
    approve,
    approveUnlimited,
    isSigningApproval,
    isConfirmingApproval,
    isApproved,
    isSafeApprovalQueued,
    approvalError,
    approvalTxHash,
    resetApproval,
  } = useTokenAllowance()
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

  let parsedAmount = 0n
  try { if (amount) parsedAmount = parseEther(amount) } catch { /* invalid input */ }
  const needsApproval = allowance !== undefined && parsedAmount > 0n && allowance < parsedAmount
  const balanceValue = balance as bigint | undefined
  const hasZeroBalance = balanceValue !== undefined && balanceValue === 0n
  const insufficientBalance = balanceValue !== undefined && parsedAmount > 0n && parsedAmount > balanceValue
  const canDelegate = parsedAmount > 0n && !needsApproval && balanceValue !== undefined && parsedAmount <= balanceValue
  const isApprovalPending = isSigningApproval || isConfirmingApproval
  const { estimatedCost: gasEstimate } = useGasEstimate("stake", validator, parsedAmount)

  const isBatchFlow = supportsBatching && needsApproval

  // Stepper logic
  const steps = useMemo(
    () => {
      if (isBatchFlow) return ["Delegate", "Done"]
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
      if (isBatchSigning || isBatchConfirming) {
        return { currentStep: 0, completedSteps: [] as number[] }
      }
      return { currentStep: 0, completedSteps: [] as number[] }
    }
    if (needsApproval) {
      if (isSigningApproval || isConfirmingApproval) {
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
  }, [needsApproval, isBatchFlow, isSigningApproval, isConfirmingApproval, isSigningTx, isConfirmingTx, isStaked, isBatchSuccess, isBatchSigning, isBatchConfirming, steps])

  useEffect(() => {
    if (isApproved) {
      toast({ variant: "success", title: "Approval confirmed", description: "You can now stake your SAFE tokens", txHash: approvalTxHash! })
      setApprovalType(null)
      resetApproval()
    }
  }, [isApproved, resetApproval, toast, approvalTxHash])

  useEffect(() => {
    if (approvalError) {
      toast({ variant: "error", title: "Approval failed", description: formatContractError(approvalError) })
      setApprovalType(null)
    }
  }, [approvalError, toast])

  useEffect(() => {
    if (isStaked) {
      toast({ variant: "success", title: "Staking successful", description: `Staked ${amount} SAFE to ${truncateAddress(validator)}`, txHash: stakeTxHash! })
      setAmount("")
      resetStake()
      onOpenChange(false)
    }
  }, [isStaked, resetStake, onOpenChange, toast, amount, validator, stakeTxHash])

  useEffect(() => {
    if (stakeError) {
      toast({ variant: "error", title: "Staking failed", description: formatContractError(stakeError) })
    }
  }, [stakeError, toast])

  useEffect(() => {
    if (isStakeSafeQueued) {
      toast({
        variant: "success",
        title: "Transaction queued in Safe",
        description: "Your delegation has been sent to Safe Wallet for signing.",
      })
      setAmount("")
      resetStake()
      onOpenChange(false)
    }
  }, [isStakeSafeQueued, resetStake, onOpenChange, toast])

  useEffect(() => {
    if (isSafeApprovalQueued) {
      toast({
        variant: "success",
        title: "Approval queued in Safe",
        description: "Once signed and executed in Safe Wallet, return here to complete your delegation.",
      })
      resetApproval()
    }
  }, [isSafeApprovalQueued, resetApproval, toast])

  useEffect(() => {
    if (isBatchSuccess) {
      toast({ variant: "success", title: "Delegation successful", description: `Approved and staked ${amount} SAFE to ${truncateAddress(validator)}`, txHash: batchTxHash })
      setAmount("")
      resetBatch()
      onOpenChange(false)
    }
  }, [isBatchSuccess, resetBatch, onOpenChange, toast, amount, validator, batchTxHash])

  useEffect(() => {
    if (batchError) {
      toast({ variant: "error", title: "Delegation failed", description: formatContractError(batchError) })
    }
  }, [batchError, toast])

  useEffect(() => {
    if (isBatchReverted) {
      toast({ variant: "error", title: "Transaction reverted", description: "The batch transaction was reverted on-chain" })
      resetBatch()
    }
  }, [isBatchReverted, resetBatch, toast])

  useEffect(() => {
    if (!open) {
      setAmount("")
      setApprovalType(null)
      resetStake()
      resetBatch()
    }
  }, [open, resetStake, resetBatch])

  const showStepper = parsedAmount > 0n && (needsApproval || isSigningTx || isConfirmingTx || isBatchSigning || isBatchConfirming)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Stake SAFE</DialogTitle>
          <DialogDescription>
            Stake tokens toward validator {truncateAddress(validator)}
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
            <Info className="h-4 w-4 shrink-0" aria-hidden="true" />
            <span>Unbonding period: {formatCountdown(Number(withdrawDelay))}</span>
          </div>
        )}

        <div className="flex flex-col gap-2">
          {isBatchFlow ? (
            <Button
              onClick={() => batchApproveAndStake(validator, parsedAmount)}
              disabled={parsedAmount === 0n || insufficientBalance || isBatchSigning || isBatchConfirming}
            >
              {isBatchSigning ? (
                <>
                  <Loader2 className="animate-spin" aria-hidden="true" />
                  Confirm in Safe…
                </>
              ) : isBatchConfirming ? (
                <>
                  <Loader2 className="animate-spin" aria-hidden="true" />
                  Confirming on chain…
                </>
              ) : (
                "Delegate"
              )}
            </Button>
          ) : needsApproval ? (
            <>
              {approvalType !== "unlimited" && (
                <Button onClick={() => { setApprovalType("exact"); approve(parsedAmount) }} disabled={isApprovalPending || parsedAmount === 0n}>
                  {isSigningApproval ? (
                    <>
                      <Loader2 className="animate-spin" aria-hidden="true" />
                      Confirm Approval in Wallet…
                    </>
                  ) : isConfirmingApproval ? (
                    <>
                      <Loader2 className="animate-spin" aria-hidden="true" />
                      Approval confirming…
                    </>
                  ) : (
                    "Approve exact amount"
                  )}
                </Button>
              )}
              {approvalType !== "exact" && (
                <Button variant="outline" onClick={() => { setApprovalType("unlimited"); approveUnlimited() }} disabled={isApprovalPending || parsedAmount === 0n}>
                  {isSigningApproval ? (
                    <>
                      <Loader2 className="animate-spin" aria-hidden="true" />
                      Confirm Approval in Wallet…
                    </>
                  ) : isConfirmingApproval ? (
                    <>
                      <Loader2 className="animate-spin" aria-hidden="true" />
                      Approval confirming…
                    </>
                  ) : (
                    "Approve unlimited"
                  )}
                </Button>
              )}
            </>
          ) : (
            <Button onClick={() => stake(validator, parsedAmount)} disabled={!canDelegate || isSigningTx || isConfirmingTx}>
              {isSigningTx ? (
                <>
                  <Loader2 className="animate-spin" aria-hidden="true" />
                  Confirm in Wallet…
                </>
              ) : isConfirmingTx ? (
                <>
                  <Loader2 className="animate-spin" aria-hidden="true" />
                  Confirming on chain…
                </>
              ) : (
                "Stake"
              )}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
