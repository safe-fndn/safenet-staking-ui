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

/** Accept `Swarm-Postage-Stamp` uploads (validated 2026-10-05; bzz.limo 2026-11-03). */
export const DEFAULT_PUSH_GATEWAYS = ["https://beeport.xyz", "https://api.gateway.ethswarm.org", "https://bzz.limo"]
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

/**
 * Runs `task` over `items` with bounded concurrency. After the first failure no
 * worker takes another item, and `task` sees `stopped()` turn true (to skip
 * retries); the failure is rethrown only once every in-flight task has
 * settled, so nothing keeps running after this returns.
 */
async function pool<T>(
  items: T[],
  concurrency: number,
  task: (item: T, stopped: () => boolean) => Promise<void>,
): Promise<void> {
  const queue = [...items]
  let failure: { error: unknown } | undefined
  const stopped = () => failure !== undefined
  await Promise.all(Array.from({ length: Math.min(concurrency, queue.length) }, async () => {
    while (!stopped() && queue.length > 0) {
      try {
        await task(queue.shift()!, stopped)
      } catch (error) {
        failure ??= { error }
      }
    }
  }))
  if (failure) throw failure.error
}

/** Bee's answer while it has not yet seen the batch on-chain. */
const BATCH_NOT_READY = /invalid batch id|batch not usable|batch not found|not yet usable/i

async function pushOne(
  gateway: string,
  chunk: StampedChunk,
  opts: Required<GatewayOptions>,
  batchDeadline: number,
  stopped: () => boolean = () => false,
) {
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
    const rejected = () => new Error(`${gateway} rejected chunk ${hex(chunk.address)}: ${status} ${body.trim().slice(0, 200)}`)
    if (!(batchPending || (retriable && attempt < 5))) throw rejected()
    // Another chunk already failed this gateway: no more requests to it.
    if (stopped()) throw rejected()
    await sleep(opts.retryDelayMs * (batchPending ? 1 : attempt))
    if (stopped()) throw rejected()
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
  // Rejects only after every in-flight request to this gateway has settled,
  // so the next gateway never overlaps with this one.
  await pool(chunks.slice(1), opts.concurrency, async (c, stopped) => {
    await pushOne(gateway, c, opts, 0, stopped)
    step()
  })
}

export interface PushToGatewaysOptions {
  /** Push to every gateway instead of stopping at the first that accepts every chunk. */
  all: boolean
  push?: (chunks: StampedChunk[], gateway: string) => Promise<void>
  /**
   * Whether `gateway` may be tried at all; a gateway it rejects is skipped and
   * reported in `skipped`. Used to never push to the last independent verifier.
   */
  canAttempt?: (gateway: string) => boolean
  onAttempt?: (gateway: string) => void
  onSkip?: (gateway: string) => void
  onFailure?: (gateway: string, error: Error) => void
}

/**
 * Pushes `chunks` to `gateways` in order, one gateway at a time. Without
 * `all` it stops at the first gateway that accepts every chunk; with `all` it
 * tries every gateway. Failures are reported, never thrown. `attempted` lists
 * every gateway an upload was started on, successful or not; `skipped` the
 * ones `canAttempt` refused (checked right before each attempt, so it sees
 * every earlier attempt).
 */
export async function pushToGateways(
  chunks: StampedChunk[],
  gateways: string[],
  { all, push = pushChunks, canAttempt = () => true, onAttempt = () => {}, onSkip = () => {}, onFailure = () => {} }: PushToGatewaysOptions,
): Promise<{ pushed: string[]; failed: { gateway: string; error: Error }[]; attempted: string[]; skipped: string[] }> {
  const attempted: string[] = []
  const skipped: string[] = []
  const pushed: string[] = []
  const failed: { gateway: string; error: Error }[] = []
  for (const gateway of gateways) {
    if (!canAttempt(gateway)) {
      skipped.push(gateway)
      onSkip(gateway)
      continue
    }
    onAttempt(gateway)
    attempted.push(gateway)
    try {
      await push(chunks, gateway)
      pushed.push(gateway)
      if (!all) break
    } catch (e) {
      const error = e instanceof Error ? e : new Error(String(e))
      failed.push({ gateway, error })
      onFailure(gateway, error)
    }
  }
  return { pushed, failed, attempted, skipped }
}

/**
 * The operator a gateway belongs to: the last two labels of its hostname
 * (`download.gateway.ethswarm.org` and `api.gateway.ethswarm.org` are both
 * `ethswarm.org`). Gateways of one operator likely share Bee nodes and their
 * store, so they count as one for independent verification.
 */
export const gatewayOperator = (gateway: string) => new URL(gateway).hostname.split(".").slice(-2).join(".")

/**
 * The gateways in `verifiedVia` whose operator no upload was attempted on.
 * Only these show the release is retrievable from the network rather than
 * from an upload gateway's own store. `attempted` must include failed uploads
 * and uploads of earlier runs of the same release: a gateway can store chunks
 * and still fail the upload (e.g. a malformed 201 reply), and keeps them
 * across runs.
 */
export function independentVerifiers(verifiedVia: string[], attempted: string[]): string[] {
  const uploadedTo = new Set(attempted.map(gatewayOperator))
  return verifiedVia.filter((gw) => !uploadedTo.has(gatewayOperator(gw)))
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
      // The body is read inside the catch too: a connection dropped mid-body fails this file, not the whole check.
      const body = await fetch(url, { redirect: "manual" })
        .then(async (res) => (res.ok ? new Uint8Array(await res.arrayBuffer()) : undefined))
        .catch(() => undefined)
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
  const page = await fetchFn(pageUrl)
    .then(async (res) => (res.ok ? { html: await res.text(), url: res.url || pageUrl } : undefined))
    .catch(() => undefined)
  if (!page) return [pageUrl]
  const refs = [...page.html.matchAll(/<(?:script|link)\b[^>]*?\b(?:src|href)="([^"]+)"/g)].map((m) => m[1])
  const urls = [...new Set(refs.filter((r) => !/^(?:[a-z]+:|\/\/|#)/i.test(r)).map((r) => new URL(r, page.url).href))]
  const failed: string[] = []
  await pool(urls, 8, async (url) => {
    const asset = await fetchFn(url).catch(() => undefined)
    if (!asset?.ok) failed.push(url)
  })
  return failed
}

/** The release served from the root of its own subdomain (CIDv1 swarm-manifest, base32), the most robust way to open it. */
export const subdomainUrl = (reference: string, host = "bzz.limo") => `https://${new Reference(reference).toCid("manifest")}.${host}/`
