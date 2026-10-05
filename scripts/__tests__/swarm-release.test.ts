// @vitest-environment node
import { describe, it, expect, beforeEach, afterEach } from "vitest"
import { mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { distChecksum, readReleases, releaseFileName, writeRelease, type SwarmRelease } from "../swarm/release"
import { text } from "./swarm-test-utils"

describe("release records", () => {
  let dir: string
  beforeEach(() => (dir = mkdtempSync(join(tmpdir(), "swarm-releases-"))))
  afterEach(() => rmSync(dir, { recursive: true, force: true }))

  const release = (createdAt: string, reference: string): SwarmRelease => ({
    reference,
    createdAt,
    git: { commit: "abc", dirty: false },
    distSha256: "00",
    settings: { order: "sorted", redundancyLevel: 1, indexDocument: "index.html", errorDocument: "error.html" },
    files: 1,
    chunks: 3,
    batch: { id: `0x${"11".repeat(32)}`, depth: 17, perChunk: "1", owner: "0x1", purchaseTx: "0x", blockNumber: "1", estimatedExpiry: createdAt },
    pushedVia: "https://beeport.xyz",
    verifiedVia: [],
    bundleSha256: "00",
  })

  it("writes one file per release and reads them back oldest first", () => {
    const later = release("2026-11-01T10:00:00.000Z", "bb".repeat(32))
    const earlier = release("2026-10-05T10:00:00.000Z", "aa".repeat(32))
    expect(writeRelease(later, dir)).toBe(join(dir, "2026-11-01-bbbbbbbbbbbb.json"))
    writeRelease(earlier, dir)
    expect(releaseFileName(earlier)).toBe("2026-10-05-aaaaaaaaaaaa.json")
    expect(readReleases(dir)).toEqual([earlier, later])
    expect(readReleases(join(dir, "missing"))).toEqual([])
  })

  it("checksums the files independent of order", () => {
    const a = { path: "a.txt", data: text("a") }
    const b = { path: "b/c.txt", data: text("c") }
    expect(distChecksum([a, b])).toBe(distChecksum([b, a]))
    expect(distChecksum([a, b])).not.toBe(distChecksum([a, { ...b, path: "b/d.txt" }]))
  })
})
