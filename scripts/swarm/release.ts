/**
 * Release records: one committed JSON file per Swarm release under
 * `releases/swarm/`, so anyone can find a release's batch to top it up and
 * re-check its reference with `swarm:hash`.
 */
import { createHash } from "node:crypto"
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs"
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
  pushedVia: string
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
