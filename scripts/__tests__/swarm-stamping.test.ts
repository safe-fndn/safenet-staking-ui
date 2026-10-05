// @vitest-environment node
import { describe, it, expect } from "vitest"
import { keccak256, recoverMessageAddress, toHex } from "viem"
import { privateKeyToAccount } from "viem/accounts"
import type { SwarmChunk } from "../swarm/file-hash"
import {
  bucketOf,
  decodeBundle,
  encodeBundle,
  planDepth,
  stampChunks,
  uniqueChunks,
} from "../swarm/stamping"
import { hex, pseudoRandom } from "./swarm-test-utils"

const KEY = "0x4c0883a69102937d6231471b5dbb6204fe5129617082792ae468d01a3f362318"
const BATCH = "ab".repeat(32)

/** A fake chunk whose address starts with the given bucket. */
function chunkIn(bucket: number, seed: number): SwarmChunk {
  const address = pseudoRandom(32, seed)
  address[0] = bucket >> 8
  address[1] = bucket & 0xff
  return { address, data: pseudoRandom(40, seed), type: "cac" }
}

describe("planDepth", () => {
  it("picks the smallest depth whose buckets hold every chunk", () => {
    expect(planDepth([])).toEqual({ depth: 17, maxBucketFill: 0 })
    expect(planDepth([chunkIn(1, 1), chunkIn(1, 2), chunkIn(2, 3)]).depth).toBe(17)
    expect(planDepth([chunkIn(1, 1), chunkIn(1, 2), chunkIn(1, 3)])).toEqual({ depth: 18, maxBucketFill: 3 })
    expect(planDepth([1, 2, 3, 4, 5].map((s) => chunkIn(7, s))).depth).toBe(19)
  })
})

describe("uniqueChunks", () => {
  it("drops chunks with an address seen before", () => {
    const a = chunkIn(1, 1)
    expect(uniqueChunks([a, chunkIn(2, 2), { ...a }])).toHaveLength(2)
  })
})

describe("stampChunks", () => {
  it("stamps each chunk in its own bucket slot, signed by the batch owner", async () => {
    const chunks = [chunkIn(5, 1), chunkIn(5, 2), chunkIn(9, 3)]
    const stamped = stampChunks(chunks, KEY, BATCH, 17, 1_700_000_000_000)
    const owner = privateKeyToAccount(KEY).address

    const slots = []
    for (const c of stamped) {
      expect(c.stamp).toHaveLength(113)
      expect(hex(c.stamp.subarray(0, 32))).toBe(BATCH)
      const index = Buffer.from(c.stamp.subarray(32, 40))
      expect(index.readUInt32BE(0)).toBe(bucketOf(c.address))
      slots.push(index.readUInt32BE(4))
      const signed = Buffer.concat([c.address, c.stamp.subarray(0, 48)])
      const signer = await recoverMessageAddress({ message: { raw: keccak256(signed) }, signature: toHex(c.stamp.subarray(48)) })
      expect(signer).toBe(owner)
    }
    expect(slots).toEqual([0, 1, 0])
  })

  it("refuses duplicates and overflowing buckets", () => {
    const a = chunkIn(3, 1)
    expect(() => stampChunks([a, { ...a }], KEY, BATCH, 17)).toThrow(/unique/)
    expect(() => stampChunks([1, 2, 3].map((s) => chunkIn(3, s)), KEY, BATCH, 17)).toThrow(/full/)
  })
})

describe("bundle", () => {
  it("round-trips stamped chunks of both types", () => {
    const stamped = stampChunks(
      [chunkIn(1, 1), { ...chunkIn(2, 2), type: "soc", data: pseudoRandom(4201, 9) }],
      KEY,
      BATCH,
      17,
    )
    const decoded = decodeBundle(encodeBundle(stamped))
    expect(decoded.map((c) => [hex(c.address), c.type, hex(c.stamp), hex(c.data)])).toEqual(
      stamped.map((c) => [hex(c.address), c.type, hex(c.stamp), hex(c.data)]),
    )
  })

  it("rejects foreign or damaged bundles", () => {
    const bytes = encodeBundle(stampChunks([chunkIn(1, 1)], KEY, BATCH, 17))
    expect(() => decodeBundle(new Uint8Array(bytes.length))).toThrow(/not a stamped-chunk bundle/)
    expect(() => decodeBundle(bytes.subarray(0, bytes.length - 1))).toThrow(/truncated/)
    expect(() => decodeBundle(Buffer.concat([bytes, Buffer.from([0])]))).toThrow(/trailing/)
  })
})
