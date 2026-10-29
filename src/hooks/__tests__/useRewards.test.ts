import { describe, it, expect, vi, beforeEach } from "vitest"
import { renderHook } from "@testing-library/react"
import { useRewards } from "../useRewards"
import type { RewardProof } from "../useRewardProof"
import { encodeLeaf, hashPair } from "@/lib/merkle"
import { TEST_ACCOUNTS } from "@/__tests__/test-data"

const mockUseReadContract = vi.fn()
const mockUseAccount = vi.fn()
const mockUseRewardProof = vi.fn()

vi.mock("wagmi", () => ({
  useReadContract: (...args: unknown[]) => mockUseReadContract(...args),
  useAccount: () => mockUseAccount(),
}))

vi.mock("@/config/contracts", () => ({
  getContractAddresses: () => ({
    merkleDrop: "0x0000000000000000000000000000000000000003",
  }),
}))

vi.mock("../useRewardProof", () => ({
  useRewardProof: (...args: unknown[]) => mockUseRewardProof(...args),
}))

const AMOUNT = 100n * 10n ** 18n
const CLAIMED = 30n * 10n ** 18n

// Two-leaf tree: the user's proof is the other leaf
const USER_LEAF = encodeLeaf(TEST_ACCOUNTS.user, AMOUNT)
const OTHER_LEAF = encodeLeaf(TEST_ACCOUNTS.validator1, 50n * 10n ** 18n)
const ROOT = hashPair(USER_LEAF, OTHER_LEAF)

const VALID_PROOF: RewardProof = {
  cumulativeAmount: AMOUNT.toString(),
  merkleRoot: ROOT,
  proof: [OTHER_LEAF],
}

/** Serve each contract read by function name. */
function mockReads(reads: Record<string, { data: unknown; isLoading: boolean }>) {
  mockUseReadContract.mockImplementation(({ functionName }: { functionName: string }) => reads[functionName])
}

describe("useRewards", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockUseAccount.mockReturnValue({ address: TEST_ACCOUNTS.user })
    mockUseRewardProof.mockReturnValue({ data: VALID_PROOF, isLoading: false })
    mockReads({
      cumulativeClaimed: { data: CLAIMED, isLoading: false },
      merkleRoot: { data: ROOT, isLoading: false },
    })
  })

  it("polls the onchain root", () => {
    renderHook(() => useRewards())

    expect(mockUseReadContract).toHaveBeenCalledWith(
      expect.objectContaining({
        functionName: "merkleRoot",
        query: expect.objectContaining({ refetchInterval: 15_000 }),
      })
    )
  })

  it("reports the unclaimed amount for a proof that verifies against the onchain root", () => {
    const { result } = renderHook(() => useRewards())

    expect(result.current).toEqual({
      data: { claimable: AMOUNT - CLAIMED, totalClaimed: CLAIMED, canClaim: true, rootStale: false },
      isLoading: false,
    })
  })

  it("shows nothing claimable when the proof names another root", () => {
    // The siblings still prove into the onchain root; the root mismatch alone blocks it
    mockUseRewardProof.mockReturnValue({
      data: { ...VALID_PROOF, merkleRoot: "0x" + "cc".repeat(32) },
      isLoading: false,
    })

    const { result } = renderHook(() => useRewards())

    expect(result.current.data).toEqual({ claimable: 0n, totalClaimed: CLAIMED, canClaim: false, rootStale: true })
  })

  it("shows nothing claimable for an entry without a proof", () => {
    mockUseRewardProof.mockReturnValue({ data: { ...VALID_PROOF, proof: null }, isLoading: false })

    const { result } = renderHook(() => useRewards())

    expect(result.current.data).toEqual({ claimable: 0n, totalClaimed: CLAIMED, canClaim: false, rootStale: false })
  })

  it("shows nothing claimable when the amount does not verify against a matching root", () => {
    mockUseRewardProof.mockReturnValue({
      data: { ...VALID_PROOF, cumulativeAmount: (AMOUNT + 1n).toString() },
      isLoading: false,
    })

    const { result } = renderHook(() => useRewards())

    expect(result.current.data).toEqual({ claimable: 0n, totalClaimed: CLAIMED, canClaim: false, rootStale: false })
  })

  it("shows nothing claimable for a proof that belongs to another account", () => {
    mockUseAccount.mockReturnValue({ address: TEST_ACCOUNTS.validator2 })

    const { result } = renderHook(() => useRewards())

    expect(result.current.data).toEqual({ claimable: 0n, totalClaimed: CLAIMED, canClaim: false, rootStale: false })
  })

  it("shows nothing claimable and is loading while the onchain root loads", () => {
    mockReads({
      cumulativeClaimed: { data: CLAIMED, isLoading: false },
      merkleRoot: { data: undefined, isLoading: true },
    })

    const { result } = renderHook(() => useRewards())

    expect(result.current).toEqual({
      data: { claimable: 0n, totalClaimed: CLAIMED, canClaim: false, rootStale: false },
      isLoading: true,
    })
  })
})
