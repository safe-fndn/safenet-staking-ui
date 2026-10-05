// @vitest-environment node
import { describe, it, expect, beforeEach, afterEach } from "vitest"
import { execFileSync } from "node:child_process"
import { mkdirSync, mkdtempSync, renameSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { dirname, join, resolve } from "node:path"
import { ChunkSplitter } from "@ethersphere/core-sdk/chunk"
import { contentTypeFor } from "../swarm/content-type"
import { hashBytes } from "../swarm/file-hash"
import { encodeForkMetadata, goJsonMarshal, MantarayNode } from "../swarm/mantaray"
import { apfsNameKey, collectWebsiteFiles, hashWebsite, type WebsiteFile, type WebsiteOptions } from "../swarm/website"

const text = (s: string) => new TextEncoder().encode(s)
const hex = (b: Uint8Array) => Buffer.from(b).toString("hex")

/** Deterministic pseudo-random bytes (xorshift32). */
function pseudoRandom(length: number, seed = 1): Uint8Array {
  const out = new Uint8Array(length)
  let x = seed
  for (let i = 0; i < length; i++) {
    x ^= x << 13
    x ^= x >>> 17
    x ^= x << 5
    out[i] = x & 0xff
  }
  return out
}

const website: WebsiteOptions = { redundancyLevel: 1, indexDocument: "index.html", errorDocument: "error.html" }

describe("Bee v2.8.1 compatibility (pkg/api/dirs_test.go vectors)", () => {
  // Small single-chunk files, so the reference is the same at every redundancy level.
  const vectors: { name: string; ref: string; files: WebsiteFile[]; index?: string; error?: string }[] = [
    {
      name: "non-nested files without extension",
      ref: "f3312af64715d26b5e1a3dc90f012d2c9cc74a167899dab1d07cdee8c107f939",
      files: [
        { path: "file1", data: text("first file data") },
        { path: "file2", data: text("second file data") },
      ],
    },
    {
      name: "nested files with extension",
      ref: "4c9c76d63856102e54092c38a7cd227d769752d768b7adc8c3542e3dd9fcf295",
      files: [
        { path: "robots.txt", data: text("robots text") },
        { path: "img/1.png", data: text("image 1") },
        { path: "img/2.png", data: text("image 2") },
      ],
    },
    {
      name: "explicit index filename",
      ref: "a58484e3d77bbdb40323ddc9020c6e96e5eb5deb52015d3e0f63cce629ac1aa6",
      files: [{ path: "index.html", data: text("<h1>Swarm") }],
      index: "index.html",
    },
    {
      name: "nested index filename",
      ref: "3e2f008a578c435efa7a1fce146e21c4ae8c20b80fbb4c4e0c1c87ca08fef414",
      files: [{ path: "dir/index.html", data: text("<h1>Swarm") }],
      index: "index.html",
    },
    {
      name: "explicit index and error filename (Beeport's headers)",
      ref: "2cd9a6ac11eefbb71b372fb97c3ef64109c409955964a294fdc183c1014b3844",
      files: [
        { path: "index.html", data: text("<h1>Swarm") },
        { path: "error.html", data: text("<h2>404") },
      ],
      index: "index.html",
      error: "error.html",
    },
    {
      name: "invalid archive paths",
      ref: "133c92414c047708f3d6a8561571a0cc96512899ff0edbd9690c857f01ab6883",
      files: [
        { path: "./index.html", data: text("<h1>Swarm") },
        { path: "./app.css", data: text("body {}") },
        { path: "./robots.txt", data: text("User-agent: *\n\t\tDisallow: /") },
      ],
    },
  ]

  for (const v of vectors) {
    it(v.name, async () => {
      for (const redundancyLevel of [0, 1] as const) {
        const result = await hashWebsite(v.files, {
          redundancyLevel,
          indexDocument: v.index ?? "",
          errorDocument: v.error ?? "",
        })
        expect(result.reference).toBe(v.ref)
      }
    })
  }
})

describe("hashBytes", () => {
  it("matches core-sdk's ChunkSplitter without erasure coding", async () => {
    for (const size of [0, 1, 4096, 4097, 128 * 4096, 128 * 4096 + 1, 300_000]) {
      const data = pseudoRandom(size, size + 1)
      const expected = (await ChunkSplitter.root(data)).hash().toHex()
      expect(hex(await hashBytes(data, 0)), `size ${size}`).toBe(expected)
    }
  })

  it("leaves single-chunk data unaffected by erasure coding", async () => {
    const data = pseudoRandom(4096)
    expect(hex(await hashBytes(data, 1))).toBe(hex(await hashBytes(data, 0)))
  })

  it("changes multi-chunk references with the erasure-coding level", async () => {
    const data = pseudoRandom(4097)
    const refs = await Promise.all(([0, 1, 2, 3, 4] as const).map(async (l) => hex(await hashBytes(data, l))))
    expect(new Set(refs).size).toBe(5)
  })

  // Regression pins. The two-level Medium shape (like a 212-chunk image in
  // dist/) is confirmed against a real Beeport upload; the carrier case (one
  // chunk left over after a full 119-shard batch) follows Bee's hashtrie code
  // but has not been checked against a Bee node.
  it("pins a two-level Medium tree", async () => {
    expect(hex(await hashBytes(pseudoRandom(212 * 4096 - 100), 1))).toBe(
      "da0fabd429faff3f4f3308979e872db512332f03fd137edc4eb89b0b1baa415c",
    )
  })

  it("pins a two-level Medium tree with a carrier chunk", async () => {
    expect(hex(await hashBytes(pseudoRandom(120 * 4096), 1))).toBe(
      "7bbf899c0fcc688839212ca5b0d3d7981d46c2f6b6268adf91a99ae3b9ac2fe1",
    )
  })
})

describe("manifest serialisation", () => {
  it("marshals metadata like Go: sorted keys, HTML-safe escaping", () => {
    expect(goJsonMarshal({ b: "1", a: "<&>" })).toBe('{"a":"\\u003c\\u0026\\u003e","b":"1"}')
  })

  it("pads metadata to 32-byte multiples with Go's extra block on exact multiples", () => {
    // {"k":"<24 chars>"} is 32 bytes of JSON: 34 with the size prefix → padded to 64.
    expect(encodeForkMetadata({ k: "x".repeat(24) }).length).toBe(64)
    // {"k":"<22 chars>"} is 30 bytes: 32 with the size prefix → Bee adds no padding.
    expect(encodeForkMetadata({ k: "x".repeat(22) }).length).toBe(32)
    // {"k":"<54 chars>"} is 62 bytes: 64 with the size prefix → Bee still adds 32.
    const multiple = encodeForkMetadata({ k: "x".repeat(54) })
    expect(multiple.length).toBe(96)
    expect((multiple[0] << 8) | multiple[1]).toBe(94)
    expect(multiple.at(-1)).toBe(0x0a)
  })

  it("sets the path-separator flag from the most recent insert, like Bee", () => {
    const ref = new Uint8Array(32).fill(1)
    const build = (paths: string[]) => {
      const root = new MantarayNode()
      for (const p of paths) root.add(text(p), ref)
      return root.forks.get("i".charCodeAt(0))!.node.type
    }
    expect(build(["index.html", "icons/x.png"])).not.toBe(build(["icons/x.png", "index.html"]))
  })
})

describe("content types (Go 1.26 built-in table)", () => {
  it.each([
    ["index.html", "text/html; charset=utf-8"],
    ["assets/app.JS", "text/javascript; charset=utf-8"],
    ["a.css", "text/css; charset=utf-8"],
    ["favicon.ico", "image/vnd.microsoft.icon"],
    ["logo.svg", "image/svg+xml"],
    ["manifest.json", "application/json"],
    ["font.woff2", ""],
    ["site.webmanifest", ""],
    ["noext", ""],
    ["dir.v2/noext", ""],
  ])("%s → %j", (path, expected) => {
    expect(contentTypeFor(path)).toBe(expected)
  })
})

describe("APFS file order", () => {
  it("orders names by APFS hash as observed in a real Beeport upload", () => {
    const before = (a: string, b: string) => expect(apfsNameKey(a)).toBeLessThan(apfsNameKey(b))
    before("dm-sans-latin-wght-normal-Xz1IZZA0.woff2", "dm-sans-latin-ext-wght-normal-BOFOeGcA.woff2")
    before("vendor-walletconnect-CyH_rl1A.js", "vendor-ui-IvhMQDHF.js")
  })

  it("is case-insensitive", () => {
    expect(apfsNameKey("Index.HTML")).toBe(apfsNameKey("index.html"))
  })
})

describe("website collection", () => {
  let dir: string

  const write = (path: string, content: string | Uint8Array) => {
    mkdirSync(dirname(join(dir, path)), { recursive: true })
    writeFileSync(join(dir, path), content)
  }
  const hashDir = async (options = website, root = dir) =>
    (await hashWebsite(collectWebsiteFiles(root), options)).reference

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "swarm-hash-"))
    write("index.html", "<!doctype html><title>t</title>")
    write("favicon.ico", pseudoRandom(1500))
    write("assets/index-abc.js", pseudoRandom(20_000))
    write("assets/index-abc.css", "body{}")
    write("assets/fonts/font-latin-wght-normal-ABCDEFGH.woff2", pseudoRandom(9000, 7))
  })
  afterEach(() => rmSync(dir, { recursive: true, force: true }))

  it("collects every file, including nested ones, in byte-sorted order by default", () => {
    expect(collectWebsiteFiles(dir).map((f) => f.path)).toEqual([
      "assets/fonts/font-latin-wght-normal-ABCDEFGH.woff2",
      "assets/index-abc.css",
      "assets/index-abc.js",
      "favicon.ico",
      "index.html",
    ])
  })

  it("is deterministic across runs and absolute locations", async () => {
    const first = await hashDir()
    expect(await hashDir()).toBe(first)

    const copy = mkdtempSync(join(tmpdir(), "swarm-hash-copy-"))
    try {
      execFileSync("cp", ["-a", `${dir}/.`, copy])
      expect(await hashDir(website, copy)).toBe(first)
    } finally {
      rmSync(copy, { recursive: true, force: true })
    }
  })

  it("changes when an included file or path changes", async () => {
    const seen = new Set([await hashDir()])
    const expectNew = async (label: string) => {
      const ref = await hashDir()
      expect(seen.has(ref), label).toBe(false)
      seen.add(ref)
    }

    write("assets/index-abc.js", (() => {
      const data = pseudoRandom(20_000)
      data[12_345] ^= 1
      return data
    })())
    await expectNew("one byte changed in a multi-chunk file")

    write("index.html", "<!doctype html><title>T</title>")
    await expectNew("one byte changed in a single-chunk file")

    renameSync(join(dir, "favicon.ico"), join(dir, "favicon2.ico"))
    await expectNew("file renamed")

    renameSync(join(dir, "assets/index-abc.css"), join(dir, "index-abc.css"))
    await expectNew("file moved to another directory")

    write("robots.txt", "User-agent: *")
    await expectNew("file added")

    write(".well-known/security.txt", "Contact: mailto:x@example.org")
    await expectNew("dotfile directory added")

    rmSync(join(dir, "robots.txt"))
    await expectNew("file removed")
  })

  it("changes with the website metadata and erasure-coding level", async () => {
    const base = await hashDir()
    expect(await hashDir({ ...website, errorDocument: "" })).not.toBe(base)
    expect(await hashDir({ ...website, errorDocument: "404.html" })).not.toBe(base)
    expect(await hashDir({ ...website, indexDocument: "" })).not.toBe(base)
    expect(await hashDir({ ...website, redundancyLevel: 0 })).not.toBe(base)
    expect(await hashDir({ ...website, redundancyLevel: 2 })).not.toBe(base)
  })

  it("prints only the reference from the CLI", () => {
    const script = resolve(__dirname, "../swarm-hash.ts")
    const tsx = resolve(__dirname, "../../node_modules/.bin/tsx")
    const stdout = execFileSync(tsx, [script, dir], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] })
    expect(stdout).toMatch(/^[0-9a-f]{64}\n$/)
  })
})
