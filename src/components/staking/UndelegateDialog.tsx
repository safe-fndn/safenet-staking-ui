import { useState, useEffect, useCallback } from "react"
import { parseEther, type Address } from "viem"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import { TxButton } from "@/components/ui/TxButton"
import { AmountInput } from "./AmountInput"
import { useUserStakeOnValidator, useWithdrawDelay } from "@/hooks/useStakingReads"
import { useInitiateWithdrawal } from "@/hooks/useStakingWrites"
import { useTxToast } from "@/hooks/useTxToast"
import { truncateAddress, formatCountdown } from "@/lib/format"
import { useGasEstimate } from "@/hooks/useGasEstimate"
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip"
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
  const { initiateWithdrawal, isSigningTx, isConfirmingTx, isSuccess, isSafeQueued, error, reset, txHash } = useInitiateWithdrawal()
  const { data: withdrawDelay } = useWithdrawDelay()

  let parsedAmount = 0n
  try { if (amount) parsedAmount = parseEther(amount) } catch { /* invalid input */ }
  const userStakeValue = typeof userStake === "bigint" ? userStake : undefined
  const canUndelegate = parsedAmount > 0n && userStakeValue !== undefined && parsedAmount <= userStakeValue
  const { estimatedCost: gasEstimate } = useGasEstimate("initiateWithdrawal", validator, parsedAmount)

  const closeAndClearAmount = useCallback(() => {
    setAmount("")
    onOpenChange(false)
  }, [onOpenChange])

  useTxToast(
    {
      successTitle: "Unstaking initiated",
      successDescription: `Queued withdrawal of ${amount} SAFE from ${truncateAddress(validator)}`,
      errorTitle: "Unstaking failed",
      safeQueuedDescription: "Your withdrawal request has been sent to Safe Wallet for signing.",
    },
    {
      isSuccess,
      error,
      isSafeQueued,
      txHash,
      reset,
      onSuccess: closeAndClearAmount,
    },
  )

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
          <DialogTitle>Unstake SAFE</DialogTitle>
          <DialogDescription>
            Initiate withdrawal from validator {truncateAddress(validator)}. Tokens enter a withdrawal queue with a time delay before they can be claimed.
          </DialogDescription>
        </DialogHeader>

        <AmountInput
          value={amount}
          onChange={setAmount}
          maxAmount={userStakeValue}
          label="Unstake Amount"
        />

        {gasEstimate && (
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
                <p>During the unstaking period, your tokens are locked and do not earn rewards.</p>
                <p className="mt-1">After the period ends, you must manually claim them from the Withdrawals page.</p>
              </TooltipContent>
            </Tooltip>
            <span>Unstaking period: {formatCountdown(Number(withdrawDelay))}. Tokens will be claimable after this period.</span>
          </div>
        )}

        <TxButton
          isSigningTx={isSigningTx}
          isConfirmingTx={isConfirmingTx}
          onClick={() => initiateWithdrawal(validator, parsedAmount)}
          disabled={!canUndelegate}
        >
          Initiate Withdrawal
        </TxButton>
      </DialogContent>
    </Dialog>
  )
}
