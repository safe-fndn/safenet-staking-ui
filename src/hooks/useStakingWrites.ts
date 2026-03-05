import { useEffect } from "react"
import { useWriteContract, useWaitForTransactionReceipt, useSendCalls, useCallsStatus, useCapabilities } from "wagmi"
import { encodeFunctionData, type Address } from "viem"
import { stakingAbi } from "@/abi/stakingAbi"
import { erc20Abi } from "@/abi/erc20Abi"
import { getContractAddresses } from "@/config/contracts"
import { activeChain } from "@/config/chains"
import { queryClient } from "@/config/queryClient"
import { isSafeApp } from "@/lib/safe"

const addresses = getContractAddresses(activeChain.id)

/**
 * Invalidate readContract/readContracts queries matching
 * specific function names, plus any extra custom query keys.
 */
export function useInvalidateOnSuccess(
  isSuccess: boolean,
  functionNames: string[],
  extraKeys: string[][] = [],
) {
  useEffect(() => {
    if (!isSuccess) return

    queryClient.invalidateQueries({
      predicate: (query) => {
        const key = query.queryKey
        if (key[0] === "readContract") {
          const opts = key[1] as
            | Record<string, unknown>
            | undefined
          return functionNames.includes(
            opts?.functionName as string,
          )
        }
        if (key[0] === "readContracts") {
          const opts = key[1] as
            | { contracts?: { functionName?: string }[] }
            | undefined
          return (
            opts?.contracts?.some((c) =>
              functionNames.includes(c.functionName ?? ""),
            ) ?? false
          )
        }
        return false
      },
    })

    for (const key of extraKeys) {
      queryClient.invalidateQueries({ queryKey: key })
    }
  }, [isSuccess, functionNames, extraKeys])
}

/** Contract function names to invalidate after any staking transaction. */
const STAKING_FN_NAMES = [
  "totalStakedAmount",
  "totalStakerStakes",
  "stakes",
  "totalValidatorStakes",
  "totalPendingWithdrawals",
  "getPendingWithdrawals",
  "getNextClaimableWithdrawal",
  "balanceOf",
  "allowance",
]

const STAKING_EXTRA_KEYS = [["validators"]]

export function useStake() {
  const { writeContract, data: txHash, isPending, isSuccess: isSubmitted, reset, error: writeError } = useWriteContract()
  const { isLoading: isConfirming, isSuccess, error: receiptError } = useWaitForTransactionReceipt({ hash: txHash })
  const error = writeError ?? receiptError

  // When running as a Safe App, writeContract resolves with a Safe tx hash (not an
  // on-chain hash). useWaitForTransactionReceipt never resolves, so detect the
  // "queued in Safe" state via useWriteContract's own isSuccess.
  const isSafeQueued = isSafeApp && isSubmitted && !isSuccess

  useInvalidateOnSuccess(isSuccess, STAKING_FN_NAMES, STAKING_EXTRA_KEYS)

  function stake(validator: Address, amount: bigint) {
    writeContract({
      address: addresses.staking,
      abi: stakingAbi,
      functionName: "stake",
      args: [validator, amount],
    })
  }

  return { stake, isSigningTx: isPending, isConfirmingTx: isConfirming, isSuccess, isSafeQueued, error, reset, txHash }
}

export function useBatchStake() {
  const { data: capabilities, isError: capabilitiesError } = useCapabilities({
    query: { retry: false },
  })
  const chainId = activeChain.id

  const supportsBatching =
    !capabilitiesError &&
    capabilities?.[chainId]?.atomicBatch?.supported === true

  const {
    mutate: sendCalls,
    data: callsResult,
    isPending,
    error,
    reset,
  } = useSendCalls()

  const batchId = callsResult?.id

  const { data: callsStatus } = useCallsStatus({
    id: batchId ?? "",
    query: {
      enabled: !!batchId,
      refetchInterval: (data) =>
        data.state.data?.status === "success" || data.state.data?.status === "failure"
          ? false
          : 2000,
    },
  })

  const isConfirming = !!batchId && callsStatus?.status !== "success" && callsStatus?.status !== "failure"
  const isSuccess = callsStatus?.status === "success"
  const isReverted = callsStatus?.status === "failure"
  const txHash = callsStatus?.receipts?.[0]?.transactionHash

  useInvalidateOnSuccess(isSuccess, STAKING_FN_NAMES, STAKING_EXTRA_KEYS)

  function batchApproveAndStake(validator: Address, amount: bigint) {
    sendCalls({
      calls: [
        {
          to: addresses.token,
          data: encodeFunctionData({
            abi: erc20Abi,
            functionName: "approve",
            args: [addresses.staking, amount],
          }),
        },
        {
          to: addresses.staking,
          data: encodeFunctionData({
            abi: stakingAbi,
            functionName: "stake",
            args: [validator, amount],
          }),
        },
      ],
    })
  }

  return {
    batchApproveAndStake,
    supportsBatching,
    isSigningTx: isPending,
    isConfirmingTx: isConfirming,
    isSuccess,
    isReverted,
    error,
    reset,
    txHash,
  }
}

export function useInitiateWithdrawal() {
  const { writeContract, data: txHash, isPending, isSuccess: isSubmitted, reset, error: writeError } = useWriteContract()
  const { isLoading: isConfirming, isSuccess, error: receiptError } = useWaitForTransactionReceipt({ hash: txHash })
  const error = writeError ?? receiptError

  const isSafeQueued = isSafeApp && isSubmitted && !isSuccess

  useInvalidateOnSuccess(isSuccess, STAKING_FN_NAMES, STAKING_EXTRA_KEYS)

  function initiateWithdrawal(validator: Address, amount: bigint) {
    writeContract({
      address: addresses.staking,
      abi: stakingAbi,
      functionName: "initiateWithdrawal",
      args: [validator, amount],
    })
  }

  return { initiateWithdrawal, isSigningTx: isPending, isConfirmingTx: isConfirming, isSuccess, isSafeQueued, error, reset, txHash }
}

export function useClaimWithdrawal() {
  const { writeContract, data: txHash, isPending, isSuccess: isSubmitted, reset, error: writeError } = useWriteContract()
  const { isLoading: isConfirming, isSuccess, error: receiptError } = useWaitForTransactionReceipt({ hash: txHash })
  const error = writeError ?? receiptError

  const isSafeQueued = isSafeApp && isSubmitted && !isSuccess

  useInvalidateOnSuccess(isSuccess, STAKING_FN_NAMES, STAKING_EXTRA_KEYS)

  function claimWithdrawal() {
    writeContract({
      address: addresses.staking,
      abi: stakingAbi,
      functionName: "claimWithdrawal",
    })
  }

  return { claimWithdrawal, isSigningTx: isPending, isConfirmingTx: isConfirming, isSuccess, isSafeQueued, error, reset, txHash }
}

export function useBatchClaimWithdrawals() {
  const { data: capabilities, isError: capabilitiesError } = useCapabilities({
    query: { retry: false },
  })
  const chainId = activeChain.id

  const supportsBatching =
    !capabilitiesError &&
    capabilities?.[chainId]?.atomicBatch?.supported === true

  const {
    mutate: sendCalls,
    data: callsResult,
    isPending,
    error,
    reset,
  } = useSendCalls()

  const batchId = callsResult?.id

  const { data: callsStatus } = useCallsStatus({
    id: batchId ?? "",
    query: {
      enabled: !!batchId,
      refetchInterval: (data) =>
        data.state.data?.status === "success" || data.state.data?.status === "failure"
          ? false
          : 2000,
    },
  })

  const isConfirming = !!batchId && callsStatus?.status !== "success" && callsStatus?.status !== "failure"
  const isSuccess = callsStatus?.status === "success"
  const isReverted = callsStatus?.status === "failure"
  const txHash = callsStatus?.receipts?.[0]?.transactionHash

  useInvalidateOnSuccess(isSuccess, STAKING_FN_NAMES, STAKING_EXTRA_KEYS)

  function batchClaimWithdrawals(count: number) {
    const calls = Array.from({ length: count }, () => ({
      to: addresses.staking,
      data: encodeFunctionData({
        abi: stakingAbi,
        functionName: "claimWithdrawal",
      }),
    }))
    sendCalls({ calls })
  }

  return {
    batchClaimWithdrawals,
    supportsBatching,
    isSigningTx: isPending,
    isConfirmingTx: isConfirming,
    isSuccess,
    isReverted,
    error,
    reset,
    txHash,
  }
}
