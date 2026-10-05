// @vitest-environment node
import { describe, it, expect } from "vitest"
import { encodeForkMetadata, goJsonMarshal, MantarayNode } from "../swarm/mantaray"
import { text } from "./swarm-test-utils"

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
