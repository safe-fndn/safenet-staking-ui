// @vitest-environment node
import { describe, it, expect } from "vitest"
import { ChunkSplitter, calculateChunkAddress } from "@ethersphere/core-sdk/chunk"
import { hashBytes, type RedundancyLevel, type SwarmChunk } from "../swarm/file-hash"
import { hex, pseudoRandom, text } from "./swarm-test-utils"

/** Content-addressed chunks of `data`; root replicas (SOCs) are covered in swarm-replicas.test.ts. */
async function chunksOf(data: Uint8Array, level: RedundancyLevel) {
  const chunks: SwarmChunk[] = []
  const reference = hex(await hashBytes(data, level, (c) => c.type === "cac" && chunks.push(c)))
  return { reference, chunks }
}

function expectValidWireChunks(chunks: SwarmChunk[]) {
  for (const c of chunks) {
    expect(c.data.length).toBeGreaterThanOrEqual(8)
    expect(c.data.length).toBeLessThanOrEqual(8 + 4096)
    expect(calculateChunkAddress(c.data).toHex()).toBe(hex(c.address))
  }
}

describe("hashBytes", () => {
  it("matches core-sdk's ChunkSplitter without erasure coding", async () => {
    for (const size of [0, 1, 4096, 4097, 128 * 4096, 128 * 4096 + 1, 300_000]) {
      const data = pseudoRandom(size, size + 1)
      const expected = (await ChunkSplitter.root(data)).hash().toHex()
      expect(hex(await hashBytes(data, 0)), `size ${size}`).toBe(expected)
    }
  })

  it("leaves single-chunk data unaffected by erasure coding", async () => {
    const data = pseudoRandom(4096)
    expect(hex(await hashBytes(data, 1))).toBe(hex(await hashBytes(data, 0)))
  })

  it("changes multi-chunk references with the erasure-coding level", async () => {
    const data = pseudoRandom(4097)
    const refs = await Promise.all(([0, 1, 2, 3, 4] as const).map(async (l) => hex(await hashBytes(data, l))))
    expect(new Set(refs).size).toBe(5)
  })

  // Regression pins. The two-level Medium shape (like a 212-chunk image in
  // dist/) is confirmed against a real Beeport upload; the carrier case (one
  // chunk left over after a full 119-shard batch) follows Bee's hashtrie code
  // but has not been checked against a Bee node.
  it("pins a two-level Medium tree", async () => {
    expect(hex(await hashBytes(pseudoRandom(212 * 4096 - 100), 1))).toBe(
      "da0fabd429faff3f4f3308979e872db512332f03fd137edc4eb89b0b1baa415c",
    )
  })

  it("pins a two-level Medium tree with a carrier chunk", async () => {
    expect(hex(await hashBytes(pseudoRandom(120 * 4096), 1))).toBe(
      "7bbf899c0fcc688839212ca5b0d3d7981d46c2f6b6268adf91a99ae3b9ac2fe1",
    )
  })
})

describe("chunk emission", () => {
  it("emits wire chunks whose BMT hash is their address, including the root", async () => {
    for (const level of [0, 1, 2] as const) {
      for (const size of [0, 10, 4096, 4097, 130 * 4096]) {
        const { reference, chunks } = await chunksOf(pseudoRandom(size, size + 3), level)
        expectValidWireChunks(chunks)
        expect(chunks.map((c) => hex(c.address)), `level ${level}, size ${size}`).toContain(reference)
      }
    }
  })

  it("does not change references", async () => {
    const data = pseudoRandom(50_000)
    for (const level of [0, 1, 4] as const) {
      expect((await chunksOf(data, level)).reference).toBe(hex(await hashBytes(data, level)))
    }
  })

  it("emits data, intermediate and parity chunks as Bee does", async () => {
    // Two data chunks: one intermediate root without erasure coding…
    expect((await chunksOf(pseudoRandom(4097), 0)).chunks).toHaveLength(3)
    // …plus Medium's 3 parity chunks for a batch of 2 shards.
    const medium = (await chunksOf(pseudoRandom(4097), 1)).chunks
    expect(medium).toHaveLength(6)
    expect(medium.filter((c) => c.data.length === 8 + 4096)).toHaveLength(4) // full data chunk + 3 parities
    // A single chunk is its own root at any level.
    expect((await chunksOf(text("hello"), 1)).chunks).toHaveLength(1)
  })
})
