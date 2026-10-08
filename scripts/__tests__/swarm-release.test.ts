// @vitest-environment node
import { describe, it, expect, beforeEach, afterEach } from "vitest"
import { mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import {
  completeRelease,
  fileChecksums,
  readReleases,
  releaseFileName,
  toolingVersions,
  writeRelease,
  type PendingRelease,
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

  describe("completeRelease", () => {
    const done = release("2026-10-06T10:00:00.000Z", "dd".repeat(32))
    const { pushedVia, verifiedVia, urls, ...rest } = done
    const pending: PendingRelease = { draft: { ...rest, batch: { ...rest.batch } } }
    delete (pending.draft.batch as Partial<SwarmRelease["batch"]>).estimatedExpiry
    const upload = { pushedVia, verifiedVia, urls }

    it("records the estimated expiry", async () => {
      const { path, release: r, expiryError } = await completeRelease(pending, upload, async () => new Date("2027-10-06T10:00:00.000Z"), dir)
      expect(expiryError).toBeUndefined()
      expect(r.batch.estimatedExpiry).toBe("2027-10-06T10:00:00.000Z")
      expect(readReleases(dir)).toEqual([r])
      expect(path).toBe(join(dir, releaseFileName(r)))
    })

    it("still writes the record when the expiry lookup fails", async () => {
      const { release: r, expiryError } = await completeRelease(
        pending,
        upload,
        () => Promise.reject(new Error("HTTP request failed.\nURL: https://rpc.gnosischain.com")),
        dir,
      )
      expect(expiryError).toBe("HTTP request failed.")
      expect(r.batch.estimatedExpiry).toBeNull()
      expect(readReleases(dir)).toEqual([{ ...done, batch: { ...done.batch, estimatedExpiry: null } }])
    })
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
