// @vitest-environment node
import { describe, it, expect } from "vitest"
import { createHash } from "node:crypto"
import { pushChunks, subdomainUrl, swarmCid, verifyChunks, verifyPage, verifyWebsite } from "../swarm/gateway"
import type { StampedChunk } from "../swarm/stamping"
import { hex, pseudoRandom, text } from "./swarm-test-utils"

const sha = (s: string) => createHash("sha256").update(s).digest("hex")

const chunk = (seed: number): StampedChunk => ({
  address: pseudoRandom(32, seed),
  data: pseudoRandom(64, seed),
  stamp: pseudoRandom(113, seed + 100),
  type: "cac",
})

type Reply = { status: number; body?: string | Uint8Array }
interface Call {
  url: string
  stamp?: string
}

/** A fake gateway: `handler` decides the reply per request. */
function fakeFetch(handler: (url: string, call: Call, n: number) => Reply) {
  const calls: Call[] = []
  const fetch = (async (url: string, init?: RequestInit) => {
    const call = { url, stamp: (init?.headers as Record<string, string> | undefined)?.["Swarm-Postage-Stamp"] }
    calls.push(call)
    const { status, body = "" } = handler(url, call, calls.length)
    return new Response(status === 201 || status === 200 || status >= 400 ? (typeof body === "string" ? body : Buffer.from(body)) : null, { status })
  }) as typeof globalThis.fetch
  return { fetch, calls }
}

const stored = (c: StampedChunk): Reply => ({ status: 201, body: JSON.stringify({ reference: hex(c.address) }) })
const fast = { retryDelayMs: 1 }

describe("pushChunks", () => {
  it("waits for the batch on the first chunk, then pushes the rest with their own stamps", async () => {
    const chunks = [chunk(1), chunk(2), chunk(3)]
    const byStamp = new Map(chunks.map((c) => [hex(c.stamp), c]))
    const { fetch, calls } = fakeFetch((_, call, n) =>
      n <= 2 ? { status: 400, body: '{"code":400,"message":"invalid batch id"}' } : stored(byStamp.get(call.stamp!)!),
    )
    const progress: number[] = []
    await pushChunks(chunks, "https://gw", { ...fast, fetch, onProgress: (d) => progress.push(d) })

    expect(calls.slice(0, 3).map((c) => c.stamp)).toEqual(Array(3).fill(hex(chunks[0].stamp))) // retried, never re-stamped
    expect(new Set(calls.map((c) => c.stamp))).toEqual(new Set(chunks.map((c) => hex(c.stamp))))
    expect(calls.every((c) => c.url === "https://gw/chunks")).toBe(true)
    expect(progress).toEqual([1, 2, 3])
  })

  it("retries transient gateway errors", async () => {
    const c = chunk(1)
    const { fetch, calls } = fakeFetch((_, __, n) => (n < 3 ? { status: 503 } : stored(c)))
    await pushChunks([c], "https://gw", { ...fast, fetch })
    expect(calls).toHaveLength(3)
  })

  it("fails on rejected stamps and on unexpected references", async () => {
    const rejected = fakeFetch(() => ({ status: 400, body: '{"message":"stamp signature is invalid"}' }))
    await expect(pushChunks([chunk(1)], "https://gw", { ...fast, fetch: rejected.fetch })).rejects.toThrow(/signature is invalid/)
    expect(rejected.calls).toHaveLength(1)

    const wrong = fakeFetch(() => stored(chunk(2)))
    await expect(pushChunks([chunk(1)], "https://gw", { ...fast, fetch: wrong.fetch })).rejects.toThrow(/expected/)
  })

  it("gives up waiting for the batch after batchWaitMs", async () => {
    const { fetch } = fakeFetch(() => ({ status: 400, body: "invalid batch id" }))
    await expect(pushChunks([chunk(1)], "https://gw", { ...fast, batchWaitMs: 5, fetch })).rejects.toThrow(/invalid batch id/)
  })
})

describe("verifyChunks", () => {
  it("reports chunks that stay missing or differ", async () => {
    const [ok, missing, corrupt] = [chunk(1), chunk(2), chunk(3)]
    const { fetch } = fakeFetch((url) => {
      if (url.endsWith(hex(ok.address))) return { status: 200, body: ok.data }
      if (url.endsWith(hex(corrupt.address))) return { status: 200, body: pseudoRandom(64, 99) }
      return { status: 404 }
    })
    expect(await verifyChunks([ok, missing, corrupt], "https://gw", { ...fast, attempts: 2, fetch })).toEqual(
      [missing, corrupt].map((c) => hex(c.address)),
    )
  })

  it("retries until late chunks arrive", async () => {
    const c = chunk(1)
    const { fetch } = fakeFetch((_, __, n) => (n < 2 ? { status: 404 } : { status: 200, body: c.data }))
    expect(await verifyChunks([c], "https://gw", { ...fast, attempts: 3, fetch })).toEqual([])
  })
})

describe("verifyWebsite", () => {
  it("compares the sha256 of every file served under the reference", async () => {
    const files = [
      { path: "index.html", sha256: sha("<h1>hi") },
      { path: "assets/a b.js", sha256: sha("x") },
    ]
    const { fetch, calls } = fakeFetch((url) =>
      url.endsWith("index.html") ? { status: 200, body: text("<h1>hi") } : { status: 200, body: text("tampered") },
    )
    expect(await verifyWebsite("ab".repeat(32), files, "https://gw", fetch)).toEqual(["assets/a b.js"])
    expect(calls.map((c) => c.url)).toContain(`https://gw/bzz/${"ab".repeat(32)}/assets/a%20b.js`)
  })
})

describe("verifyPage", () => {
  const page = `<html><head><link rel="icon" href="./favicon.png"><link href="https://fonts.example/x.css" rel="stylesheet">
    <script type="module" src="./assets/app.js"></script><link rel="stylesheet" href="./assets/app.css"></head></html>`

  it("fetches every relative asset the page references, resolved against the page URL", async () => {
    const { fetch, calls } = fakeFetch((url) => ({ status: 200, body: url.endsWith("/") ? page : "" }))
    expect(await verifyPage("https://cid.bzz.limo/", fetch)).toEqual([])
    expect(calls.map((c) => c.url).sort()).toEqual(
      ["https://cid.bzz.limo/", "https://cid.bzz.limo/assets/app.css", "https://cid.bzz.limo/assets/app.js", "https://cid.bzz.limo/favicon.png"].sort(),
    )
  })

  it("reports assets that break, e.g. a /bzz/<ref> URL without trailing slash", async () => {
    const { fetch } = fakeFetch((url) => (url.includes("/bzz/ref") ? { status: 200, body: page } : { status: 400 }))
    expect(await verifyPage("https://gw/bzz/ref", fetch)).toEqual(
      expect.arrayContaining(["https://gw/bzz/assets/app.js", "https://gw/bzz/assets/app.css", "https://gw/bzz/favicon.png"]),
    )
  })
})

describe("swarmCid", () => {
  it("encodes the reference like multiformats' CID.create(1, 0xfa, keccak-256)", () => {
    // Vector computed with multiformats (CID v1, swarm-manifest, keccak-256 multihash, base32).
    expect(swarmCid("b358b10b12c89fa7faf88454f949d13579a9d8496c3f39e612cccaffe55a5d3b")).toBe(
      "bah5acgzawnmlccyszcp2p6xyqrkpssorgv42twcjnq7ttzqsztfp7zk2lu5q",
    )
    expect(subdomainUrl("00".repeat(32))).toMatch(/^https:\/\/bah5acgza[a-z2-7]+\.bzz\.limo\/$/)
  })
})
