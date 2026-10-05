#!/usr/bin/env tsx
/**
 * Offline Swarm website hash: computes the root reference Bee/Beeport return
 * when this folder is uploaded as a website, without any upload, wallet,
 * credentials or network access.
 *
 * Usage:
 *   npm run swarm:hash -- ./dist
 *   yarn swarm:hash ./dist --redundancy 2 --verbose
 *
 * Options:
 *   --redundancy <0-4>  Erasure-coding level (default 1 = Medium, see below)
 *   --index <file>      Index document (default "index.html")
 *   --error <file>      Error document (default "error.html")
 *   --no-error          Omit the error document
 *   --order <sorted|apfs>  File insertion order (default "sorted", see below)
 *   --verbose           List every path with its content type and reference (stderr)
 *
 * Prints only the hex root reference on stdout.
 *
 * Reproduced Beeport upload settings (Beeport v1.1.11 → Bee v2.8.1):
 *   - Unencrypted website collection: a tar POSTed to /bzz with
 *     `Swarm-Collection: true` and no `Swarm-Encrypt`.
 *   - Erasure coding: Medium (1) by default. Beeport's "None (Default)" sends
 *     no `swarm-redundancy-level` header, and Bee >= 2.8.1 then applies
 *     Medium. Beeport's Medium/Strong/Insane/Paranoid map to 1/2/3/4. Level 0
 *     only reproduces uploads to a Bee node older than 2.8.1 (or an explicit
 *     `swarm-redundancy-level: 0`).
 *   - `Swarm-Index-Document: index.html` and `Swarm-Error-Document: error.html`.
 *     Beeport always sends the error document header, even when no error.html
 *     exists, so it is part of the manifest by default.
 *   - Content types from Go 1.26's built-in mime table (see swarm/content-type.ts).
 *   - Every regular file in the folder, including dotfiles.
 *   - File order: Bee's manifest trie depends on the order of files in the
 *     upload. The default "sorted" (byte-wise paths) gives the same reference
 *     on every OS. To verify a manual Beeport folder upload made with Chrome
 *     on macOS, use "apfs" (APFS hash order, see swarm/website.ts); uploads
 *     from other OSes or browsers, or of a pre-built tar/zip, may list files
 *     differently and yield a different (equally valid) reference.
 */
import { existsSync, statSync } from "node:fs"
import { resolve } from "node:path"
import { parseArgs } from "node:util"
import type { RedundancyLevel } from "./swarm/file-hash"
import { collectWebsiteFiles, type FileOrder } from "./swarm/collect"
import { hashWebsite } from "./swarm/website"

const LEVEL_NAMES = ["none", "medium", "strong", "insane", "paranoid"]

function fail(message: string): never {
  console.error(`Error: ${message}`)
  process.exit(1)
}

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    redundancy: { type: "string", default: "1" },
    index: { type: "string", default: "index.html" },
    error: { type: "string", default: "error.html" },
    "no-error": { type: "boolean", default: false },
    order: { type: "string", default: "sorted" },
    verbose: { type: "boolean", default: false },
  },
})

if (positionals.length > 1) fail("expected a single directory argument")
const dir = resolve(positionals[0] ?? "dist")
if (!existsSync(dir) || !statSync(dir).isDirectory()) fail(`not a directory: ${dir}`)

const level = Number(values.redundancy)
if (!Number.isInteger(level) || level < 0 || level > 4) fail("--redundancy must be an integer from 0 to 4")

if (values.order !== "sorted" && values.order !== "apfs") fail('--order must be "sorted" or "apfs"')
const order: FileOrder = values.order

const errorDocument = values["no-error"] ? "" : values.error
const files = collectWebsiteFiles(dir, order)
if (!files.some((f) => f.path === values.index)) console.error(`Warning: index document "${values.index}" not found in ${dir}`)

const { reference, entries } = await hashWebsite(files, {
  redundancyLevel: level as RedundancyLevel,
  indexDocument: values.index,
  errorDocument,
})

if (values.verbose) {
  for (const e of entries) console.error(`${e.reference}  ${e.path}  [${e.contentType || "no content type"}]`)
}
console.error(
  `${entries.length} files, unencrypted, erasure coding ${level} (${LEVEL_NAMES[level]}), ` +
    `index "${values.index}", error ${errorDocument ? `"${errorDocument}"` : "none"}, ${order} order`,
)
console.log(reference)
