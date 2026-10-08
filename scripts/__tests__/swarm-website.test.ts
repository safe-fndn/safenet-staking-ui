// @vitest-environment node
import { describe, it, expect } from "vitest"
import { calculateChunkAddress } from "@ethersphere/core-sdk/chunk"
import { MantarayNode } from "@ethersphere/core-sdk/mantaray"
import { contentTypeFor } from "../swarm/content-type"
import { hashWebsite, type SwarmChunk, type WebsiteFile, type WebsiteOptions } from "../swarm/website"
import { hex, pseudoRandom, text } from "./swarm-test-utils"

describe("content types", () => {
  it.each([
    ["index.html", "text/html; charset=utf-8"],
    ["assets/app.JS", "text/javascript; charset=utf-8"],
    ["a.css", "text/css; charset=utf-8"],
    ["favicon.ico", "image/vnd.microsoft.icon"],
    ["logo.svg", "image/svg+xml"],
    ["manifest.json", "application/json"],
    ["font.woff2", "font/woff2"],
    [".well-known/security.txt", "text/plain; charset=utf-8"],
  ])("%s → %j", (path, expected) => {
    expect(contentTypeFor(path)).toBe(expected)
  })

  it.each(["image.webp", "noext", "dir.v2/noext", "x.constructor"])("refuses %s instead of guessing", (path) => {
    expect(() => contentTypeFor(path)).toThrow(`no content type for ${path}`)
  })
})

/** Reads a manifest back from its chunks: path → target reference and metadata. */
function readManifest(reference: string, chunks: SwarmChunk[]): Record<string, { reference: string; metadata?: Record<string, string> }> {
  const store = new Map(chunks.map((c) => [hex(c.address), c.data]))
  const load = (address: Uint8Array) => {
    const data = store.get(hex(address))
    if (!data) throw new Error(`missing manifest chunk ${hex(address)}`)
    return MantarayNode.unmarshalFromData(data.subarray(8), address)
  }
  const result: Record<string, { reference: string; metadata?: Record<string, string> }> = {}
  const walk = (node: MantarayNode, prefix: string) => {
    for (const fork of node.forks.values()) {
      const child = load(fork.node.selfAddress!)
      const path = prefix + new TextDecoder().decode(fork.prefix)
      if (fork.node.metadata) result[path] = { reference: hex(child.targetAddress), metadata: fork.node.metadata }
      walk(child, path)
    }
  }
  walk(load(Buffer.from(reference, "hex")), "")
  return result
}

describe("hashWebsite", () => {
  const website: WebsiteOptions = { indexDocument: "index.html", errorDocument: "error.html" }
  const files: WebsiteFile[] = [
    { path: "index.html", data: text("<!doctype html><title>t</title>") },
    { path: "assets/index-abc.js", data: pseudoRandom(20_000) },
    { path: "assets/index-abc.css", data: text("body{}") },
  ]
  const hash = async (options = website, input = files) => (await hashWebsite(input, options)).reference

  it("is pinned: a core-sdk upgrade must not silently change references", async () => {
    expect(await hash()).toBe("26d61bc996f41a5e5b4667a1ae4288b406c1aec4c4c5d7ac289049f683d1d218")
  })

  it("is deterministic", async () => {
    expect(await hash()).toBe(await hash())
  })

  it("changes with the website metadata", async () => {
    const base = await hash()
    expect(await hash({ ...website, errorDocument: "" })).not.toBe(base)
    expect(await hash({ ...website, errorDocument: "404.html" })).not.toBe(base)
    expect(await hash({ ...website, indexDocument: "" })).not.toBe(base)
  })

  it("lists every file with its content type and reference", async () => {
    const { entries } = await hashWebsite(files, website)
    expect(entries.map((e) => [e.path, e.contentType])).toEqual([
      ["index.html", "text/html; charset=utf-8"],
      ["assets/index-abc.js", "text/javascript; charset=utf-8"],
      ["assets/index-abc.css", "text/css; charset=utf-8"],
    ])
    for (const e of entries) expect(e.reference).toMatch(/^[0-9a-f]{64}$/)
  })

  it("rejects an empty website and index documents with a slash", async () => {
    await expect(hash({ ...website, indexDocument: "dir/index.html" })).rejects.toThrow(/slash/)
    await expect(hash(website, [])).rejects.toThrow(/no files/)
  })

  it("emits every chunk, and the manifest resolves every path from them", async () => {
    const input: WebsiteFile[] = [...files, { path: "assets/index-copy.js", data: pseudoRandom(20_000) }]
    const chunks: SwarmChunk[] = []
    const { reference, entries } = await hashWebsite(input, website, (c) => chunks.push(c))
    for (const c of chunks) expect(calculateChunkAddress(c.data).toHex()).toBe(hex(c.address))
    // Identical files produce identical (duplicate) chunks; consumers deduplicate by address.
    expect(new Set(chunks.map((c) => hex(c.address))).size).toBeLessThan(chunks.length)

    const manifest = readManifest(reference, chunks)
    expect(manifest["/"].metadata).toEqual({ "website-index-document": "index.html", "website-error-document": "error.html" })
    for (const e of entries) {
      expect(manifest[e.path]).toEqual({
        reference: e.reference,
        metadata: { "Content-Type": e.contentType, Filename: e.path.split("/").pop() },
      })
    }
    expect(Object.keys(manifest).sort()).toEqual(["/", ...entries.map((e) => e.path)].sort())
  })
})
