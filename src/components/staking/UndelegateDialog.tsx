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
import { useGasEstimate } from "@/hooks/useGasEstimate"
import Loader2 from "lucide-react/dist/esm/icons/loader-2"
import Info from "lucide-react/dist/esm/icons/info"
import Fuel from "lucide-react/dist/esm/icons/fuel"

interface UndelegateDialogProps {
  validator: Address
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function UndelegateDialog({ validator, open, onOpenChange }: UndelegateDialogProps) {
  const [amount, setAmount] = useState("")
  const { data: userStake } = useUserStakeOnValidator(validator)
  const { initiateWithdrawal, isSigningTx, isConfirmingTx, isSuccess, error, reset, txHash } = useInitiateWithdrawal()
  const { data: withdrawDelay } = useWithdrawDelay()
  const { toast } = useToast()

  const parsedAmount = amount ? parseEther(amount) : 0n
  const canUndelegate = parsedAmount > 0n && userStake !== undefined && parsedAmount <= (userStake as bigint)
  const { estimatedCost: gasEstimate } = useGasEstimate("initiateWithdrawal", validator, parsedAmount)

  useEffect(() => {
    if (isSuccess) {
      toast({ variant: "success", title: "Undelegation initiated", description: `Queued withdrawal of ${amount} SAFE from ${truncateAddress(validator)}`, txHash: txHash! })
      setAmount("")
      reset()
      onOpenChange(false)
    }
  }, [isSuccess, reset, onOpenChange, toast, amount, validator, txHash])

  useEffect(() => {
    if (error) {
      toast({ variant: "error", title: "Undelegation failed", description: formatContractError(error) })
    }
  }, [error, toast])

  // Reset form state on close
  useEffect(() => {
    if (!open) {
      setAmount("")
      reset()
    }
  }, [open, reset])

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

        {gasEstimate && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Fuel className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Estimated gas: ~{parseFloat(gasEstimate).toFixed(6)} ETH</span>
          </div>
        )}

        {withdrawDelay !== undefined && (
          <div className="flex items-center gap-2 rounded-md bg-muted px-3 py-2 text-sm text-muted-foreground">
            <Info className="h-4 w-4 shrink-0" aria-hidden="true" />
            <span>Unbonding period: {formatCountdown(Number(withdrawDelay))}. Tokens will be claimable after this period.</span>
          </div>
        )}

        <Button onClick={() => initiateWithdrawal(validator, parsedAmount)} disabled={!canUndelegate || isSigningTx || isConfirmingTx}>
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
            "Initiate Withdrawal"
          )}
        </Button>
      </DialogContent>
    </Dialog>
  )
}
