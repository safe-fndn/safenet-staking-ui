import { useState, useEffect } from "react"
import { parseEther, type Address } from "viem"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { AmountInput } from "./AmountInput"
import { useTokenBalance } from "@/hooks/useTokenBalance"
import { useTokenAllowance } from "@/hooks/useTokenAllowance"
import { useStake } from "@/hooks/useStakingWrites"
import { useWithdrawDelay } from "@/hooks/useStakingReads"
import { useToast } from "@/hooks/useToast"
import { truncateAddress, formatCountdown } from "@/lib/format"
import { formatContractError } from "@/lib/errorFormat"
import { Loader2, Info } from "lucide-react"

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

  // After approval confirmed, show toast and reset
  useEffect(() => {
    if (isApproved) {
      toast({ variant: "success", title: "Approval confirmed", description: "You can now delegate your SAFE tokens", txHash: approvalTxHash! })
      resetApproval()
    }
  }, [isApproved, resetApproval, toast, approvalTxHash])

  // Approval error toast
  useEffect(() => {
    if (approvalError) {
      toast({ variant: "error", title: "Approval failed", description: formatContractError(approvalError) })
    }
  }, [approvalError, toast])

  // After delegation confirmed, close dialog
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

  // Reset form state on close
  useEffect(() => {
    if (!open) {
      setAmount("")
      resetStake()
    }
  }, [open, resetStake])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delegate SAFE</DialogTitle>
          <DialogDescription>
            Delegate tokens toward validator {truncateAddress(validator)}
          </DialogDescription>
        </DialogHeader>

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

        {withdrawDelay !== undefined && (
          <div className="flex items-center gap-2 rounded-md bg-muted px-3 py-2 text-sm text-muted-foreground">
            <Info className="h-4 w-4 shrink-0" />
            <span>Unbonding period: {formatCountdown(Number(withdrawDelay))}</span>
          </div>
        )}

        <div className="flex flex-col gap-2">
          {needsApproval ? (
            <>
              <Button onClick={() => approve(parsedAmount)} disabled={isApprovalPending || parsedAmount === 0n}>
                {isSigningApproval ? (
                  <>
                    <Loader2 className="animate-spin" />
                    Confirm Approval in Wallet...
                  </>
                ) : isConfirmingApproval ? (
                  <>
                    <Loader2 className="animate-spin" />
                    Approval confirming...
                  </>
                ) : (
                  "Approve exact amount"
                )}
              </Button>
              <Button variant="outline" onClick={approveUnlimited} disabled={isApprovalPending || parsedAmount === 0n}>
                {isSigningApproval ? (
                  <>
                    <Loader2 className="animate-spin" />
                    Confirm Approval in Wallet...
                  </>
                ) : isConfirmingApproval ? (
                  <>
                    <Loader2 className="animate-spin" />
                    Approval confirming...
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
                  <Loader2 className="animate-spin" />
                  Confirm in Wallet...
                </>
              ) : isConfirmingTx ? (
                <>
                  <Loader2 className="animate-spin" />
                  Confirming on chain...
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
