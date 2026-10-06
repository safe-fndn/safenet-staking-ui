/**
 * Pushing pre-stamped chunks to public Bee gateways and verifying retrieval.
 *
 * Gateways only relay: they cannot alter content (chunks are content- or
 * owner-addressed) and they validate our stamps instead of replacing them.
 * Chunks are pushed with the stamp they were signed with — never re-stamped,
 * since every stamp consumes a slot of the immutable batch.
 */
import { createHash } from "node:crypto"
import { Reference } from "@ethersphere/core-sdk/bytes"
import type { StampedChunk } from "./stamping"

/** Accept `Swarm-Postage-Stamp` uploads (validated 2026-10-05). */
export const DEFAULT_PUSH_GATEWAYS = ["https://beeport.xyz", "https://api.gateway.ethswarm.org"]
/** Serve chunks and websites; api.gateway.ethswarm.org refuses to serve this app's content. */
export const DEFAULT_VERIFY_GATEWAYS = ["https://download.gateway.ethswarm.org", "https://bzz.limo"]

export interface GatewayOptions {
  concurrency?: number
  /** How long to wait for a freshly bought batch to become usable on the gateway. */
  batchWaitMs?: number
  retryDelayMs?: number
  fetch?: typeof fetch
  onProgress?: (done: number, total: number) => void
}

const hex = (b: Uint8Array) => Buffer.from(b).toString("hex")
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

/** Runs `task` over `items` with bounded concurrency. */
async function pool<T>(items: T[], concurrency: number, task: (item: T) => Promise<void>): Promise<void> {
  const queue = [...items]
  await Promise.all(Array.from({ length: Math.min(concurrency, queue.length) }, async () => {
    while (queue.length > 0) await task(queue.shift()!)
  }))
}

/** Bee's answer while it has not yet seen the batch on-chain. */
const BATCH_NOT_READY = /invalid batch id|batch not usable|batch not found|not yet usable/i

async function pushOne(gateway: string, chunk: StampedChunk, opts: Required<GatewayOptions>, batchDeadline: number) {
  for (let attempt = 1; ; attempt++) {
    let status = 0
    let body = ""
    try {
      const res = await opts.fetch(`${gateway}/chunks`, {
        method: "POST",
        headers: { "Content-Type": "application/octet-stream", "Swarm-Postage-Stamp": hex(chunk.stamp) },
        body: Buffer.from(chunk.data),
        redirect: "manual",
      })
      status = res.status
      body = await res.text()
    } catch (e) {
      body = String(e)
    }
    if (status === 201) {
      const reference = (JSON.parse(body) as { reference?: string }).reference
      if (reference !== hex(chunk.address)) throw new Error(`${gateway} stored ${reference}, expected ${hex(chunk.address)}`)
      return
    }
    const retriable = status === 0 || status === 429 || status >= 500
    const batchPending = status === 400 && BATCH_NOT_READY.test(body) && Date.now() < batchDeadline
    if (!(batchPending || (retriable && attempt < 5))) {
      throw new Error(`${gateway} rejected chunk ${hex(chunk.address)}: ${status} ${body.trim().slice(0, 200)}`)
    }
    await sleep(opts.retryDelayMs * (batchPending ? 1 : attempt))
  }
}

/**
 * Pushes every chunk to `gateway`. The first chunk is pushed alone, waiting
 * (up to `batchWaitMs`) until the gateway has picked up the new batch; the
 * rest follow concurrently.
 */
export async function pushChunks(chunks: StampedChunk[], gateway: string, options: GatewayOptions = {}): Promise<void> {
  const opts: Required<GatewayOptions> = {
    concurrency: 8,
    batchWaitMs: 20 * 60_000,
    retryDelayMs: 15_000,
    fetch: globalThis.fetch,
    onProgress: () => {},
    ...options,
  }
  if (chunks.length === 0) return
  let done = 0
  const step = () => opts.onProgress(++done, chunks.length)
  await pushOne(gateway, chunks[0], opts, Date.now() + opts.batchWaitMs)
  step()
  await pool(chunks.slice(1), opts.concurrency, async (c) => {
    await pushOne(gateway, c, opts, 0)
    step()
  })
}

const sha256 = (data: Uint8Array) => createHash("sha256").update(data).digest("hex")

/**
 * Fetches every file of the website through `gateway`'s `/bzz` endpoint and
 * compares its sha256, which also retrieves every manifest and data chunk.
 * Retries the failures up to `attempts` times (freshly pushed chunks can take
 * a moment to spread); returns the paths that stay missing or differ.
 */
export async function verifyWebsite(
  reference: string,
  files: { path: string; sha256: string }[],
  gateway: string,
  options: GatewayOptions & { attempts?: number } = {},
): Promise<string[]> {
  const { concurrency = 8, retryDelayMs = 15_000, attempts = 4, fetch = globalThis.fetch } = options
  let pending = files
  for (let attempt = 1; attempt <= attempts && pending.length > 0; attempt++) {
    if (attempt > 1) await sleep(retryDelayMs)
    const failed: typeof files = []
    await pool(pending, concurrency, async (f) => {
      const url = `${gateway}/bzz/${reference}/${f.path.split("/").map(encodeURIComponent).join("/")}`
      const res = await fetch(url, { redirect: "manual" }).catch(() => undefined)
      const body = res?.ok ? new Uint8Array(await res.arrayBuffer()) : undefined
      if (!body || sha256(body) !== f.sha256) failed.push(f)
    })
    pending = failed
  }
  return pending.map((f) => f.path)
}

/**
 * Loads `pageUrl` like a browser would and fetches every script, stylesheet,
 * icon and manifest it references (resolved against the page URL). Returns the
 * URLs that fail — e.g. assets that only resolve with a trailing slash.
 */
export async function verifyPage(pageUrl: string, fetchFn: typeof fetch = globalThis.fetch): Promise<string[]> {
  const res = await fetchFn(pageUrl).catch(() => undefined)
  if (!res?.ok) return [pageUrl]
  const html = await res.text()
  const refs = [...html.matchAll(/<(?:script|link)\b[^>]*?\b(?:src|href)="([^"]+)"/g)].map((m) => m[1])
  const urls = [...new Set(refs.filter((r) => !/^(?:[a-z]+:|\/\/|#)/i.test(r)).map((r) => new URL(r, res.url || pageUrl).href))]
  const failed: string[] = []
  await pool(urls, 8, async (url) => {
    const asset = await fetchFn(url).catch(() => undefined)
    if (!asset?.ok) failed.push(url)
  })
  return failed
}

/** The release served from the root of its own subdomain (CIDv1 swarm-manifest, base32), the most robust way to open it. */
export const subdomainUrl = (reference: string, host = "bzz.limo") => `https://${new Reference(reference).toCid("manifest")}.${host}/`
