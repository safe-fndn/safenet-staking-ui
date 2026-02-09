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
import { useStake } from "@/hooks/useStakingWrites"
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
  const { data: balance } = useTokenBalance()
  const {
    allowance,
    approve,
    approveUnlimited,
    isSigningApproval,
    isConfirmingApproval,
    isApproved,
    approvalError,
    approvalTxHash,
    resetApproval,
  } = useTokenAllowance()
  const {
    stake,
    isSigningTx,
    isConfirmingTx,
    isSuccess: isStaked,
    error: stakeError,
    reset: resetStake,
    txHash: stakeTxHash,
  } = useStake()
  const { data: withdrawDelay } = useWithdrawDelay()
  const { toast } = useToast()

  const parsedAmount = amount ? parseEther(amount) : 0n
  const needsApproval = allowance !== undefined && parsedAmount > 0n && allowance < parsedAmount
  const balanceValue = balance as bigint | undefined
  const hasZeroBalance = balanceValue !== undefined && balanceValue === 0n
  const insufficientBalance = balanceValue !== undefined && parsedAmount > 0n && parsedAmount > balanceValue
  const canDelegate = parsedAmount > 0n && !needsApproval && balanceValue !== undefined && parsedAmount <= balanceValue
  const isApprovalPending = isSigningApproval || isConfirmingApproval
  const { estimatedCost: gasEstimate } = useGasEstimate("stake", validator, parsedAmount)

  // Stepper logic
  const steps = useMemo(
    () => (needsApproval ? ["Approve", "Delegate", "Done"] : ["Delegate", "Done"]),
    [needsApproval],
  )

  const { currentStep, completedSteps } = useMemo(() => {
    if (isStaked) {
      return { currentStep: steps.length - 1, completedSteps: steps.map((_, i) => i) }
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
  }, [needsApproval, isSigningApproval, isConfirmingApproval, isSigningTx, isConfirmingTx, isStaked, steps])

  useEffect(() => {
    if (isApproved) {
      toast({ variant: "success", title: "Approval confirmed", description: "You can now delegate your SAFE tokens", txHash: approvalTxHash! })
      resetApproval()
    }
  }, [isApproved, resetApproval, toast, approvalTxHash])

  useEffect(() => {
    if (approvalError) {
      toast({ variant: "error", title: "Approval failed", description: formatContractError(approvalError) })
    }
  }, [approvalError, toast])

  useEffect(() => {
    if (isStaked) {
      toast({ variant: "success", title: "Delegation successful", description: `Delegated ${amount} SAFE to ${truncateAddress(validator)}`, txHash: stakeTxHash! })
      setAmount("")
      resetStake()
      onOpenChange(false)
    }
  }, [isStaked, resetStake, onOpenChange, toast, amount, validator, stakeTxHash])

  useEffect(() => {
    if (stakeError) {
      toast({ variant: "error", title: "Delegation failed", description: formatContractError(stakeError) })
    }
  }, [stakeError, toast])

  useEffect(() => {
    if (!open) {
      setAmount("")
      resetStake()
    }
  }, [open, resetStake])

  const showStepper = parsedAmount > 0n && (needsApproval || isSigningTx || isConfirmingTx)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delegate SAFE</DialogTitle>
          <DialogDescription>
            Delegate tokens toward validator {truncateAddress(validator)}
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
            You do not have enough SAFE to delegate.
          </p>
        )}

        {insufficientBalance && !hasZeroBalance && (
          <p className="text-sm text-destructive">
            You do not have enough SAFE to delegate this amount.
          </p>
        )}

        {gasEstimate && (
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
          {needsApproval ? (
            <>
              <Button onClick={() => approve(parsedAmount)} disabled={isApprovalPending || parsedAmount === 0n}>
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
              <Button variant="outline" onClick={approveUnlimited} disabled={isApprovalPending || parsedAmount === 0n}>
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
                "Delegate"
              )}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
