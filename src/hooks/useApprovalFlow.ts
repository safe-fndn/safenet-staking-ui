import { useState, useEffect, useCallback } from "react"
import { useTokenAllowance } from "@/hooks/useTokenAllowance"
import { useToast } from "@/hooks/useToast"
import { formatContractError } from "@/lib/errorFormat"

/**
 * Manages the ERC-20 approval flow for the staking contract.
 *
 * Combines token allowance state, approval type selection
 * (exact vs unlimited), and toast notifications into a
 * single hook that DelegateDialog can consume.
 */
export function useApprovalFlow(parsedAmount: bigint) {
  const {
    allowance,
    approve: rawApprove,
    approveUnlimited: rawApproveUnlimited,
    isSigningApproval,
    isConfirmingApproval,
    isApproved,
    isSafeApprovalQueued,
    approvalError,
    approvalTxHash,
    resetApproval,
  } = useTokenAllowance()
  const { toast } = useToast()

  const [approvalType, setApprovalType] = useState<
    "exact" | "unlimited" | null
  >(null)

  const needsApproval =
    allowance !== undefined &&
    parsedAmount > 0n &&
    allowance < parsedAmount

  const isApprovalPending = isSigningApproval || isConfirmingApproval

  // Toast on approval confirmed
  useEffect(() => {
    if (isApproved) {
      toast({
        variant: "success",
        title: "Approval confirmed",
        description: "You can now stake your SAFE tokens",
        txHash: approvalTxHash!,
      })
      setApprovalType(null)
      resetApproval()
    }
  }, [isApproved, resetApproval, toast, approvalTxHash])

  // Toast on approval error
  useEffect(() => {
    if (approvalError) {
      toast({
        variant: "error",
        title: "Approval failed",
        description: formatContractError(approvalError),
      })
      setApprovalType(null)
    }
  }, [approvalError, toast])

  // Toast when approval is queued in Safe wallet
  useEffect(() => {
    if (isSafeApprovalQueued) {
      toast({
        variant: "success",
        title: "Approval queued in Safe",
        description:
          "Once signed and executed in Safe Wallet, " +
          "return here to complete your delegation.",
      })
      resetApproval()
    }
  }, [isSafeApprovalQueued, resetApproval, toast])

  const approveExact = useCallback(() => {
    setApprovalType("exact")
    rawApprove(parsedAmount)
  }, [rawApprove, parsedAmount])

  const approveUnlimited = useCallback(() => {
    setApprovalType("unlimited")
    rawApproveUnlimited()
  }, [rawApproveUnlimited])

  const resetApprovalFlow = useCallback(() => {
    setApprovalType(null)
  }, [])

  return {
    allowance,
    needsApproval,
    approvalType,
    isApprovalPending,
    isSigningApproval,
    isConfirmingApproval,
    approveExact,
    approveUnlimited,
    resetApprovalFlow,
  }
}
