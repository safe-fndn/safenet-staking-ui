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
  const { data: balance, refetch: refetchBalance } = useTokenBalance()
  const { allowance, approve, isApproving, isApproved, refetchAllowance, resetApproval } = useTokenAllowance()
  const { stake, isPending: isStaking, isSuccess: isStaked, error: stakeError, reset: resetStake, txHash: stakeTxHash } = useStake()
  const { data: withdrawDelay } = useWithdrawDelay()
  const { toast } = useToast()

  const parsedAmount = amount ? parseEther(amount) : 0n
  const needsApproval = allowance !== undefined && parsedAmount > 0n && allowance < parsedAmount
  const balanceValue = balance as bigint | undefined
  const hasZeroBalance = balanceValue !== undefined && balanceValue === 0n
  const insufficientBalance = balanceValue !== undefined && parsedAmount > 0n && parsedAmount > balanceValue
  const canDelegate = parsedAmount > 0n && !needsApproval && balanceValue !== undefined && parsedAmount <= balanceValue

  // After approval confirmed, refetch allowance
  useEffect(() => {
    if (isApproved) {
      refetchAllowance()
      resetApproval()
    }
  }, [isApproved, refetchAllowance, resetApproval])

  // After delegation confirmed, close dialog
  useEffect(() => {
    if (isStaked) {
      toast({ variant: "success", title: "Delegation successful", description: `Delegated ${amount} SAFE to ${truncateAddress(validator)}`, txHash: stakeTxHash! })
      refetchBalance()
      refetchAllowance()
      setAmount("")
      resetStake()
      onOpenChange(false)
    }
  }, [isStaked, refetchBalance, refetchAllowance, resetStake, onOpenChange, toast, amount, validator, stakeTxHash])

  useEffect(() => {
    if (stakeError) {
      toast({ variant: "error", title: "Delegation failed", description: formatContractError(stakeError) })
    }
  }, [stakeError, toast])

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
            <Button onClick={() => approve(parsedAmount)} disabled={isApproving || parsedAmount === 0n}>
              {isApproving ? (
                <>
                  <Loader2 className="animate-spin" />
                  Approving...
                </>
              ) : (
                "Approve SAFE"
              )}
            </Button>
          ) : (
            <Button onClick={() => stake(validator, parsedAmount)} disabled={!canDelegate || isStaking}>
              {isStaking ? (
                <>
                  <Loader2 className="animate-spin" />
                  Delegating...
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
