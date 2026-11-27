// @vitest-environment node
import { describe, it, expect } from "vitest"
import { execFile, spawnSync } from "node:child_process"
import { createHash } from "node:crypto"
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { createServer, type Server } from "node:http"
import type { AddressInfo } from "node:net"
import { tmpdir } from "node:os"
import { join, resolve } from "node:path"

import { encodeBundle } from "../swarm/stamping"
import { hex, pseudoRandom } from "./swarm-test-utils"

const TSX = resolve(__dirname, "../../node_modules/.bin/tsx")
const CLI = resolve(__dirname, "../deploy-swarm.ts")

/** Runs the CLI; these cases fail during argument validation, before any network access. */
function run(...args: string[]) {
  const r = spawnSync(TSX, [CLI, ...args], {
    encoding: "utf8",
    env: { ...process.env, SWARM_GNOSIS_RPC_URL: "http://127.0.0.1:9" },
  })
  return { status: r.status, stderr: r.stderr, stdout: r.stdout }
}

/** Runs the CLI without blocking the event loop, so in-process fake gateways can answer it. */
function runAsync(env: Record<string, string>, ...args: string[]): Promise<{ code: number | null; stderr: string }> {
  return new Promise((done) => {
    const child = execFile(TSX, [CLI, ...args], { env: { ...process.env, SWARM_GNOSIS_RPC_URL: "http://127.0.0.1:9", ...env } }, (error, _out, stderr) =>
      done({ code: error ? (typeof error.code === "number" ? error.code : 1) : 0, stderr }),
    )
    child.stdin?.end()
  })
}

/** A fake Bee gateway: stores pushed chunks and serves one website file under /bzz. */
function fakeGateway(
  reference: string,
  file: { path: string; body: string },
  { rejectUploads = false } = {},
): Promise<{ server: Server; port: number; uploads: () => number }> {
  let uploads = 0
  const server = createServer((req, res) => {
    if (req.method === "POST" && req.url === "/chunks") {
      uploads++
      if (rejectUploads) {
        res.writeHead(400)
        res.end('{"message":"stamp signature is invalid"}')
        return
      }
      const parts: Buffer[] = []
      req.on("data", (d: Buffer) => parts.push(d))
      req.on("end", () => {
        res.writeHead(201, { "Content-Type": "application/json" })
        res.end(JSON.stringify({ reference: chunkAddress }))
      })
      return
    }
    if (req.url === `/bzz/${reference}/${file.path}`) {
      res.writeHead(200)
      res.end(file.body)
      return
    }
    res.writeHead(404)
    res.end()
  })
  return new Promise((ready) =>
    server.listen(0, "127.0.0.1", () => ready({ server, port: (server.address() as AddressInfo).port, uploads: () => uploads })),
  )
}

const chunk = { address: pseudoRandom(32, 1), data: pseudoRandom(64, 1), stamp: pseudoRandom(113, 101) }
const chunkAddress = hex(chunk.address)

// Each case starts one or more tsx processes (1–2 s each on CI runners), so allow more than the 5 s default.
describe("deploy:swarm CLI", { timeout: 30_000 }, () => {
  it("requires an explicit TTL", () => {
    const r = run(resolve(__dirname, ".."))
    expect(r.status).toBe(1)
    expect(r.stderr).toMatch(/--ttl-days <days> is required/)
  })

  it("validates options before touching the network", () => {
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
      // --push-all is a known option: parsing passes and the same validation fails.
      const all = run("--push-bundle", dir, "--push-all")
      expect(all.status).toBe(1)
      expect(all.stderr).toMatch(/must contain bundle\.bin and release\.json/)
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  it("refuses --push-all when every verify gateway's operator is pushed to, before buying anything", () => {
    const r = run(resolve(__dirname), "--ttl-days", "30", "--push-all")
    expect(r.status).toBe(1)
    expect(r.stderr).toMatch(/--push-all pushes to every operator in SWARM_VERIFY_GATEWAYS \(ethswarm\.org, bzz\.limo\)/)
  })

  it("a resume never counts a gateway uploaded to in an earlier run as an independent verifier", async () => {
    const reference = "ab".repeat(32)
    const file = { path: "index.html", body: "<html></html>" }
    // Two gateways with different operators: "localhost" and "0.1" (from 127.0.0.1).
    // A fails the upload (it may still have stored chunks); B accepts it.
    const a = await fakeGateway(reference, file, { rejectUploads: true })
    const b = await fakeGateway(reference, file)
    const gatewayA = `http://localhost:${a.port}`
    const gatewayB = `http://127.0.0.1:${b.port}`
    const dir = mkdtempSync(join(tmpdir(), "swarm-release-"))
    try {
      const bundle = encodeBundle([chunk])
      writeFileSync(join(dir, "bundle.bin"), bundle)
      const draft = {
        reference,
        bundleSha256: createHash("sha256").update(bundle).digest("hex"),
        fileChecksums: [{ path: file.path, sha256: createHash("sha256").update(file.body).digest("hex") }],
      }
      writeFileSync(join(dir, "release.json"), JSON.stringify({ draft }))

      // Run 1 attempts A (B would stay as the independent verifier), and the upload fails.
      const first = await runAsync({ SWARM_PUSH_GATEWAYS: gatewayA, SWARM_VERIFY_GATEWAYS: `${gatewayA},${gatewayB}` }, "--push-bundle", dir)
      expect(first.code).toBe(1)
      expect(first.stderr).toMatch(/no gateway accepted the chunks/)
      expect(JSON.parse(readFileSync(join(dir, "release.json"), "utf8")).attemptedGateways).toEqual([gatewayA])

      // Run 2 would push to B and read back through A, which serves the files.
      // A was uploaded to in run 1, so it is not independent: B is skipped and nothing is recorded.
      const second = await runAsync({ SWARM_PUSH_GATEWAYS: gatewayB, SWARM_VERIFY_GATEWAYS: gatewayA }, "--push-bundle", dir)
      expect(second.code).toBe(1)
      expect(second.stderr).toContain(`Skipping ${gatewayB}`)
      expect(second.stderr).toContain(`uploads so far: ${gatewayA}`)
      expect(b.uploads()).toBe(0)
    } finally {
      a.server.close()
      b.server.close()
      rmSync(dir, { recursive: true, force: true })
    }
  })

  it("does not fall back to a gateway whose upload would leave no independent verifier", async () => {
    const reference = "cd".repeat(32)
    const file = { path: "index.html", body: "<html></html>" }
    // Like the defaults: A (operator "localhost") rejects the push, then the
    // fallback B (operator "0.1") is also one of only two verify operators.
    const a = await fakeGateway(reference, file, { rejectUploads: true })
    const b = await fakeGateway(reference, file)
    const gatewayA = `http://localhost:${a.port}`
    const gatewayB = `http://127.0.0.1:${b.port}`
    const dir = mkdtempSync(join(tmpdir(), "swarm-release-"))
    try {
      const bundle = encodeBundle([chunk])
      writeFileSync(join(dir, "bundle.bin"), bundle)
      const draft = {
        reference,
        bundleSha256: createHash("sha256").update(bundle).digest("hex"),
        fileChecksums: [{ path: file.path, sha256: createHash("sha256").update(file.body).digest("hex") }],
      }
      writeFileSync(join(dir, "release.json"), JSON.stringify({ draft }))

      const r = await runAsync(
        { SWARM_PUSH_GATEWAYS: `${gatewayA},${gatewayB}`, SWARM_VERIFY_GATEWAYS: `${gatewayA},${gatewayB}` },
        "--push-bundle",
        dir,
      )
      expect(r.code).toBe(1)
      expect(r.stderr).toContain(`Skipping ${gatewayB}`)
      expect(r.stderr).toMatch(/skipped because uploading there would leave no independent verify gateway/)
      expect(b.uploads()).toBe(0) // never uploaded to, so it stays usable as a verifier
      expect(JSON.parse(readFileSync(join(dir, "release.json"), "utf8")).attemptedGateways).toEqual([gatewayA])
    } finally {
      a.server.close()
      b.server.close()
      rmSync(dir, { recursive: true, force: true })
    }
  })
})
