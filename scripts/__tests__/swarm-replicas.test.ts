// @vitest-environment node
import { describe, it, expect } from "vitest"
import { REPLICAS_OWNER, calculateChunkAddress, unmarshalSingleOwnerChunk } from "@ethersphere/core-sdk/chunk"
import { hashBytes, type RedundancyLevel, type SwarmChunk } from "../swarm/file-hash"
import { hashWebsite } from "../swarm/website"
import { hex, pseudoRandom, text } from "./swarm-test-utils"

async function replicasOf(data: Uint8Array, level: RedundancyLevel) {
  const socs: SwarmChunk[] = []
  const reference = hex(await hashBytes(data, level, (c) => c.type === "soc" && socs.push(c)))
  return { reference, socs }
}

describe("root replicas", () => {
  it("emits Bee's replica count per erasure-coding level, none without erasure coding", async () => {
    const counts = []
    for (const level of [0, 1, 2, 3, 4] as const) counts.push((await replicasOf(text("hello"), level)).socs.length)
    expect(counts).toEqual([0, 2, 4, 8, 16])
  })

  it("wraps the root chunk in single-owner chunks signed by the replicas key", async () => {
    for (const data of [text("hello"), pseudoRandom(20_000)]) {
      const { reference, socs } = await replicasOf(data, 2)
      expect(new Set(socs.map((s) => hex(s.address))).size).toBe(socs.length)
      for (const s of socs) {
        const soc = unmarshalSingleOwnerChunk(s.data, s.address)
        expect(hex(soc.owner.toUint8Array())).toBe(hex(REPLICAS_OWNER))
        // The replica carries the root chunk itself, padded like Bee's root data.
        expect(hex(soc.address.toUint8Array())).toBe(hex(s.address))
        expect(s.data.length).toBe(32 + 65 + 8 + 4096)
        expect(hex(calculateChunkAddress(s.data.subarray(97)).toUint8Array())).toBe(reference)
      }
    }
  })

  it("places Medium replicas in distinct neighbourhoods", async () => {
    const { socs } = await replicasOf(pseudoRandom(9000), 1)
    expect(socs.map((s) => s.address[0] >> 7).sort()).toEqual([0, 1])
  })

  it("replicates the root of every file and manifest node of a website", async () => {
    // Small files and nodes are single chunks, so every hashed pipeline yields
    // exactly one content-addressed chunk — and two Medium replicas of it.
    let cac = 0
    let soc = 0
    await hashWebsite(
      [
        { path: "index.html", data: text("<h1>hi") },
        { path: "assets/app.js", data: text("console.log(1)") },
      ],
      { redundancyLevel: 1, indexDocument: "index.html", errorDocument: "error.html" },
      (c) => (c.type === "soc" ? soc++ : cac++),
    )
    expect(cac).toBeGreaterThan(2) // 2 files + manifest nodes
    expect(soc).toBe(2 * cac)
  })
})
