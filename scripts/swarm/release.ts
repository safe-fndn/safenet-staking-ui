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
  /** sha256 over the sorted `sha256  path` lines of the uploaded files. */
  distSha256: string
  settings: { order: string; redundancyLevel: number; indexDocument: string; errorDocument: string }
  files: number
  chunks: number
  batch: {
    id: Hex
    depth: number
    perChunk: string
    owner: string
    purchaseTx: Hex
    blockNumber: string
    /** At upload time and price; extend with `topUp(id, amountPerChunk)` from any account. */
    estimatedExpiry: string
  }
  pushedVia: string
  verifiedVia: string[]
  bundleSha256: string
}

export const sha256 = (data: Uint8Array) => createHash("sha256").update(data).digest("hex")

/** Checksum of a set of files, independent of their order. */
export function distChecksum(files: { path: string; data: Uint8Array }[]): string {
  const lines = files.map((f) => `${sha256(f.data)}  ${f.path}`).sort()
  return sha256(Buffer.from(lines.join("\n") + "\n"))
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
