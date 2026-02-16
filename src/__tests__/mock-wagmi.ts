import { vi } from "vitest"
import type {
  UseWriteContractReturnType,
  UseReadContractReturnType,
  UseWaitForTransactionReceiptReturnType,
} from "wagmi"

/**
 * Factory for useWriteContract mock return values.
 * Produces a complete object matching the wagmi return type so tests
 * don't need `as unknown as` double-casts.
 */
export function mockWriteContractReturn(
  overrides: {
    writeContract?: ReturnType<typeof vi.fn>
    data?: `0x${string}`
    isPending?: boolean
    reset?: ReturnType<typeof vi.fn>
    error?: Error | null
  } = {},
): UseWriteContractReturnType {
  const write = overrides.writeContract ?? vi.fn()
  const reset = overrides.reset ?? vi.fn()
  const data = overrides.data as `0x${string}` | undefined
  const error = overrides.error ?? null
  const isPending = overrides.isPending ?? false

  return {
    writeContract: write,
    writeContractAsync: vi.fn(),
    mutate: write,
    mutateAsync: vi.fn(),
    data,
    error,
    variables: undefined,
    context: undefined,
    failureCount: 0,
    failureReason: null,
    isPaused: false,
    submittedAt: 0,
    isError: error !== null,
    isIdle: !isPending && error === null && data === undefined,
    isPending,
    isSuccess: data !== undefined && error === null && !isPending,
    status: isPending
      ? "pending"
      : error
        ? "error"
        : data !== undefined
          ? "success"
          : "idle",
    reset,
  } as UseWriteContractReturnType
}

/**
 * Factory for useReadContract mock return values.
 * Produces a complete object matching the wagmi query return type.
 */
export function mockReadContractReturn(
  overrides: {
    data?: unknown
    refetch?: ReturnType<typeof vi.fn>
  } = {},
): UseReadContractReturnType {
  const data = overrides.data
  const hasData = data !== undefined

  return {
    data,
    refetch: overrides.refetch ?? vi.fn(),
    error: null,
    dataUpdatedAt: hasData ? Date.now() : 0,
    errorUpdatedAt: 0,
    errorUpdateCount: 0,
    failureCount: 0,
    failureReason: null,
    fetchStatus: "idle",
    isError: false,
    isFetched: hasData,
    isFetchedAfterMount: hasData,
    isFetching: false,
    isLoading: false,
    isLoadingError: false,
    isInitialLoading: false,
    isPaused: false,
    isPending: !hasData,
    isPlaceholderData: false,
    isRefetchError: false,
    isRefetching: false,
    isStale: false,
    isSuccess: hasData,
    isEnabled: true,
    status: hasData ? "success" : "pending",
    promise: Promise.resolve(data),
    queryKey: ["readContract"],
  } as UseReadContractReturnType
}

/**
 * Factory for useWaitForTransactionReceipt mock return values.
 * Produces a complete object matching the wagmi query return type.
 */
export function mockWaitForReceiptReturn(
  overrides: {
    isLoading?: boolean
    isSuccess?: boolean
  } = {},
): UseWaitForTransactionReceiptReturnType {
  const isLoading = overrides.isLoading ?? false
  const isSuccess = overrides.isSuccess ?? false

  return {
    data: undefined,
    refetch: vi.fn(),
    error: null,
    dataUpdatedAt: 0,
    errorUpdatedAt: 0,
    errorUpdateCount: 0,
    failureCount: 0,
    failureReason: null,
    fetchStatus: isLoading ? "fetching" : "idle",
    isError: false,
    isFetched: isSuccess,
    isFetchedAfterMount: isSuccess,
    isFetching: isLoading,
    isLoading,
    isLoadingError: false,
    isInitialLoading: false,
    isPaused: false,
    isPending: !isSuccess && !isLoading,
    isPlaceholderData: false,
    isRefetchError: false,
    isRefetching: false,
    isStale: false,
    isSuccess,
    isEnabled: true,
    status: isSuccess ? "success" : "pending",
    promise: Promise.resolve() as unknown as UseWaitForTransactionReceiptReturnType["promise"],
    queryKey: ["waitForTransactionReceipt"],
  } as UseWaitForTransactionReceiptReturnType
}
