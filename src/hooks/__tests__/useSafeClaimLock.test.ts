import { describe, it, expect, vi, beforeEach } from "vitest"
import { act, renderHook } from "@testing-library/react"
import type { Hash } from "viem"
import { pendingSafeClaimKey, useSafeClaimLock } from "../useSafeClaimLock"
import { activeChain } from "@/config/chains"

const SAFE = "0x1111111111111111111111111111111111111111"
const OTHER_SAFE = "0x2222222222222222222222222222222222222222"
const HASH = `0x${"5a".repeat(32)}` as Hash
const key = pendingSafeClaimKey(activeChain.id, SAFE)
const stored = (executedBlock?: bigint) => JSON.stringify({ hash: HASH, executedBlock: executedBlock?.toString() })

const mockAccount = vi.fn(() => ({ address: SAFE as string | undefined }))
vi.mock("wagmi", () => ({ useAccount: () => mockAccount() }))

const mockStatus = vi.fn<(hash?: string) => { status: string; blockNumber?: bigint }>(() => ({ status: "pending" }))
vi.mock("@/hooks/useSafeTxStatus", () => ({ useSafeTxStatus: (hash?: string) => mockStatus(hash) }))

beforeEach(() => {
  vi.clearAllMocks()
  localStorage.clear()
  mockAccount.mockReturnValue({ address: SAFE })
  mockStatus.mockReturnValue({ status: "pending" })
})

describe("useSafeClaimLock", () => {
  it("persists a newly queued claim per chain and Safe", () => {
    const { result } = renderHook(() => useSafeClaimLock(HASH, true))
    expect(result.current.lockedHash).toBe(HASH)
    expect(localStorage.getItem(key)).toBe(stored())
    expect(mockStatus).toHaveBeenLastCalledWith(HASH)
  })

  it("restores the lock and its tracking when the page opens again", () => {
    localStorage.setItem(key, stored())
    // A fresh mount after leaving the page or a reload: no queued hash from the claim hook.
    const { result } = renderHook(() => useSafeClaimLock(undefined, true))
    expect(result.current.lockedHash).toBe(HASH)
    expect(mockStatus).toHaveBeenLastCalledWith(HASH)
  })

  it("does not apply another Safe's pending claim", () => {
    localStorage.setItem(key, stored())
    mockAccount.mockReturnValue({ address: OTHER_SAFE })
    const { result } = renderHook(() => useSafeClaimLock(undefined, true))
    expect(result.current.lockedHash).toBeUndefined()
  })

  it("picks up the stored claim once the account is known", () => {
    localStorage.setItem(key, stored())
    mockAccount.mockReturnValue({ address: undefined })
    const { result, rerender } = renderHook(() => useSafeClaimLock(undefined, true))
    expect(result.current.lockedHash).toBeUndefined()
    mockAccount.mockReturnValue({ address: SAFE })
    rerender()
    expect(result.current.lockedHash).toBe(HASH)
  })

  it("keeps the execution block stored until a queue snapshot reaches it", () => {
    localStorage.setItem(key, stored())
    mockStatus.mockReturnValue({ status: "executed", blockNumber: 105n })
    const { result } = renderHook(() => useSafeClaimLock(undefined, true))

    expect(result.current.lockedHash).toBeUndefined() // no longer waiting on Safe
    expect(result.current.safeBlock).toBe(105n) // but on the queue
    expect(localStorage.getItem(key)).toBe(stored(105n))

    // An older (e.g. cached) snapshot does not release it.
    act(() => result.current.release(104n))
    expect(result.current.safeBlock).toBe(105n)
    expect(localStorage.getItem(key)).toBe(stored(105n))

    act(() => result.current.release(105n))
    expect(result.current.safeBlock).toBeUndefined()
    expect(localStorage.getItem(key)).toBeNull()
  })

  it("restores the execution block after a reload, without asking Safe again", () => {
    localStorage.setItem(key, stored(105n))
    const { result } = renderHook(() => useSafeClaimLock(undefined, true))
    expect(result.current.safeBlock).toBe(105n)
    expect(result.current.lockedHash).toBeUndefined()
    expect(mockStatus).toHaveBeenLastCalledWith(undefined)
  })

  it("unlocks and forgets a dropped claim", () => {
    localStorage.setItem(key, stored())
    mockStatus.mockReturnValue({ status: "dropped" })
    const { result } = renderHook(() => useSafeClaimLock(undefined, true))
    expect(result.current.lockedHash).toBeUndefined()
    expect(localStorage.getItem(key)).toBeNull()
  })

  it("ignores malformed stored values", () => {
    localStorage.setItem(key, JSON.stringify({ hash: "not-a-hash" }))
    const { result } = renderHook(() => useSafeClaimLock(undefined, true))
    expect(result.current.lockedHash).toBeUndefined()
  })

  it("does not persist outside the Safe app", () => {
    const { result } = renderHook(() => useSafeClaimLock(HASH, false))
    expect(result.current.lockedHash).toBe(HASH)
    expect(localStorage.length).toBe(0)
  })

  it("follows a claim another tab queued for this Safe", () => {
    const { result } = renderHook(() => useSafeClaimLock(undefined, true))
    expect(result.current.lockedHash).toBeUndefined()

    // The other tab writes storage; this tab gets a storage event.
    act(() => {
      localStorage.setItem(key, stored())
      window.dispatchEvent(new StorageEvent("storage", { key, newValue: stored() }))
    })
    expect(result.current.lockedHash).toBe(HASH)
    expect(mockStatus).toHaveBeenLastCalledWith(HASH)
  })

  it("ignores storage events for other Safes", () => {
    const { result } = renderHook(() => useSafeClaimLock(undefined, true))
    const other = pendingSafeClaimKey(activeChain.id, OTHER_SAFE)
    act(() => {
      localStorage.setItem(other, stored())
      window.dispatchEvent(new StorageEvent("storage", { key: other }))
    })
    expect(result.current.lockedHash).toBeUndefined()
  })

  it("canSubmit rechecks storage, blocking a claim another tab queued without an event seen yet", () => {
    const { result } = renderHook(() => useSafeClaimLock(undefined, true))
    expect(result.current.canSubmit()).toBe(true)

    localStorage.setItem(key, stored()) // no storage event delivered yet
    let allowed = true
    act(() => {
      allowed = result.current.canSubmit()
    })
    expect(allowed).toBe(false)
    expect(result.current.lockedHash).toBe(HASH) // and it is tracked from now on
  })

  it("canSubmit is false while this tab's own claim is pending or catching up", () => {
    const { result } = renderHook(() => useSafeClaimLock(HASH, true))
    expect(result.current.canSubmit()).toBe(false)

    mockStatus.mockReturnValue({ status: "executed", blockNumber: 105n })
    const caughtUp = renderHook(() => useSafeClaimLock(undefined, true))
    expect(caughtUp.result.current.safeBlock).toBe(105n)
    expect(caughtUp.result.current.canSubmit()).toBe(false)
  })
})
