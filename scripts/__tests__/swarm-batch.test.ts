// @vitest-environment node
import { describe, it, expect } from "vitest"
import { HttpRequestError, TimeoutError, createPublicClient, custom, toFunctionSelector, type Address, type Hex } from "viem"
import { gnosis } from "viem/chains"
import {
  batchProblems,
  findBatch,
  isBatchGone,
  purchaseCalls,
  quote,
  remainingTtl,
  waitForBatch,
  type BatchInfo,
  type GnosisClient,
} from "../swarm/batch"

// Synthetic inputs. Expected values below were computed independently of viem
// (hand-assembled ABI encoding, core-sdk keccak256).
const BUYER: Address = "0x1111111111111111111111111111111111111111"
const OWNER: Address = "0x2222222222222222222222222222222222222222"
const NONCE: Hex = `0x${"33".repeat(32)}`
const BATCH_ID: Hex = "0x3200f8f28d1e8e8559291f6c7d6e1e07f447e7c241d9d78d0cb1661a36ff15d3"

const pricing = { price: 142_236n, minimumPerChunk: 2_457_838_080n }

describe("quote", () => {
  it("prices the TTL at the current price plus a safety margin", () => {
    const q = quote(pricing, 17, 365)
    const blocks = BigInt((365 * 86_400) / 5)
    expect(q.perChunk).toBe((pricing.price * blocks * 105n) / 100n)
    expect(q.total).toBe(q.perChunk << 17n)
    expect(q.ttlDays).toBeGreaterThan(365)
    expect(q.ttlDays).toBeLessThan(365 * 1.06)
  })

  it("never goes below the contract minimum for short TTLs", () => {
    expect(quote(pricing, 17, 0.5).perChunk).toBe((pricing.minimumPerChunk * 105n) / 100n)
    expect(() => quote(pricing, 17, 0)).toThrow()
  })
})

describe("purchaseCalls", () => {
  it("encodes the approve and immutable createBatch calls", () => {
    const { createBatch } = purchaseCalls(OWNER, { perChunk: 3_400_000_000n, total: 3_400_000_000n << 17n, depth: 17, ttlDays: 1 }, NONCE)
    expect(createBatch.data).toBe(
      "0x5239af71000000000000000000000000222222222222222222222222222222222222222200000000000000000000000000000000000000000000000000000000caa7e2000000000000000000000000000000000000000000000000000000000000000011000000000000000000000000000000000000000000000000000000000000001033333333333333333333333333333333333333333333333333333333333333330000000000000000000000000000000000000000000000000000000000000001",
    )
    expect(createBatch.args).toMatchObject({ _owner: OWNER, _depth: 17, _bucketDepth: 16, _immutable: true })

    const { approve } = purchaseCalls(OWNER, { perChunk: 4_670_023_680n, total: 4_670_023_680n << 17n, depth: 17, ttlDays: 2 }, NONCE)
    expect(approve.data).toBe(
      "0x095ea7b300000000000000000000000045a1502382541cd610cc9068e88727426b69629300000000000000000000000000000000000000000000000000022cb5d0000000",
    )
    expect(approve.args.amount).toBe("612109343784960")
  })
})

const PAID = 3_400_000_000n << 17n

const created = (owner: Address, { depth = 17, immutableFlag = true, totalAmount = PAID, blockNumber = 100n, batchId = BATCH_ID } = {}) => ({
  args: { batchId, totalAmount, owner, depth, bucketDepth: 16, immutableFlag },
  transactionHash: `0x${"44".repeat(32)}` as Hex,
  blockNumber,
})

function fakeClient(logs: ReturnType<typeof created>[], latest = 25_000n, reads: Record<string, bigint> = {}) {
  const ranges: [bigint, bigint][] = []
  const client = {
    getBlockNumber: async () => latest,
    getLogs: async ({ fromBlock, toBlock }: { fromBlock: bigint; toBlock: bigint }) => {
      ranges.push([fromBlock, toBlock])
      return logs.filter((l) => l.blockNumber >= fromBlock && l.blockNumber <= toBlock)
    },
    readContract: async ({ functionName }: { functionName: string }) => reads[functionName],
  } as unknown as GnosisClient
  return { client, ranges }
}

describe("findBatch", () => {
  const expected = { owner: OWNER, depth: 17, minTotal: PAID }
  const OTHER_ID: Hex = `0x${"55".repeat(32)}`

  it("matches by owner across log pages of at most 100 blocks, ignoring other batches", async () => {
    const { client, ranges } = fakeClient([
      created("0x0000000000000000000000000000000000000001", { blockNumber: 50n }),
      created(OWNER, { blockNumber: 250n }),
    ])
    const batch = await findBatch(client, { ...expected, owner: OWNER.toLowerCase() as Address }, 1n, 250n)
    expect(batch).toMatchObject({ batchId: BATCH_ID, owner: OWNER, depth: 17, immutable: true, totalAmount: PAID, blockNumber: 250n })
    expect(ranges).toEqual([[1n, 100n], [101n, 200n], [201n, 250n]])
  })

  it("returns undefined until the batch exists", async () => {
    expect(await findBatch(fakeClient([]).client, expected, 1n, 250n)).toBeUndefined()
  })

  it("skips front-run batches for our owner that can't hold the release, and reports them", async () => {
    const frontRuns = [
      created(OWNER, { batchId: OTHER_ID, totalAmount: PAID - 1n, blockNumber: 90n }),
      created(OWNER, { batchId: OTHER_ID, depth: 18, blockNumber: 91n }),
      created(OWNER, { batchId: OTHER_ID, immutableFlag: false, blockNumber: 92n }),
    ]
    const skipped: string[][] = []
    const { client } = fakeClient([...frontRuns, created(OWNER, { blockNumber: 100n })])
    const batch = await findBatch(client, expected, 1n, 100n, (_, problems) => skipped.push(problems))
    expect(batch?.batchId).toBe(BATCH_ID)
    expect(skipped).toEqual([[expect.stringMatching(/^paid /)], ["depth 18 ≠ 17"], ["batch is mutable"]])
  })

  it("accepts a batch someone else paid for if it is at least as good", async () => {
    const { client } = fakeClient([created(OWNER, { batchId: OTHER_ID, totalAmount: PAID * 2n, blockNumber: 90n })])
    expect((await findBatch(client, expected, 1n, 100n))?.batchId).toBe(OTHER_ID)
  })
})

describe("waitForBatch", () => {
  const expected = { owner: OWNER, depth: 17, minTotal: PAID }

  /** A chain that grows by `blocksPerPoll` per lookup, whose RPC fails on the given lookups. */
  function flakyChain(logs: ReturnType<typeof created>[], failOn: number[], blocksPerPoll = 3n) {
    let latest = 99n
    let lookup = 0
    const ranges: [bigint, bigint][] = []
    const client = {
      getBlockNumber: async () => {
        lookup++
        latest += blocksPerPoll
        if (failOn.includes(lookup)) throw new Error("HTTP request failed. Status: 503")
        return latest
      },
      getLogs: async ({ fromBlock, toBlock }: { fromBlock: bigint; toBlock: bigint }) => {
        ranges.push([fromBlock, toBlock])
        return logs.filter((l) => l.blockNumber >= fromBlock && l.blockNumber <= toBlock)
      },
    } as unknown as GnosisClient
    return { client, ranges }
  }
  const noSleep = { sleep: async () => {} }

  it("keeps polling through RPC errors and scans every block exactly once", async () => {
    const { client, ranges } = flakyChain([created(OWNER, { blockNumber: 110n })], [2, 3])
    const errors: unknown[] = []
    const batch = await waitForBatch(client, expected, 100n, { deadline: Infinity, onError: (e) => errors.push(e), ...noSleep })
    expect(batch?.blockNumber).toBe(110n)
    expect(errors).toHaveLength(2)
    expect(ranges).toEqual([[100n, 102n], [103n, 111n]])
  })

  it("gives up at the deadline, even while lookups keep failing", async () => {
    let t = 0
    const { client } = flakyChain([], [1, 2, 3, 4, 5, 6])
    const batch = await waitForBatch(client, expected, 100n, { deadline: 3, now: () => t++, ...noSleep })
    expect(batch).toBeUndefined()
  })
})

describe("batchProblems", () => {
  const batch: BatchInfo = { batchId: BATCH_ID, owner: OWNER, depth: 17, bucketDepth: 16, immutable: true, totalAmount: PAID, transactionHash: "0x", blockNumber: 1n }
  const expected = { owner: OWNER, depth: 17, minTotal: PAID }

  it("accepts the expected immutable, fully paid batch", () => {
    expect(batchProblems(batch, expected)).toEqual([])
  })

  it("names every problem", () => {
    expect(batchProblems({ ...batch, immutable: false }, expected)).toEqual(["batch is mutable"])
    expect(batchProblems(batch, { ...expected, owner: BUYER })[0]).toMatch(/^owner /)
    expect(batchProblems({ ...batch, bucketDepth: 17 }, expected)).toEqual(["bucket depth 17 ≠ 16"])
    expect(batchProblems(batch, { ...expected, minTotal: PAID + 1n })[0]).toMatch(/^paid /)
  })
})

describe("remainingTtl", () => {
  it("converts the remaining per-chunk balance to time at the current price", async () => {
    const { client } = fakeClient([], 0n, { remainingBalance: 142_236n * 17_280n, lastPrice: 142_236n })
    expect((await remainingTtl(client, BATCH_ID)).secondsLeft).toBe(86_400)
  })
})

describe("isBatchGone", () => {
  /** A client whose RPC answers every eth_call the way `respond` says. */
  const clientAnswering = (respond: () => never) =>
    createPublicClient({ chain: gnosis, transport: custom({ request: async ({ method }) => (method === "eth_call" ? respond() : "0x64") }) })
  const lookup = (respond: () => never) => remainingTtl(clientAnswering(respond), BATCH_ID).catch((e: unknown) => e)

  it("recognises PostageStamp's BatchDoesNotExist revert", async () => {
    const reverted = await lookup(() => {
      throw { code: 3, message: "execution reverted", data: toFunctionSelector("BatchDoesNotExist()") }
    })
    expect(isBatchGone(reverted)).toBe(true)
  })

  it("does not mistake RPC failures or other reverts for a missing batch", async () => {
    const failures = [
      await lookup(() => {
        throw new HttpRequestError({ url: "https://rpc.example", status: 503 })
      }),
      await lookup(() => {
        throw new TimeoutError({ body: {}, url: "https://rpc.example" })
      }),
      await lookup(() => {
        throw { code: 3, message: "execution reverted", data: toFunctionSelector("Paused()") }
      }),
    ]
    for (const e of failures) expect(isBatchGone(e)).toBe(false)
    expect(isBatchGone(new Error("BatchDoesNotExist"))).toBe(false)
  })
})
