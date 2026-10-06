// @vitest-environment node
import { describe, it, expect, beforeEach, afterEach } from "vitest"
import { execFileSync } from "node:child_process"
import { mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join, resolve } from "node:path"

// Each case starts a tsx process (1–2 s each on CI runners), so allow more than the 5 s default.
describe("swarm:hash CLI", { timeout: 30_000 }, () => {
  let dir: string
  const run = (...args: string[]) =>
    execFileSync(resolve(__dirname, "../../node_modules/.bin/tsx"), [resolve(__dirname, "../swarm-hash.ts"), ...args], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    })

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "swarm-hash-cli-"))
    writeFileSync(join(dir, "index.html"), "<!doctype html><title>t</title>")
    writeFileSync(join(dir, "app.js"), "console.log(1)")
  })
  afterEach(() => rmSync(dir, { recursive: true, force: true }))

  it("prints only the reference", () => {
    expect(run(dir)).toMatch(/^[0-9a-f]{64}\n$/)
  })

  it("passes options through", () => {
    expect(run(dir, "--error", "404.html")).not.toBe(run(dir))
  })
})
