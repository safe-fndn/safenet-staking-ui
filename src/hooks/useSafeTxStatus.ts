import { useQuery } from "@tanstack/react-query"
import { usePublicClient } from "wagmi"
import type { Hash } from "viem"

const POLL_INTERVAL = 10_000

export type SafeTxState =
  /** Still waiting for signatures or execution, or the status is not known yet. */
  | { status: "pending" }
  /** Executed onchain in `blockNumber`. */
  | { status: "executed"; blockNumber: bigint }
  /** Will never execute (failed or cancelled). */
  | { status: "dropped" }

type SafeAppsSDK = InstanceType<(typeof import("@safe-global/safe-apps-sdk"))["default"]>

let sdk: Promise<SafeAppsSDK> | undefined

/**
 * The one Safe Apps SDK instance, created on first use. Every instance adds a
 * window "message" listener it never removes, so one per lookup would pile
 * listeners up with every poll.
 */
export function getSafeAppsSdk(load = () => import("@safe-global/safe-apps-sdk")): Promise<SafeAppsSDK> {
  if (!sdk) {
    const loading = load().then(({ default: SDK }) => new SDK())
    // A failed load (e.g. a chunk fetch error) is retried on the next lookup.
    loading.catch(() => {
      if (sdk === loading) sdk = undefined
    })
    sdk = loading
  }
  return sdk
}

/** Test hook: drop the shared instance. */
export function resetSafeAppsSdk() {
  sdk = undefined
}

/** Reads a queued Safe transaction's status through the Safe Apps SDK (postMessage to the Safe UI). */
async function fetchSafeTx(safeTxHash: string) {
  return (await getSafeAppsSdk()).txs.getBySafeTxHash(safeTxHash)
}

/**
 * Tracks a transaction queued in the Safe app by its `safeTxHash` (what
 * `writeContract` returns inside Safe), polling every 10s until it executes or
 * is dropped. Anything unknown (loading, lookup errors) reports "pending", so
 * callers that lock on it fail closed.
 */
export function useSafeTxStatus(safeTxHash: Hash | undefined, fetchTx = fetchSafeTx): SafeTxState {
  const client = usePublicClient()
  const { data } = useQuery({
    queryKey: ["safeTxStatus", safeTxHash],
    queryFn: async (): Promise<SafeTxState> => {
      const tx = await fetchTx(safeTxHash!)
      if (tx.txStatus === "SUCCESS" && tx.txHash && client) {
        const receipt = await client.getTransactionReceipt({ hash: tx.txHash as Hash })
        return { status: "executed", blockNumber: receipt.blockNumber }
      }
      if (tx.txStatus === "FAILED" || tx.txStatus === "CANCELLED") return { status: "dropped" }
      return { status: "pending" }
    },
    enabled: !!safeTxHash,
    refetchInterval: (query) => (query.state.data && query.state.data.status !== "pending" ? false : POLL_INTERVAL),
    retry: true,
    retryDelay: POLL_INTERVAL,
  })
  return data ?? { status: "pending" }
}
