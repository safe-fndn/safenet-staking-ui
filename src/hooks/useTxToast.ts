import { useEffect } from "react"
import { useToast } from "@/hooks/useToast"
import { formatContractError } from "@/lib/errorFormat"

interface TxToastOptions {
  /** Title shown when the transaction succeeds on-chain. */
  successTitle: string
  /** Description shown when the transaction succeeds on-chain. */
  successDescription: string
  /** Title shown when the transaction fails. */
  errorTitle: string
  /** Title shown when a Safe multisig transaction is queued. */
  safeQueuedTitle?: string
  /** Description shown when a Safe multisig transaction is queued. */
  safeQueuedDescription?: string
}

interface TxToastState {
  /** Whether the transaction confirmed on-chain. */
  isSuccess: boolean
  /** Transaction error, if any. */
  error: Error | null
  /** Whether the tx was queued in a Safe multisig wallet. */
  isSafeQueued: boolean
  /** The on-chain transaction hash (for success toasts). */
  txHash?: string
  /** Reset function to call after success/safeQueued. */
  reset: () => void
  /** Callback invoked after success or safeQueued (e.g. close dialog). */
  onSuccess?: () => void
}

/**
 * Shows toasts for transaction success, error, and Safe queued states.
 * Calls `reset` and `onSuccess` after success or safeQueued.
 */
export function useTxToast(
  options: TxToastOptions,
  state: TxToastState,
) {
  const { toast } = useToast()
  const {
    isSuccess,
    error,
    isSafeQueued,
    txHash,
    reset,
    onSuccess,
  } = state

  useEffect(() => {
    if (isSuccess) {
      toast({
        variant: "success",
        title: options.successTitle,
        description: options.successDescription,
        txHash,
      })
      reset()
      onSuccess?.()
    }
  }, [
    isSuccess,
    toast,
    options.successTitle,
    options.successDescription,
    txHash,
    reset,
    onSuccess,
  ])

  useEffect(() => {
    if (error) {
      toast({
        variant: "error",
        title: options.errorTitle,
        description: formatContractError(error),
      })
    }
  }, [error, toast, options.errorTitle])

  useEffect(() => {
    if (isSafeQueued) {
      toast({
        variant: "success",
        title: options.safeQueuedTitle ?? "Transaction queued in Safe",
        description:
          options.safeQueuedDescription ??
          "Your transaction has been sent to Safe Wallet for signing.",
      })
      reset()
      onSuccess?.()
    }
  }, [
    isSafeQueued,
    toast,
    options.safeQueuedTitle,
    options.safeQueuedDescription,
    reset,
    onSuccess,
  ])
}
