// @vitest-environment node
import { describe, it, expect, beforeEach, afterEach } from "vitest"
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import {
  lockRelease,
  writeAll,
  writePendingRelease,
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
    pushedVia: ["https://beeport.xyz"],
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

describe("writePendingRelease", () => {
  let dir: string
  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "swarm-pending-"))
  })
  afterEach(() => rmSync(dir, { recursive: true, force: true }))

  it("replaces release.json and leaves no temporary file behind", () => {
    const path = join(dir, "release.json")
    writeFileSync(path, "{}")
    const pending = { draft: { reference: "ab" }, attemptedGateways: ["https://a"] } as unknown as Parameters<typeof writePendingRelease>[1]
    writePendingRelease(path, pending)
    expect(JSON.parse(readFileSync(path, "utf8"))).toEqual(pending)
    expect(readdirSync(dir)).toEqual(["release.json"])
  })

  it("keeps the previous metadata intact when a write fails", () => {
    const path = join(dir, "release.json")
    const original = JSON.stringify({ draft: { reference: "ab" } })
    writeFileSync(path, original)
    // A value JSON cannot encode makes the write fail, like an interrupted one would.
    const broken = { draft: { reference: "ab", size: 1n } } as unknown as Parameters<typeof writePendingRelease>[1]
    expect(() => writePendingRelease(path, broken)).toThrow()
    expect(readFileSync(path, "utf8")).toBe(original)
    expect(readdirSync(dir)).toEqual(["release.json"])
  })

  it("keeps the previous metadata intact when the replacement cannot be written", () => {
    const path = join(dir, "release.json")
    const original = JSON.stringify({ draft: { reference: "ab" } })
    writeFileSync(path, original)
    // A directory where the temporary file goes makes the write itself fail.
    mkdirSync(`${path}.${process.pid}.tmp`)
    const next = { draft: { reference: "cd" } } as unknown as Parameters<typeof writePendingRelease>[1]
    expect(() => writePendingRelease(path, next)).toThrow(/EISDIR/)
    expect(readFileSync(path, "utf8")).toBe(original)
  })
})

describe("writeAll", () => {
  it("keeps writing after short writes until every byte is written", () => {
    const data = new TextEncoder().encode('{"draft":{"reference":"ab"}}\n')
    const out: number[] = []
    // A writer that only ever takes 3 bytes, like a short write.
    const short = (_fd: number, buf: Uint8Array, offset: number, length: number) => {
      const n = Math.min(3, length)
      out.push(...buf.subarray(offset, offset + n))
      return n
    }
    writeAll(0, data, short)
    expect(new Uint8Array(out)).toEqual(data)
  })

  it("fails instead of truncating when a write makes no progress", () => {
    expect(() => writeAll(0, new Uint8Array(10), () => 0)).toThrow(/no progress at byte 0 of 10/)
  })
})

describe("lockRelease", () => {
  let dir: string
  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "swarm-lock-"))
  })
  afterEach(() => rmSync(dir, { recursive: true, force: true }))
  const lockFile = () => join(dir, "release.lock")

  it("gives the lock to one run and refuses a second live one", () => {
    const release = lockRelease(dir, 1001, () => true)
    expect(readFileSync(lockFile(), "utf8").trim()).toBe("1001")
    expect(() => lockRelease(dir, 1002, () => true)).toThrow(/in use by another run \(process 1001\)/)
    release()
    expect(readdirSync(dir)).toEqual([])
    lockRelease(dir, 1002, () => true)
    expect(readFileSync(lockFile(), "utf8").trim()).toBe("1002")
  })

  it("is re-entrant within one process", () => {
    lockRelease(dir, 1001, () => true)
    expect(() => lockRelease(dir, 1001, () => true)).not.toThrow()
  })

  it("takes over a lock whose process is gone", () => {
    writeFileSync(lockFile(), "1001\n")
    lockRelease(dir, 1002, (pid) => pid !== 1001)
    expect(readFileSync(lockFile(), "utf8").trim()).toBe("1002")
    expect(readdirSync(dir)).toEqual(["release.lock"]) // takeover lock and temp files gone
  })

  it("never treats an empty or unreadable lock as stale", () => {
    // E.g. a lock some other tool created without its PID yet: never removed automatically.
    writeFileSync(lockFile(), "")
    expect(() => lockRelease(dir, 1002, () => false)).toThrow(/holds no valid PID/)
    expect(readFileSync(lockFile(), "utf8")).toBe("")
  })

  it("creates the lock with its PID in one step, leaving no temporary files", () => {
    lockRelease(dir, 1001, () => true)
    expect(readdirSync(dir)).toEqual(["release.lock"])
    expect(readFileSync(lockFile(), "utf8")).toBe("1001\n")
  })

  it("does not take over when another run replaced the dead owner's lock meanwhile", () => {
    writeFileSync(lockFile(), "1001\n")
    const alive = (pid: number) => pid !== 1001
    expect(() =>
      lockRelease(dir, 1002, alive, {
        // Between seeing 1001 dead and taking the takeover lock, run 1003 took over.
        beforeTakeover: () => lockRelease(dir, 1003, alive),
      }),
    ).toThrow(/in use by another run \(process 1003\)/)
    expect(readFileSync(lockFile(), "utf8").trim()).toBe("1003")
    expect(readdirSync(dir)).toEqual(["release.lock"])
  })

  it("lets only one of two runs take over a dead owner's lock", () => {
    writeFileSync(lockFile(), "1001\n")
    const alive = (pid: number) => pid !== 1001
    // 1003 is mid-takeover (holds the takeover lock) when 1002 tries.
    writeFileSync(`${lockFile()}.takeover`, "1003\n")
    expect(() => lockRelease(dir, 1002, alive)).toThrow(/another run \(process 1003\) is taking over/)
    expect(readFileSync(lockFile(), "utf8").trim()).toBe("1001")
  })

  it("does not remove a takeover lock left by a crashed run", () => {
    writeFileSync(lockFile(), "1001\n")
    writeFileSync(`${lockFile()}.takeover`, "1004\n")
    const alive = (pid: number) => pid !== 1001 && pid !== 1004
    expect(() => lockRelease(dir, 1002, alive)).toThrow(/was left by a run that is gone; .* delete it/)
    expect(readdirSync(dir).sort()).toEqual(["release.lock", "release.lock.takeover"])
  })

  it("only removes its own lock on release", () => {
    const release = lockRelease(dir, 1001, () => true)
    writeFileSync(lockFile(), "1003\n") // e.g. taken over after this run was presumed dead
    release()
    expect(readFileSync(lockFile(), "utf8").trim()).toBe("1003")
  })
})
