/**
 * Release records: one committed JSON file per Swarm release under
 * `releases/swarm/`, so anyone can find a release's batch to top it up and
 * re-check its reference with `swarm:hash`.
 */
import { createHash, randomBytes } from "node:crypto"
import { closeSync, fsyncSync, linkSync, mkdirSync, openSync, readdirSync, readFileSync, renameSync, rmSync, writeFileSync, writeSync } from "node:fs"
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

const isAlive = (pid: number) => {
  try {
    process.kill(pid, 0)
    return true
  } catch (e) {
    // EPERM: the process exists but belongs to someone else.
    return (e as NodeJS.ErrnoException).code === "EPERM"
  }
}

/** Test hooks for lockRelease's takeover steps. */
export interface LockHooks {
  /** Runs after a dead owner was seen, before the takeover mutex is taken. */
  beforeTakeover?: () => void
}

/**
 * Takes the exclusive lock of a saved release, so two runs on one bundle
 * cannot both read release.json and then overwrite each other's upload
 * history. Re-entrant within one process; throws if another live process
 * holds it. Returns the release function, which also runs on exit.
 *
 * Protocol (relies only on atomic link and rename):
 * - A lock is created complete: the PID is written to a private temp file,
 *   which is then hard-linked to `release.lock`. The link fails if the lock
 *   exists, and a lock never exists without its PID, so a new lock is never
 *   mistaken for an empty, stale one.
 * - A lock whose owner is gone (a crashed run) is taken over only under a
 *   second lock, `release.lock.takeover`, created the same way. Holding it,
 *   the taker rereads the owner; only if it is still the dead one does it
 *   atomically rename its own lock over it. A run that saw the dead owner
 *   earlier finds the new, live owner on its reread and stops.
 * - A lock or takeover file that cannot be read as a PID is never removed
 *   automatically.
 */
export function lockRelease(dir: string, pid = process.pid, alive = isAlive, hooks: LockHooks = {}): () => void {
  const path = join(dir, "release.lock")
  const takeoverPath = `${path}.takeover`
  const ownerOf = (file: string): number | undefined => {
    try {
      const value = Number(readFileSync(file, "utf8").trim())
      return Number.isInteger(value) && value > 0 ? value : undefined
    } catch {
      return undefined
    }
  }
  /** Creates `target` holding our PID, atomically and only if it does not exist yet. */
  const createExclusive = (target: string): boolean => {
    const tmp = `${target}.${pid}.${randomBytes(4).toString("hex")}.tmp`
    writeFileSync(tmp, `${pid}\n`, { flag: "wx" })
    try {
      linkSync(tmp, target)
      return true
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code === "EEXIST") return false
      throw e
    } finally {
      rmSync(tmp, { force: true })
    }
  }
  const inUse = (owner: number) => new Error(`${dir} is in use by another run (process ${owner}); wait for it to finish`)
  const unreadable = (file: string) =>
    new Error(`${file} exists but holds no valid PID; if no other run is using ${dir}, delete it and retry`)

  if (!createExclusive(path)) {
    const owner = ownerOf(path)
    if (owner === undefined) throw unreadable(path)
    if (owner !== pid) {
      if (alive(owner)) throw inUse(owner)
      hooks.beforeTakeover?.()
      if (!createExclusive(takeoverPath)) {
        const taker = ownerOf(takeoverPath)
        if (taker !== undefined && taker !== pid && alive(taker)) {
          throw new Error(`another run (process ${taker}) is taking over the lock of ${dir}; retry once it is done`)
        }
        throw new Error(`${takeoverPath} was left by a run that is gone; if no other run is using ${dir}, delete it and retry`)
      }
      try {
        const current = ownerOf(path)
        if (current !== owner) {
          // Replaced meanwhile (or released): never steal a lock we did not see die.
          if (current !== undefined && alive(current)) throw inUse(current)
          throw new Error(`the lock of ${dir} changed while taking it over; retry`)
        }
        const tmp = `${path}.${pid}.${randomBytes(4).toString("hex")}.tmp`
        writeFileSync(tmp, `${pid}\n`, { flag: "wx" })
        renameSync(tmp, path)
      } finally {
        rmSync(takeoverPath, { force: true })
      }
    }
  }

  const release = () => {
    if (ownerOf(path) === pid) rmSync(path, { force: true })
  }
  process.once("exit", release)
  return release
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
