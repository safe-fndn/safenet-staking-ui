// @vitest-environment node
import { describe, it, expect } from "vitest"
import { spawnSync } from "node:child_process"
import { mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join, resolve } from "node:path"

/** Runs the CLI; every case here fails during argument validation, before any network access. */
function run(...args: string[]) {
  const r = spawnSync(resolve(__dirname, "../../node_modules/.bin/tsx"), [resolve(__dirname, "../deploy-swarm.ts"), ...args], {
    encoding: "utf8",
    env: { ...process.env, SWARM_GNOSIS_RPC_URL: "http://127.0.0.1:9" },
  })
  return { status: r.status, stderr: r.stderr, stdout: r.stdout }
}

// Each case starts one or more tsx processes (1–2 s each on CI runners), so allow more than the 5 s default.
describe("deploy:swarm CLI", { timeout: 30_000 }, () => {
  it("requires an explicit TTL", () => {
    const r = run(resolve(__dirname, ".."))
    expect(r.status).toBe(1)
    expect(r.stderr).toMatch(/--ttl-days <days> is required/)
  })

  it("validates options before touching the network", () => {
    expect(run(".", "--ttl-days", "30", "--redundancy", "7").stderr).toMatch(/--redundancy/)
    expect(run(".", "--ttl-days", "30", "--order", "random").stderr).toMatch(/--order/)
    expect(run("/does/not/exist", "--ttl-days", "30").stderr).toMatch(/not a directory/)
  })

  it("refuses a missing index document", () => {
    const r = run(resolve(__dirname), "--ttl-days", "30")
    expect(r.status).toBe(1)
    expect(r.stderr).toMatch(/index document "index.html" not found/)
  })

  it("resume mode needs a saved release with its metadata", () => {
    expect(run("--push-bundle", "/does/not/exist").stderr).toMatch(/release not found/)
    const dir = mkdtempSync(join(tmpdir(), "swarm-release-"))
    try {
      writeFileSync(join(dir, "bundle.bin"), "")
      const r = run("--push-bundle", dir)
      expect(r.status).toBe(1)
      expect(r.stderr).toMatch(/must contain bundle\.bin and release\.json/)
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })
})
