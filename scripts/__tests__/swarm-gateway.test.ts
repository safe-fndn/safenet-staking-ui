// @vitest-environment node
import { describe, it, expect } from "vitest"
import { createHash } from "node:crypto"
import { gatewayOperator, independentVerifiers, pushChunks, pushToGateways, subdomainUrl, verifyPage, verifyWebsite } from "../swarm/gateway"
import type { StampedChunk } from "../swarm/stamping"
import { hex, pseudoRandom, text } from "./swarm-test-utils"

const sha = (s: string) => createHash("sha256").update(s).digest("hex")

const chunk = (seed: number): StampedChunk => ({
  address: pseudoRandom(32, seed),
  data: pseudoRandom(64, seed),
  stamp: pseudoRandom(113, seed + 100),
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

/** A 200 response whose body breaks off after the headers, like a dropped connection. */
const droppedBody = () =>
  new Response(new ReadableStream({ start: (controller) => controller.error(new Error("connection reset")) }), { status: 200 })

const stored = (c: StampedChunk): Reply => ({ status: 201, body: JSON.stringify({ reference: hex(c.address) }) })
const fast = { retryDelayMs: 1 }

describe("pushToGateways", () => {
  const gateways = ["https://a", "https://b", "https://c"]
  /** A fake push that rejects the gateways in `down`. */
  const fakePush = (down: string[] = []) => {
    const tried: string[] = []
    const push = async (_: StampedChunk[], gw: string) => {
      tried.push(gw)
      if (down.includes(gw)) throw new Error(`${gw} is down`)
    }
    return { push, tried }
  }

  it("stops at the first gateway that accepts every chunk", async () => {
    const { push, tried } = fakePush(["https://a"])
    const r = await pushToGateways([chunk(1)], gateways, { all: false, push })
    expect(tried).toEqual(["https://a", "https://b"])
    expect(r.pushed).toEqual(["https://b"])
    expect(r.failed.map((f) => f.gateway)).toEqual(["https://a"])
    // The failed gateway still counts as uploaded-to for the independence check.
    expect(r.attempted).toEqual(["https://a", "https://b"])
    expect(independentVerifiers(["https://a", "https://c"], r.attempted)).toEqual(["https://c"])
  })

  it("pushes to every gateway with all", async () => {
    const { push, tried } = fakePush()
    const r = await pushToGateways([chunk(1)], gateways, { all: true, push })
    expect(tried).toEqual(gateways)
    expect(r.pushed).toEqual(gateways)
    expect(r.failed).toEqual([])
  })

  it("reports a failed gateway and carries on with the rest", async () => {
    const { push } = fakePush(["https://b"])
    const attempts: string[] = []
    const failures: string[] = []
    const r = await pushToGateways([chunk(1)], gateways, {
      all: true,
      push,
      onAttempt: (gw) => attempts.push(gw),
      onFailure: (gw, e) => failures.push(`${gw}: ${e.message}`),
    })
    expect(attempts).toEqual(gateways)
    expect(r.pushed).toEqual(["https://a", "https://c"])
    expect(failures).toEqual(["https://b: https://b is down"])
  })

  it("skips a gateway canAttempt refuses, checking right before each attempt", async () => {
    const { push, tried } = fakePush(["https://a"])
    const seen: string[][] = []
    const attempted: string[] = []
    const r = await pushToGateways([chunk(1)], gateways, {
      all: false,
      push,
      onAttempt: (gw) => attempted.push(gw),
      // Refuse c once a and b were tried, like the last independent verifier.
      canAttempt: (gw) => {
        seen.push([...attempted])
        return gw !== "https://c" || attempted.length < 2
      },
    })
    expect(tried).toEqual(["https://a", "https://b"])
    expect(r.skipped).toEqual([])
    const { push: push2, tried: tried2 } = fakePush(["https://a", "https://b"])
    const attempted2: string[] = []
    const r2 = await pushToGateways([chunk(1)], gateways, {
      all: false,
      push: push2,
      onAttempt: (gw) => attempted2.push(gw),
      canAttempt: (gw) => gw !== "https://c" || attempted2.length < 2,
    })
    expect(tried2).toEqual(["https://a", "https://b"])
    expect(r2.pushed).toEqual([])
    expect(r2.skipped).toEqual(["https://c"])
    expect(r2.attempted).toEqual(["https://a", "https://b"])
    expect(seen[0]).toEqual([])
  })

  it("returns no pushed gateway when every gateway fails", async () => {
    const { push } = fakePush(gateways)
    const r = await pushToGateways([chunk(1)], gateways, { all: true, push })
    expect(r.pushed).toEqual([])
    expect(r.failed).toHaveLength(3)
  })
})

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

  it("after a failure, takes no more chunks and settles every in-flight request before rejecting", async () => {
    const chunks = Array.from({ length: 12 }, (_, i) => chunk(i + 1))
    const byStamp = new Map(chunks.map((c) => [hex(c.stamp), c]))
    const events: string[] = []
    let inFlight = 0
    const fetch = (async (_url: string, init?: RequestInit) => {
      const c = byStamp.get((init?.headers as Record<string, string>)["Swarm-Postage-Stamp"])!
      const n = chunks.indexOf(c)
      events.push(`start ${n}`)
      inFlight++
      // Chunk 2 fails fast; the others are slow, so they are in flight when it fails.
      await new Promise((r) => setTimeout(r, n === 2 ? 1 : 20))
      inFlight--
      events.push(`end ${n}`)
      return n === 2
        ? new Response('{"message":"stamp signature is invalid"}', { status: 400 })
        : new Response(JSON.stringify({ reference: hex(c.address) }), { status: 201 })
    }) as typeof globalThis.fetch

    await expect(pushChunks(chunks, "https://gw", { ...fast, concurrency: 3, fetch })).rejects.toThrow(/signature is invalid/)
    expect(inFlight).toBe(0)
    const settled = events.length
    await new Promise((r) => setTimeout(r, 50))
    expect(events).toHaveLength(settled) // nothing starts after the rejection
    // Chunks 1 and 3 were in flight with chunk 2 and finished; nothing was started after the failure.
    const failedAt = events.indexOf("end 2")
    expect(events.slice(failedAt + 1).filter((e) => e.startsWith("start"))).toEqual([])
    expect(events.filter((e) => e.startsWith("start")).length).toBeLessThan(chunks.length)
  })

  it("stops retrying once another chunk has failed the gateway", async () => {
    const chunks = [chunk(1), chunk(2), chunk(3)]
    const byStamp = new Map(chunks.map((c) => [hex(c.stamp), c]))
    const { fetch, calls } = fakeFetch((_, call) => {
      const c = byStamp.get(call.stamp!)!
      if (c === chunks[0]) return stored(c)
      if (c === chunks[1]) return { status: 400, body: '{"message":"stamp signature is invalid"}' }
      return { status: 503 } // would be retried up to 5 times
    })
    await expect(pushChunks(chunks, "https://gw", { retryDelayMs: 5, concurrency: 2, fetch })).rejects.toThrow(/signature is invalid/)
    const retries = calls.filter((c) => c.stamp === hex(chunks[2].stamp)).length
    await new Promise((r) => setTimeout(r, 150))
    expect(calls.filter((c) => c.stamp === hex(chunks[2].stamp)).length).toBe(retries) // no retry after rejecting
    expect(retries).toBeLessThan(5)
  })

  it("gives up waiting for the batch after batchWaitMs", async () => {
    const { fetch } = fakeFetch(() => ({ status: 400, body: "invalid batch id" }))
    await expect(pushChunks([chunk(1)], "https://gw", { ...fast, batchWaitMs: 5, fetch })).rejects.toThrow(/invalid batch id/)
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
    expect(await verifyWebsite("ab".repeat(32), files, "https://gw", { ...fast, attempts: 2, fetch })).toEqual(["assets/a b.js"])
    expect(calls.map((c) => c.url)).toContain(`https://gw/bzz/${"ab".repeat(32)}/assets/a%20b.js`)
  })

  it("counts a body that breaks off as a failed file instead of aborting the check", async () => {
    const files = [
      { path: "index.html", sha256: sha("<h1>hi") },
      { path: "app.js", sha256: sha("x") },
    ]
    const fetch = (async (url: string) =>
      url.endsWith("app.js") ? droppedBody() : new Response("<h1>hi", { status: 200 })) as typeof globalThis.fetch
    expect(await verifyWebsite("ab".repeat(32), files, "https://gw", { ...fast, attempts: 1, fetch })).toEqual(["app.js"])
  })

  it("retries until late files arrive", async () => {
    const files = [{ path: "index.html", sha256: sha("<h1>hi") }]
    const { fetch } = fakeFetch((_, __, n) => (n < 2 ? { status: 404 } : { status: 200, body: text("<h1>hi") }))
    expect(await verifyWebsite("ab".repeat(32), files, "https://gw", { ...fast, attempts: 3, fetch })).toEqual([])
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

  it("reports the page itself when its body breaks off, instead of throwing", async () => {
    const fetch = (async () => droppedBody()) as typeof globalThis.fetch
    expect(await verifyPage("https://cid.bzz.limo/", fetch)).toEqual(["https://cid.bzz.limo/"])
  })

  it("reports assets that break, e.g. a /bzz/<ref> URL without trailing slash", async () => {
    const { fetch } = fakeFetch((url) => (url.includes("/bzz/ref") ? { status: 200, body: page } : { status: 400 }))
    expect(await verifyPage("https://gw/bzz/ref", fetch)).toEqual(
      expect.arrayContaining(["https://gw/bzz/assets/app.js", "https://gw/bzz/assets/app.css", "https://gw/bzz/favicon.png"]),
    )
  })
})

describe("independentVerifiers", () => {
  it("excludes a gateway whose upload failed, since it may still have stored the chunks", () => {
    // bzz.limo stored the chunks but sent a malformed 201, so the upload failed; it can still serve them back.
    const attempted = ["https://beeport.xyz", "https://bzz.limo"]
    expect(independentVerifiers(["https://bzz.limo"], attempted)).toEqual([])
  })

  it("treats gateways under one domain as one operator", () => {
    expect(gatewayOperator("https://download.gateway.ethswarm.org")).toBe("ethswarm.org")
    expect(gatewayOperator("https://api.gateway.ethswarm.org/")).toBe("ethswarm.org")
    expect(gatewayOperator("https://bzz.limo")).toBe("bzz.limo")
    // api.gateway.ethswarm.org was pushed to, so download.gateway.ethswarm.org does not count.
    expect(
      independentVerifiers(["https://download.gateway.ethswarm.org", "https://bzz.limo"], ["https://api.gateway.ethswarm.org"]),
    ).toEqual(["https://bzz.limo"])
  })

  it("keeps only verify gateways whose operator was not pushed to", () => {
    expect(independentVerifiers(["https://bzz.limo"], ["https://bzz.limo/"])).toEqual([])
    expect(
      independentVerifiers(["https://download.gateway.ethswarm.org", "https://bzz.limo"], ["https://bzz.limo", "https://beeport.xyz"]),
    ).toEqual(["https://download.gateway.ethswarm.org"])
  })
})

describe("subdomainUrl", () => {
  it("uses the base32 CIDv1 (swarm-manifest, keccak-256) of the reference", () => {
    // Vector computed with multiformats (CID v1, swarm-manifest, keccak-256 multihash, base32).
    expect(subdomainUrl("b358b10b12c89fa7faf88454f949d13579a9d8496c3f39e612cccaffe55a5d3b")).toBe(
      "https://bah5acgzawnmlccyszcp2p6xyqrkpssorgv42twcjnq7ttzqsztfp7zk2lu5q.bzz.limo/",
    )
  })
})
