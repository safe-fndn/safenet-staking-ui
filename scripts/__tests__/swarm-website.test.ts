// @vitest-environment node
import { describe, it, expect } from "vitest"
import { calculateChunkAddress } from "@ethersphere/core-sdk/chunk"
import { contentTypeFor } from "../swarm/content-type"
import type { SwarmChunk } from "../swarm/file-hash"
import { hashWebsite, type WebsiteFile, type WebsiteOptions } from "../swarm/website"
import { hex, pseudoRandom, text } from "./swarm-test-utils"

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

describe("hashWebsite", () => {
  const website: WebsiteOptions = { redundancyLevel: 1, indexDocument: "index.html", errorDocument: "error.html" }
  const files: WebsiteFile[] = [
    { path: "index.html", data: text("<!doctype html><title>t</title>") },
    { path: "assets/index-abc.js", data: pseudoRandom(20_000) },
    { path: "assets/index-abc.css", data: text("body{}") },
  ]
  const hash = async (options = website, input = files) => (await hashWebsite(input, options)).reference

  it("changes with the website metadata and erasure-coding level", async () => {
    const base = await hash()
    expect(await hash({ ...website, errorDocument: "" })).not.toBe(base)
    expect(await hash({ ...website, errorDocument: "404.html" })).not.toBe(base)
    expect(await hash({ ...website, indexDocument: "" })).not.toBe(base)
    expect(await hash({ ...website, redundancyLevel: 0 })).not.toBe(base)
    expect(await hash({ ...website, redundancyLevel: 2 })).not.toBe(base)
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

  it("rejects paths Beeport would rename and index documents with a slash", async () => {
    await expect(hash(website, [{ path: `${"a".repeat(101)}.html`, data: text("x") }])).rejects.toThrow(/100 bytes/)
    await expect(hash({ ...website, indexDocument: "dir/index.html" })).rejects.toThrow(/slash/)
    await expect(hash(website, [])).rejects.toThrow(/no files/)
  })

  it("emits every file and manifest node chunk of a website", async () => {
    const files: WebsiteFile[] = [
      { path: "index.html", data: text("<h1>hi") },
      { path: "assets/app.js", data: pseudoRandom(9000) },
      { path: "assets/app-copy.js", data: pseudoRandom(9000) },
    ]
    const chunks: SwarmChunk[] = []
    const { reference, entries } = await hashWebsite(
      files,
      { redundancyLevel: 1, indexDocument: "index.html", errorDocument: "" },
      (c) => chunks.push(c),
    )
    for (const c of chunks) expect(calculateChunkAddress(c.data).toHex()).toBe(hex(c.address))
    const addresses = chunks.map((c) => hex(c.address))
    expect(addresses).toContain(reference)
    for (const e of entries) expect(addresses).toContain(e.reference)
    // Identical files produce identical (duplicate) chunks; consumers deduplicate by address.
    expect(new Set(addresses).size).toBeLessThan(addresses.length)
  })
})
