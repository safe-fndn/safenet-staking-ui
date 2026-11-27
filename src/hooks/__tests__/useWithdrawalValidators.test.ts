import { describe, it, expect, vi, beforeEach } from "vitest"
import { renderHook, waitFor } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { createElement, type ReactNode } from "react"
import type { Address } from "viem"
import { useWithdrawalValidators } from "../useWithdrawalValidators"
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
const ZERO = "0x0000000000000000000000000000000000000000"

const readContract = vi.fn()
const getLogs = vi.fn()
const getBlockNumber = vi.fn()
const mockUseReadContract = vi.fn()

vi.mock("wagmi", () => ({
  usePublicClient: () => ({ readContract, getLogs, getBlockNumber }),
  useAccount: () => ({ address: TEST_ACCOUNTS.user }),
  useReadContract: (...args: unknown[]) => mockUseReadContract(...args),
}))

/** Queue 134 -> 137, as returned by withdrawalNodes. */
function mockQueue() {
  mockUseReadContract.mockReturnValue({ data: [134n, 137n] })
  readContract.mockImplementation(async ({ args }: { args: [Address, bigint] }) =>
    args[1] === 134n ? [9n, 1n, 0n, 137n] : [1n, 2n, 134n, 0n],
  )
}

function log(withdrawalId: bigint, validator: Address) {
  return { args: { staker: TEST_ACCOUNTS.user, validator, withdrawalId, amount: 1n } }
}

function wrapperFor(client: QueryClient) {
  return ({ children }: { children: ReactNode }) => createElement(QueryClientProvider, { client }, children)
}
const newWrapper = () => wrapperFor(new QueryClient({ defaultOptions: { queries: { retry: false } } }))

describe("useWithdrawalValidators", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockQueue()
    getBlockNumber.mockResolvedValue(1_200_000n)
  })

  it("stops after the newest chunk once every ID is resolved", async () => {
    getLogs.mockResolvedValueOnce([log(134n, VALIDATOR_A), log(137n, VALIDATOR_B)])

    const { result } = renderHook(() => useWithdrawalValidators(), { wrapper: newWrapper() })

    await waitFor(() => expect(result.current.data).toEqual([VALIDATOR_A, VALIDATOR_B]))
    expect(getLogs).toHaveBeenCalledTimes(1)
    expect(getLogs).toHaveBeenCalledWith(expect.objectContaining({ fromBlock: 1_150_001n, toBlock: 1_200_000n }))
  })

  it("scans older chunks until all IDs are found", async () => {
    getLogs.mockResolvedValueOnce([log(137n, VALIDATOR_B)]).mockResolvedValueOnce([log(134n, VALIDATOR_A)])

    const { result } = renderHook(() => useWithdrawalValidators(), { wrapper: newWrapper() })

    await waitFor(() => expect(result.current.data).toEqual([VALIDATOR_A, VALIDATOR_B]))
    expect(getLogs).toHaveBeenCalledTimes(2)
    expect(getLogs).toHaveBeenLastCalledWith(expect.objectContaining({ fromBlock: 1_100_001n, toBlock: 1_150_000n }))
  })

  it("errors instead of returning zero addresses when a chunk fails", async () => {
    getLogs.mockRejectedValueOnce(new Error("rate limited"))

    const { result } = renderHook(() => useWithdrawalValidators(), { wrapper: newWrapper() })

    await waitFor(() => expect(result.current.isError).toBe(true))
    expect(result.current.data).toBeUndefined()
  })

  it("falls back to the zero address for IDs missing after a full scan", async () => {
    getLogs.mockResolvedValue([log(137n, VALIDATOR_B)])

    const { result } = renderHook(() => useWithdrawalValidators(), { wrapper: newWrapper() })

    await waitFor(() => expect(result.current.data).toEqual([ZERO, VALIDATOR_B]))
    // 1_000_000..1_200_000 in 50_000-block chunks
    expect(getLogs).toHaveBeenCalledTimes(5)
    expect(getLogs).toHaveBeenLastCalledWith(expect.objectContaining({ fromBlock: 1_000_000n, toBlock: 1_000_000n }))
  })
})
