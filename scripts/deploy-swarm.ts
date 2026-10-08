#!/usr/bin/env tsx
/**
 * Publish a website build to Swarm with an ephemeral stamping key and a fresh
 * immutable postage batch bought from a person's wallet. See SWARM_RELEASE.md.
 *
 * Usage:
 *   yarn deploy:swarm ./dist --ttl-days 365
 *   yarn deploy:swarm ./dist --ttl-days 365 --dry-run      # plan and cost only
 *   yarn deploy:swarm --push-bundle swarm-release/<ref>    # resume: push, verify, record — no key needed
 *
 * Flow: hash and chunk the build offline (same code as `swarm:hash`) → print
 * the approve/createBatch parameters for the operator's wallet → wait for the
 * batch on-chain → stamp every chunk once, then drop the key → save the
 * stamped chunks and the release metadata to swarm-release/<ref>/ → push to a
 * gateway → verify chunks, files and the page via other gateways → write
 * releases/swarm/<date>-<ref>.json. If pushing or verifying fails, resume with
 * --push-bundle: it repeats every step after stamping, including the record.
 * Publishing on ENS is done separately.
 *
 * The stamping key never leaves process memory and is never funded.
 * Options: --index, --error (as swarm:hash), --wait-minutes (default 120).
 * Env: SWARM_GNOSIS_RPC_URL, SWARM_PUSH_GATEWAYS, SWARM_VERIFY_GATEWAYS.
 */
import { execFileSync } from "node:child_process"
import { randomBytes } from "node:crypto"
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs"
import { dirname, join, resolve } from "node:path"
import { parseArgs } from "node:util"
import { formatUnits, toHex, type Hex } from "viem"
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts"
import {
  XBZZ_DECIMALS,
  createGnosisClient,
  purchaseCalls,
  quote,
  readPricing,
  remainingTtl,
  waitForBatch,
  type Call,
} from "./swarm/batch"
import { collectWebsiteFiles } from "./swarm/collect"
import { DEFAULT_PUSH_GATEWAYS, DEFAULT_VERIFY_GATEWAYS, pushChunks, subdomainUrl, verifyPage, verifyWebsite } from "./swarm/gateway"
import { completeRelease, fileChecksums, sha256, toolingVersions, type FileChecksum, type PendingRelease } from "./swarm/release"
import { decodeBundle, encodeBundle, planDepth, stampChunks, uniqueChunks, type StampedChunk } from "./swarm/stamping"
import { hashWebsite, type SwarmChunk } from "./swarm/website"

const log = (...lines: string[]) => console.error(lines.join("\n"))
function fail(message: string): never {
  log(`Error: ${message}`)
  process.exit(1)
}
const list = (env: string | undefined, fallback: string[]) => (env ? env.split(",").map((s) => s.trim()).filter(Boolean) : fallback)

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    "ttl-days": { type: "string" },
    index: { type: "string", default: "index.html" },
    error: { type: "string", default: "" },
    "wait-minutes": { type: "string", default: "120" },
    "dry-run": { type: "boolean", default: false },
    "push-bundle": { type: "string" },
  },
})
const pushGateways = list(process.env.SWARM_PUSH_GATEWAYS, DEFAULT_PUSH_GATEWAYS)
const verifyGateways = list(process.env.SWARM_VERIFY_GATEWAYS, DEFAULT_VERIFY_GATEWAYS)

/** Pushes to the first gateway that accepts every chunk, then verifies every file through the others. */
async function pushAndVerify(chunks: StampedChunk[], reference: string, files: FileChecksum[]): Promise<{ pushedVia: string; verifiedVia: string[] }> {
  let pushedVia = ""
  for (const gw of pushGateways) {
    log(`Pushing ${chunks.length} chunks to ${gw} …`)
    try {
      await pushChunks(chunks, gw, { onProgress: (d, t) => d % 100 === 0 && log(`  ${d}/${t}`) })
      pushedVia = gw
      break
    } catch (e) {
      log(`  ${gw} failed: ${(e as Error).message}`)
    }
  }
  if (!pushedVia) fail("no gateway accepted the chunks; resume later with --push-bundle")
  const verifiedVia: string[] = []
  for (const gw of verifyGateways) {
    const bad = await verifyWebsite(reference, files, gw)
    log(`Verify via ${gw}: ${bad.length === 0 ? `all ${files.length} files match` : `${bad.length} files missing or different (e.g. ${bad[0]})`}`)
    if (bad.length === 0) verifiedVia.push(gw)
  }
  if (verifiedVia.length === 0) fail("the files are not retrievable through any verify gateway yet; resume later with --push-bundle")
  return { pushedVia, verifiedVia }
}

/**
 * Push, verify (files, page) and record a stamped release saved in
 * `releaseDir` (bundle.bin + release.json). Used by a fresh release and by
 * --push-bundle, so a resumed release ends up recorded exactly the same way.
 */
async function finish(releaseDir: string): Promise<void> {
  const metaPath = join(releaseDir, "release.json")
  const bundlePath = join(releaseDir, "bundle.bin")
  if (!existsSync(metaPath) || !existsSync(bundlePath)) fail(`${releaseDir} must contain bundle.bin and release.json`)
  const pending = JSON.parse(readFileSync(metaPath, "utf8")) as PendingRelease
  const { draft } = pending
  const bundle = readFileSync(bundlePath)
  if (sha256(bundle) !== draft.bundleSha256) fail(`${bundlePath} does not match ${metaPath}`)
  const chunks = decodeBundle(bundle)
  const { reference } = draft

  const { pushedVia, verifiedVia } = await pushAndVerify(chunks, reference, draft.fileChecksums)
  const page = subdomainUrl(reference)
  const brokenAssets = await verifyPage(page)
  if (brokenAssets.length > 0) log(`Warning: ${page} references assets that do not load:`, ...brokenAssets.map((u) => `  ${u}`))

  const urls = [page, ...verifiedVia.map((gw) => `${gw}/bzz/${reference}/`)]
  const { path: recordPath, expiryError } = await completeRelease(
    pending,
    { pushedVia, verifiedVia, urls },
    async () => (await remainingTtl(createGnosisClient(), draft.batch.id)).expiresAt,
  )
  if (expiryError) log(`Warning: could not read the batch's remaining TTL (${expiryError}); recorded without an expiry. Check with yarn swarm:status.`)
  log(
    "",
    `Published ${reference}`,
    ...urls.map((u) => `  ${u}`),
    `  (path URLs need the trailing slash)`,
    `ENS contenthash (set separately): ${draft.ensContenthash}`,
    `Release record ${recordPath} (commit it)`,
  )
  console.log(reference)
}

const printCall = (step: string, c: Call) =>
  log(
    `${step} — ${c.functionName} on ${c.to}  (https://gnosisscan.io/address/${c.to}#writeContract)`,
    ...Object.entries(c.args).map(([k, v]) => `    ${k.padEnd(24)} ${v}`),
    `    calldata                 ${c.data}`,
  )

async function release(): Promise<void> {
  const ttlDays = Number(values["ttl-days"])
  if (!(ttlDays > 0)) fail("--ttl-days <days> is required (how long the release stays stored before a top-up)")
  const dir = resolve(positionals[0] ?? "dist")
  if (!existsSync(dir) || !statSync(dir).isDirectory()) fail(`not a directory: ${dir}`)
  const settings = {
    order: "sorted",
    indexDocument: values.index,
    errorDocument: values.error,
  }

  // 1. Chunk the build offline.
  const files = collectWebsiteFiles(dir)
  if (!files.some((f) => f.path === settings.indexDocument)) fail(`index document "${settings.indexDocument}" not found in ${dir}`)
  const all: SwarmChunk[] = []
  const { reference } = await hashWebsite(files, settings, (c) => all.push(c))
  const chunks = uniqueChunks(all)
  const { depth, maxBucketFill } = planDepth(chunks)

  // 2. Price the batch.
  const client = createGnosisClient()
  const [pricing, startBlock] = await Promise.all([readPricing(client), client.getBlockNumber()])
  const q = quote(pricing, depth, ttlDays)
  log(
    `Swarm release  ${reference}`,
    `  ${files.length} files, ${chunks.length} chunks, sorted order`,
    `Batch          immutable, depth ${depth} (fullest bucket ${maxBucketFill}/${2 ** (depth - 16)})`,
    `TTL            ≈ ${q.ttlDays.toFixed(1)} days at today's price (${ttlDays} requested + 5% margin for price changes)`,
    `Cost           ${formatUnits(q.total, XBZZ_DECIMALS)} xBZZ + gas  (price ${pricing.price} per chunk per block)`,
  )
  if (values["dry-run"]) return

  // Everything the release record needs that can fail is read now, before anything is spent:
  // after the purchase, the stamping key exists only in this process.
  let git: { commit: string; dirty: boolean }
  try {
    const run = (args: string[]) => execFileSync("git", args, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim()
    git = { commit: run(["rev-parse", "HEAD"]), dirty: run(["status", "--porcelain"]) !== "" }
  } catch {
    fail("run deploy:swarm from a git checkout; the release record stores the commit")
  }
  const tooling = toolingVersions()

  // 3. Ephemeral stamping key (memory only) and the purchase for the operator.
  let key: Hex | undefined = generatePrivateKey()
  const owner = privateKeyToAccount(key).address
  const nonce = toHex(randomBytes(32))
  const calls = purchaseCalls(owner, q, nonce)
  log("", "Send from your wallet on Gnosis Chain (see SWARM_RELEASE.md), as raw integers — never apply ×10¹⁸:")
  printCall("Step 1", calls.approve)
  printCall("Step 2", calls.createBatch)
  log("", `Waiting for the batch owned by ${owner} … (Ctrl-C aborts; nothing is spent until step 2 is mined)`)

  // 4. Wait for the purchase.
  const deadline = Date.now() + Number(values["wait-minutes"]) * 60_000
  // Anyone can create a batch for our owner; those that can't hold the release are skipped.
  // RPC errors only log: the wait continues until the deadline.
  let lastError = ""
  const batch = await waitForBatch(client, { owner, depth, minTotal: q.total }, startBlock, {
    deadline,
    onSkip: (b, problems) => log(`Ignoring batch ${b.batchId} for our key: ${problems.join(", ")} (not the purchase printed above)`),
    onError: (e) => {
      const message = (e as Error).message.split("\n")[0]
      if (message !== lastError) log(`Batch lookup failed, retrying: ${message}`)
      lastError = message
    },
  })
  if (!batch) {
    const hint = lastError ? ` (last lookup error: ${lastError}; consider another SWARM_GNOSIS_RPC_URL)` : ""
    fail(`no matching batch found in time${hint}; rerun to start over with a new key`)
  }
  log(`Batch ${batch.batchId} found in tx ${batch.transactionHash}`)

  // 5. Stamp once, drop the key, save stamped chunks and release metadata before pushing.
  const stamped = stampChunks(chunks, key, batch.batchId, depth)
  key = undefined
  const bundle = encodeBundle(stamped)
  const releaseDir = join("swarm-release", reference)
  mkdirSync(releaseDir, { recursive: true })
  writeFileSync(join(releaseDir, "bundle.bin"), bundle)
  const pending: PendingRelease = {
    draft: {
      reference,
      createdAt: new Date().toISOString(),
      git,
      fileChecksums: fileChecksums(files),
      settings,
      chunks: stamped.length,
      tooling,
      batch: {
        id: batch.batchId,
        depth,
        perChunk: q.perChunk.toString(),
        owner,
        purchaseTx: batch.transactionHash,
        blockNumber: batch.blockNumber.toString(),
      },
      ensContenthash: `bzz://${reference}`,
      bundleSha256: sha256(bundle),
    },
  }
  writeFileSync(join(releaseDir, "release.json"), JSON.stringify(pending, null, 2) + "\n")
  log(`Stamped ${stamped.length} chunks; key discarded; saved to ${releaseDir}/ (resume with --push-bundle ${releaseDir})`)

  // 6. Push, verify, record.
  await finish(releaseDir)
}

/** Resume a stamped release: accepts swarm-release/<ref>/ or its bundle.bin. */
async function resume(path: string): Promise<void> {
  if (!existsSync(path)) fail(`release not found: ${path}`)
  await finish(statSync(path).isDirectory() ? path : dirname(path))
}

await (values["push-bundle"] ? resume(values["push-bundle"]) : release())
