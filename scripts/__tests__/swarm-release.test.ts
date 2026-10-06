// @vitest-environment node
import { describe, it, expect, beforeEach, afterEach } from "vitest"
import { mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import {
  fileChecksums,
  readReleases,
  releaseFileName,
  toolingVersions,
  writeRelease,
  type SwarmRelease,
} from "../swarm/release"
import { text } from "./swarm-test-utils"

describe("release records", () => {
  let dir: string
  beforeEach(() => (dir = mkdtempSync(join(tmpdir(), "swarm-releases-"))))
  afterEach(() => rmSync(dir, { recursive: true, force: true }))

  const release = (createdAt: string, reference: string): SwarmRelease => ({
    reference,
    createdAt,
    git: { commit: "abc", dirty: false },
    fileChecksums: [{ path: "index.html", sha256: "00" }],
    settings: { order: "sorted", indexDocument: "index.html", errorDocument: "" },
    chunks: 3,
    tooling: { node: "v22.0.0", "@ethersphere/core-sdk": "0.2.1", viem: "2.46.2" },
    batch: { id: `0x${"11".repeat(32)}`, depth: 17, perChunk: "1", owner: "0x1", purchaseTx: "0x", blockNumber: "1", estimatedExpiry: createdAt },
    pushedVia: "https://beeport.xyz",
    verifiedVia: [],
    urls: [`https://bah5qcgzaexample.bzz.limo/`],
    ensContenthash: `bzz://${reference}`,
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

  it("round-trips a release whose expiry lookup failed", () => {
    const r = release("2026-10-06T10:00:00.000Z", "cc".repeat(32))
    r.batch.estimatedExpiry = null
    writeRelease(r, dir)
    expect(readReleases(dir)).toEqual([r])
  })

  it("checksums every file, independent of order", () => {
    const a = { path: "a.txt", data: text("a") }
    const b = { path: "b/c.txt", data: text("c") }
    expect(fileChecksums([a, b])).not.toEqual(fileChecksums([a, { ...b, path: "b/d.txt" }]))
    expect(fileChecksums([b, a])).toEqual(fileChecksums([a, b]))
    expect(fileChecksums([b, a]).map((f) => f.path)).toEqual(["a.txt", "b/c.txt"])
    expect(fileChecksums([a])[0].sha256).toMatch(/^[0-9a-f]{64}$/)
  })

  it("reports the installed tooling versions", () => {
    const tooling = toolingVersions()
    expect(tooling.node).toBe(process.version)
    expect(tooling["@ethersphere/core-sdk"]).toMatch(/^\d+\.\d+\.\d+/)
    expect(tooling.viem).toMatch(/^\d+\.\d+\.\d+/)
  })
})
