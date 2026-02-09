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
import { useUserStakeOnValidator, useWithdrawDelay } from "@/hooks/useStakingReads"
import { useInitiateWithdrawal } from "@/hooks/useStakingWrites"
import { useToast } from "@/hooks/useToast"
import { truncateAddress, formatCountdown } from "@/lib/format"
import { formatContractError } from "@/lib/errorFormat"
import { Loader2, Info } from "lucide-react"

interface UndelegateDialogProps {
  validator: Address
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function UndelegateDialog({ validator, open, onOpenChange }: UndelegateDialogProps) {
  const [amount, setAmount] = useState("")
  const { data: userStake, refetch } = useUserStakeOnValidator(validator)
  const { initiateWithdrawal, isPending, isSuccess, error, reset, txHash } = useInitiateWithdrawal()
  const { data: withdrawDelay } = useWithdrawDelay()
  const { toast } = useToast()

  const parsedAmount = amount ? parseEther(amount) : 0n
  const canUndelegate = parsedAmount > 0n && userStake !== undefined && parsedAmount <= (userStake as bigint)

  useEffect(() => {
    if (isSuccess) {
      toast({ variant: "success", title: "Undelegation initiated", description: `Queued withdrawal of ${amount} SAFE from ${truncateAddress(validator)}`, txHash: txHash! })
      refetch()
      setAmount("")
      reset()
      onOpenChange(false)
    }
  }, [isSuccess, refetch, reset, onOpenChange, toast, amount, validator, txHash])

  useEffect(() => {
    if (error) {
      toast({ variant: "error", title: "Undelegation failed", description: formatContractError(error) })
    }
  }, [error, toast])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Undelegate SAFE</DialogTitle>
          <DialogDescription>
            Initiate withdrawal from validator {truncateAddress(validator)}. Tokens enter a withdrawal queue with a time delay before they can be claimed.
          </DialogDescription>
        </DialogHeader>

        <AmountInput
          value={amount}
          onChange={setAmount}
          maxAmount={userStake as bigint | undefined}
          label="Undelegate Amount"
        />

        {withdrawDelay !== undefined && (
          <div className="flex items-center gap-2 rounded-md bg-muted px-3 py-2 text-sm text-muted-foreground">
            <Info className="h-4 w-4 shrink-0" />
            <span>Unbonding period: {formatCountdown(Number(withdrawDelay))}. Tokens will be claimable after this period.</span>
          </div>
        )}

        <Button onClick={() => initiateWithdrawal(validator, parsedAmount)} disabled={!canUndelegate || isPending}>
          {isPending ? (
            <>
              <Loader2 className="animate-spin" />
              Processing...
            </>
          ) : (
            "Initiate Withdrawal"
          )}
        </Button>
      </DialogContent>
    </Dialog>
  )
}
