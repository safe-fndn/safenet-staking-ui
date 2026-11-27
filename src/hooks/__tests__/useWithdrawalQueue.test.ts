import { describe, it, expect, vi, beforeEach } from "vitest"
import { renderHook, waitFor } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { createElement, type ReactNode } from "react"
import type { Address } from "viem"
import { clearKnownValidators, useWithdrawalQueue, useWithdrawalValidators, ZERO_ADDRESS } from "../useWithdrawalQueue"
import { TEST_ACCOUNTS } from "@/__tests__/test-data"

vi.mock("@/config/contracts", () => ({
  getContractAddresses: () => ({
    staking: "0x115E78f160e1E3eF163B05C84562Fa16fA338509",
    token: "0x5aFE3855358E112B5647B952709E6165e1c1eEEe",
  }),
  deployBlock: 1_000_000n,
}))

const VALIDATOR_A = "0xD8997c2a94052C4FB79B53b3e255c1F07c99305B" as Address
const VALIDATOR_B = "0x3D58a5475c1336b0A755c3aBd298CeB9b7BB9CDe" as Address

const readContract = vi.fn()
const getLogs = vi.fn()
const getBlockNumber = vi.fn()

vi.mock("wagmi", () => ({
  usePublicClient: () => ({ readContract, getLogs, getBlockNumber }),
  useAccount: () => ({ address: TEST_ACCOUNTS.user }),
}))

function log(withdrawalId: bigint, validator: Address) {
  return { args: { staker: TEST_ACCOUNTS.user, validator, withdrawalId, amount: 1n } }
}

function newClient() {
  return new QueryClient({ defaultOptions: { queries: { retry: false } } })
}
function wrapperFor(client: QueryClient) {
  return ({ children }: { children: ReactNode }) => createElement(QueryClientProvider, { client }, children)
}

/** A queue 134 -> 137 served by the fake contract. */
function mockQueue(queue: [bigint, bigint] = [134n, 137n]) {
  readContract.mockImplementation(async ({ functionName, args }: { functionName: string; args: unknown[] }) => {
    if (functionName === "withdrawalQueues") return queue
    if (functionName === "getPendingWithdrawals") {
      return queue[0] === 0n ? [] : [{ amount: 9n, claimableAt: 100n }, { amount: 1n, claimableAt: 200n }]
    }
    return args[1] === 134n ? [9n, 100n, 0n, 137n] : [1n, 200n, 134n, 0n]
  })
}
const calls = (fn: string) => readContract.mock.calls.filter(([c]) => c.functionName === fn)

beforeEach(() => {
  vi.clearAllMocks()
  clearKnownValidators()
  getBlockNumber.mockResolvedValue(1_200_000n)
})

describe("useWithdrawalQueue", () => {
  it("reads queue, rows and nodes at one fresh, pinned block", async () => {
    mockQueue()
    const { result } = renderHook(() => useWithdrawalQueue(), { wrapper: wrapperFor(newClient()) })

    await waitFor(() =>
      expect(result.current.data).toEqual({
        blockNumber: 1_200_000n,
        head: 134n,
        tail: 137n,
        rows: [
          { id: 134n, amount: 9n, claimableAt: 100n },
          { id: 137n, amount: 1n, claimableAt: 200n },
        ],
      }),
    )
    // A fresh block number, not viem's cached one, so a post-claim refetch reads the new block.
    expect(getBlockNumber).toHaveBeenCalledWith({ cacheTime: 0 })
    for (const [call] of readContract.mock.calls) expect(call.blockNumber).toBe(1_200_000n)
    expect(calls("withdrawalNodes")).toHaveLength(2)
  })

  it("does not walk the nodes again while head, tail and length are unchanged", async () => {
    mockQueue()
    const { result } = renderHook(() => useWithdrawalQueue(), { wrapper: wrapperFor(newClient()) })
    await waitFor(() => expect(result.current.data?.rows).toHaveLength(2))

    getBlockNumber.mockResolvedValue(1_200_001n)
    await result.current.refetch()

    await waitFor(() => expect(result.current.data?.blockNumber).toBe(1_200_001n))
    expect(calls("withdrawalNodes")).toHaveLength(2) // only the first poll walked the list
    expect(calls("getPendingWithdrawals")).toHaveLength(2)
    expect(result.current.data?.rows.map((r) => r.id)).toEqual([134n, 137n])
  })

  it("walks the nodes again when the head changes", async () => {
    mockQueue()
    const { result } = renderHook(() => useWithdrawalQueue(), { wrapper: wrapperFor(newClient()) })
    await waitFor(() => expect(result.current.data?.rows).toHaveLength(2))

    // Head claimed and a new withdrawal added: same length, different head.
    readContract.mockImplementation(async ({ functionName, args }: { functionName: string; args: unknown[] }) => {
      if (functionName === "withdrawalQueues") return [137n, 140n]
      if (functionName === "getPendingWithdrawals") return [{ amount: 1n, claimableAt: 200n }, { amount: 5n, claimableAt: 300n }]
      return args[1] === 137n ? [1n, 200n, 0n, 140n] : [5n, 300n, 137n, 0n]
    })
    await result.current.refetch()

    await waitFor(() => expect(result.current.data?.rows.map((r) => r.id)).toEqual([137n, 140n]))
  })

  it("returns an empty queue when head is 0", async () => {
    mockQueue([0n, 0n])
    const { result } = renderHook(() => useWithdrawalQueue(), { wrapper: wrapperFor(newClient()) })
    await waitFor(() => expect(result.current.data?.rows).toEqual([]))
    expect(calls("withdrawalNodes")).toHaveLength(0)
  })
})

describe("useWithdrawalValidators", () => {
  const ids = [134n, 137n]

  it("stops after the newest chunk once every ID is resolved", async () => {
    getLogs.mockResolvedValueOnce([log(134n, VALIDATOR_A), log(137n, VALIDATOR_B)])

    const { result } = renderHook(() => useWithdrawalValidators(ids), { wrapper: wrapperFor(newClient()) })

    await waitFor(() => expect(result.current.data).toEqual({ "134": VALIDATOR_A, "137": VALIDATOR_B }))
    expect(getLogs).toHaveBeenCalledTimes(1)
    expect(getLogs).toHaveBeenCalledWith(expect.objectContaining({ fromBlock: 1_150_001n, toBlock: 1_200_000n }))
  })

  it("scans older chunks a few at a time until all IDs are found", async () => {
    // Newest chunk has 137; 134 sits in the third chunk, inside the first parallel group.
    getLogs.mockImplementation(async ({ toBlock }: { toBlock: bigint }) =>
      toBlock === 1_200_000n ? [log(137n, VALIDATOR_B)] : toBlock === 1_100_000n ? [log(134n, VALIDATOR_A)] : [],
    )

    const { result } = renderHook(() => useWithdrawalValidators(ids), { wrapper: wrapperFor(newClient()) })

    await waitFor(() => expect(result.current.data).toEqual({ "134": VALIDATOR_A, "137": VALIDATOR_B }))
    // 1 newest + 1 group of the remaining 4 chunks (1_000_000..1_150_000), not one after another.
    expect(getLogs).toHaveBeenCalledTimes(5)
  })

  it("errors instead of returning zero addresses when a chunk fails", async () => {
    getLogs.mockRejectedValueOnce(new Error("rate limited"))

    const { result } = renderHook(() => useWithdrawalValidators(ids), { wrapper: wrapperFor(newClient()) })

    await waitFor(() => expect(result.current.isError).toBe(true))
    expect(result.current.data).toBeUndefined()
  })

  it("maps an ID missing after a full scan to zero, without caching it", async () => {
    getLogs.mockResolvedValueOnce([log(137n, VALIDATOR_B)]).mockResolvedValue([])
    const client = newClient()

    const { result } = renderHook(() => useWithdrawalValidators(ids), { wrapper: wrapperFor(client) })
    await waitFor(() => expect(result.current.data).toEqual({ "134": ZERO_ADDRESS, "137": VALIDATOR_B }))
    // A missing ID makes the result stale, so it is looked up again (here: the log node caught up).
    expect(client.getQueryCache().findAll({ queryKey: ["withdrawalValidators"] })[0].isStale()).toBe(true)

    getLogs.mockReset()
    getLogs.mockResolvedValueOnce([log(134n, VALIDATOR_A)])
    await result.current.refetch()

    await waitFor(() => expect(result.current.data).toEqual({ "134": VALIDATOR_A, "137": VALIDATOR_B }))
    // 137 came from the cache: the retry only needed the newest chunk.
    expect(getLogs).toHaveBeenCalledTimes(1)
  })

  it("does not run without IDs", () => {
    renderHook(() => useWithdrawalValidators([]), { wrapper: wrapperFor(newClient()) })
    expect(getLogs).not.toHaveBeenCalled()
  })
})
