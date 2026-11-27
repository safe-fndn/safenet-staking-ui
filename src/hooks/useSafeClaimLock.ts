import { useEffect, useState } from "react"
import { useAccount } from "wagmi"
import type { Hash } from "viem"
import { activeChain } from "@/config/chains"
import { useSafeTxStatus } from "@/hooks/useSafeTxStatus"
import { isSafeApp } from "@/lib/safe"

/** localStorage key of a queued claim, per chain and Safe (the connected account inside the Safe app). */
export function pendingSafeClaimKey(chainId: number, safe: string) {
  return `safenet:pendingSafeClaim:${chainId}:${safe.toLowerCase()}`
}

const HASH = /^0x[0-9a-fA-F]{64}$/

/** A claim queued in Safe, and once it executed, the block it executed in. */
interface PendingClaim {
  hash: Hash
  executedBlock?: bigint
}

function readPending(key: string | undefined): PendingClaim | undefined {
  if (!key) return undefined
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return undefined
    const value = JSON.parse(raw) as { hash?: unknown; executedBlock?: unknown }
    if (typeof value.hash !== "string" || !HASH.test(value.hash)) return undefined
    const executedBlock =
      typeof value.executedBlock === "string" && /^\d+$/.test(value.executedBlock) ? BigInt(value.executedBlock) : undefined
    return { hash: value.hash as Hash, executedBlock }
  } catch {
    return undefined
  }
}

interface Tracked {
  key: string | undefined
  claim: PendingClaim | undefined
  /** Dropped, or executed and the queue caught up: nothing left to wait for. */
  done: boolean
}

/**
 * Locks claiming while a claim queued in the Safe app can still execute, and
 * until the queue has caught up with it once it did.
 *
 * `claimWithdrawal()` carries no withdrawal ID, so a queued claim claims
 * whatever is at the head when it executes. The claim is kept in localStorage
 * per chain and Safe, so the lock survives leaving the page and reloads:
 * - while the Safe transaction is pending, `lockedHash` is set;
 * - once it executed, its block is stored too and returned as `safeBlock`
 *   for the caller's block gate, until the caller reports a queue snapshot at
 *   or past it via `release(snapshotBlock)`;
 * - a dropped (failed or cancelled) transaction just unlocks.
 *
 * `queuedHash`: the hash of a claim the wallet just queued (from the claim
 * hook's state, which the tx toast resets right after; it is captured during
 * render for that reason).
 */
export function useSafeClaimLock(queuedHash: Hash | undefined, safeApp = isSafeApp) {
  const { address } = useAccount()
  // Persisted only inside the Safe app: claims are only queued there, and only
  // there can the Safe Apps SDK report their status.
  const key = safeApp && address ? pendingSafeClaimKey(activeChain.id, address) : undefined

  const [tracked, setTracked] = useState<Tracked>(() => ({ key, claim: readPending(key), done: false }))
  // Another Safe or chain: switch to its own pending claim.
  if (tracked.key !== key) setTracked({ key, claim: readPending(key), done: false })
  // A newly queued claim (tracked once per hash).
  if (queuedHash && tracked.key === key && tracked.claim?.hash !== queuedHash) {
    setTracked({ key, claim: { hash: queuedHash }, done: false })
  }

  const current = tracked.key === key && !tracked.done ? tracked.claim : undefined
  const lockedHash = current && current.executedBlock === undefined ? current.hash : undefined
  const safeTx = useSafeTxStatus(lockedHash)
  if (current && lockedHash) {
    if (safeTx.status === "executed") setTracked({ ...tracked, claim: { ...current, executedBlock: safeTx.blockNumber } })
    else if (safeTx.status === "dropped") setTracked({ ...tracked, done: true })
  }
  const safeBlock =
    current?.executedBlock ?? (lockedHash && safeTx.status === "executed" ? safeTx.blockNumber : undefined)

  /** Call with the latest queue snapshot's block; ends the wait once it reached the execution block. */
  function release(snapshotBlock: bigint | undefined) {
    if (current?.executedBlock !== undefined && snapshotBlock !== undefined && snapshotBlock >= current.executedBlock) {
      setTracked({ ...tracked, done: true })
    }
  }

  /** Whether `stored` is news to `t`: not the claim it tracks, or a later state of it (now executed). */
  const isNews = (t: Tracked, stored: PendingClaim) =>
    !(t.key === key && t.claim?.hash === stored.hash && (t.done || t.claim.executedBlock !== undefined || stored.executedBlock === undefined))

  /**
   * Call right before submitting a claim. Rereads storage, so a claim another
   * tab queued for this Safe (that this tab has not picked up yet) blocks it
   * and is tracked from then on. Returns false if the claim must not be sent.
   */
  function canSubmit(): boolean {
    if (lockedHash !== undefined || current?.executedBlock !== undefined) return false
    const stored = readPending(key)
    if (stored && isNews(tracked, stored)) {
      setTracked({ key, claim: stored, done: false })
      return false
    }
    return true
  }

  // Another tab of this origin queued a claim for this Safe (or recorded its
  // execution): track it here too. Removals are ignored: this tab settles a
  // claim it tracks through its own status polling.
  useEffect(() => {
    if (!key) return
    const onStorage = (e: StorageEvent) => {
      if (e.key !== key) return
      const stored = readPending(key)
      if (stored) setTracked((t) => (isNews(t, stored) ? { key, claim: stored, done: false } : t))
    }
    window.addEventListener("storage", onStorage)
    return () => window.removeEventListener("storage", onStorage)
  }, [key]) // eslint-disable-line react-hooks/exhaustive-deps -- isNews only reads `key`

  // Persist: keep an unfinished claim, forget a finished one (only if it is still ours).
  useEffect(() => {
    const { key: k, claim, done } = tracked
    if (!k || !claim) return
    try {
      if (!done) {
        localStorage.setItem(
          k,
          JSON.stringify({ hash: claim.hash, executedBlock: claim.executedBlock?.toString() }),
        )
      } else if (readPending(k)?.hash === claim.hash) {
        localStorage.removeItem(k)
      }
    } catch {
      // Storage unavailable: the lock still holds for this page view.
    }
  }, [tracked])

  return { lockedHash, safeBlock, release, canSubmit }
}
