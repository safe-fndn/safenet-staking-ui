/**
 * Release records: one committed JSON file per Swarm release under
 * `releases/swarm/`, so anyone can find a release's batch to top it up and
 * re-check its reference with `swarm:hash`.
 */
import { createHash } from "node:crypto"
import { closeSync, fsyncSync, mkdirSync, openSync, readdirSync, readFileSync, renameSync, rmSync, writeFileSync, writeSync } from "node:fs"
import { join } from "node:path"
import type { Hex } from "viem"

export const RELEASES_DIR = "releases/swarm"

export interface SwarmRelease {
  reference: string
  createdAt: string
  git: { commit: string; dirty: boolean }
  /** sha256 of every uploaded file, sorted by path. */
  fileChecksums: FileChecksum[]
  settings: { order: string; indexDocument: string; errorDocument: string }
  chunks: number
  tooling: Tooling
  batch: {
    id: Hex
    depth: number
    perChunk: string
    owner: string
    purchaseTx: Hex
    blockNumber: string
    /**
     * At upload time and price; extend with `topUp(id, amountPerChunk)` from
     * any account. Null if the lookup failed then; `swarm:status` reads it live.
     */
    estimatedExpiry: string | null
  }
  /** Gateways that accepted every chunk, in push order (several with --push-all). */
  pushedVia: string[]
  verifiedVia: string[]
  /** Where to open the release: its own subdomain first, then `<gateway>/bzz/<reference>/`. */
  urls: string[]
  /** ENS contenthash value for this release. Setting it is a separate, manual step. */
  ensContenthash: string
  bundleSha256: string
}

export interface FileChecksum {
  path: string
  sha256: string
}

export interface Tooling {
  node: string
  "@ethersphere/core-sdk": string
  viem: string
}

export const sha256 = (data: Uint8Array) => createHash("sha256").update(data).digest("hex")

/** Per-file checksums, sorted by path (byte-wise). */
export function fileChecksums(files: { path: string; data: Uint8Array }[]): FileChecksum[] {
  return files
    .map((f) => ({ path: f.path, sha256: sha256(f.data) }))
    .sort((a, b) => Buffer.compare(Buffer.from(a.path), Buffer.from(b.path)))
}

const packageVersion = (name: string): string =>
  (JSON.parse(readFileSync(new URL(`../../node_modules/${name}/package.json`, import.meta.url), "utf8")) as { version: string }).version

/** Versions of the tooling that computed and stamped the chunks. */
export function toolingVersions(): Tooling {
  return {
    node: process.version,
    "@ethersphere/core-sdk": packageVersion("@ethersphere/core-sdk"),
    viem: packageVersion("viem"),
  }
}

/**
 * Everything needed to finish a release without the key. Saved as
 * `swarm-release/<ref>/release.json` next to the bundle before pushing.
 */
export interface PendingRelease {
  /** The release record, minus what pushing and verifying determine. */
  draft: Omit<SwarmRelease, "pushedVia" | "verifiedVia" | "urls" | "batch"> & {
    batch: Omit<SwarmRelease["batch"], "estimatedExpiry">
  }
  /**
   * Every gateway an upload of this bundle was ever started on, across runs
   * (fresh release and every --push-bundle resume). Saved before each upload
   * starts, so a gateway that kept chunks from an earlier run never counts as
   * an independent verifier later. Missing in bundles saved by older tooling.
   */
  attemptedGateways?: string[]
}

/**
 * Writes all of `data` to `fd`. `writeSync` may write fewer bytes than asked
 * (a short write); this loops until everything is written, and fails on a
 * write that makes no progress instead of silently truncating.
 */
export function writeAll(fd: number, data: Uint8Array, write: (fd: number, data: Uint8Array, offset: number, length: number) => number = writeSync): void {
  for (let offset = 0; offset < data.length; ) {
    const written = write(fd, data, offset, data.length - offset)
    if (!(written > 0)) throw new Error(`write made no progress at byte ${offset} of ${data.length}`)
    offset += written
  }
}

/**
 * Writes `release.json` of a saved release atomically: to a temporary file in
 * the same directory, flushed to disk, then renamed over the original. An
 * interrupted write leaves the previous metadata intact, so the stamped bundle
 * stays resumable.
 */
export function writePendingRelease(path: string, pending: PendingRelease): void {
  const data = Buffer.from(JSON.stringify(pending, null, 2) + "\n")
  const tmp = `${path}.${process.pid}.tmp`
  try {
    const fd = openSync(tmp, "w")
    try {
      writeAll(fd, data)
      fsyncSync(fd)
    } finally {
      closeSync(fd)
    }
    renameSync(tmp, path)
  } catch (e) {
    try {
      rmSync(tmp, { force: true })
    } catch {
      // Cleanup is best effort; the original error is what matters.
    }
    throw e
  }
}

/**
 * Writes the final record of a pushed and verified release. A failing expiry
 * lookup never prevents the record: the content is live and the batch must
 * show up in `swarm:status`, so the expiry is then recorded as null.
 */
export async function completeRelease(
  { draft }: PendingRelease,
  upload: Pick<SwarmRelease, "pushedVia" | "verifiedVia" | "urls">,
  expiresAt: () => Promise<Date>,
  dir = RELEASES_DIR,
): Promise<{ path: string; release: SwarmRelease; expiryError?: string }> {
  let estimatedExpiry: string | null = null
  let expiryError: string | undefined
  try {
    estimatedExpiry = (await expiresAt()).toISOString()
  } catch (e) {
    expiryError = (e as Error).message.split("\n")[0]
  }
  const release: SwarmRelease = { ...draft, batch: { ...draft.batch, estimatedExpiry }, ...upload }
  return { path: writeRelease(release, dir), release, expiryError }
}

export function releaseFileName(release: SwarmRelease): string {
  return `${release.createdAt.slice(0, 10)}-${release.reference.slice(0, 12)}.json`
}

export function writeRelease(release: SwarmRelease, dir = RELEASES_DIR): string {
  mkdirSync(dir, { recursive: true })
  const path = join(dir, releaseFileName(release))
  writeFileSync(path, JSON.stringify(release, null, 2) + "\n")
  return path
}

/** All recorded releases, oldest first. */
export function readReleases(dir = RELEASES_DIR): SwarmRelease[] {
  let names: string[]
  try {
    names = readdirSync(dir).filter((n) => n.endsWith(".json")).sort()
  } catch {
    return []
  }
  return names.map((n) => JSON.parse(readFileSync(join(dir, n), "utf8")) as SwarmRelease)
}
