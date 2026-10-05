// @vitest-environment node
import { describe, it, expect, beforeEach, afterEach } from "vitest"
import { execFileSync } from "node:child_process"
import { mkdirSync, mkdtempSync, renameSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { dirname, join } from "node:path"
import { apfsNameKey, collectWebsiteFiles } from "../swarm/collect"
import { hashWebsite, type WebsiteOptions } from "../swarm/website"
import { pseudoRandom } from "./swarm-test-utils"

const website: WebsiteOptions = { redundancyLevel: 1, indexDocument: "index.html", errorDocument: "error.html" }

describe("APFS file order", () => {
  // Regression vectors where APFS order differs from byte order. The ordering
  // itself was checked against a real Beeport folder upload during development.
  it("orders names by APFS filename hash, not by bytes", () => {
    const before = (a: string, b: string) => expect(apfsNameKey(a)).toBeLessThan(apfsNameKey(b))
    before("app-b.css", "app-a.css")
    before("z.png", "y.png")
  })

  it("is case-insensitive", () => {
    expect(apfsNameKey("Index.HTML")).toBe(apfsNameKey("index.html"))
  })
})

describe("collectWebsiteFiles", () => {
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

  it("lists a directory's files before its subdirectories in APFS order, like Chrome", () => {
    const paths = collectWebsiteFiles(dir, "apfs").map((f) => f.path)
    expect(paths.slice(0, 2).sort()).toEqual(["favicon.ico", "index.html"])
    expect(paths.indexOf("assets/fonts/font-latin-wght-normal-ABCDEFGH.woff2")).toBe(paths.length - 1)
  })

  it("includes names containing '..' and refuses them only in Beeport (apfs) order", async () => {
    write("assets/app..js", "a")
    expect(collectWebsiteFiles(dir).map((f) => f.path)).toContain("assets/app..js")
    const before = await hashDir()
    write("assets/app..js", "b")
    expect(await hashDir()).not.toBe(before)
    expect(() => collectWebsiteFiles(dir, "apfs")).toThrow(/Beeport would silently skip these files.*assets\/app\.\.js/)
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
})
