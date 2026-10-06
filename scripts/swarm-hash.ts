#!/usr/bin/env tsx
/**
 * Offline Swarm website hash: computes the root reference `deploy:swarm`
 * uploads for this folder, without any upload, wallet, credentials or
 * network access.
 *
 * Usage:
 *   npm run swarm:hash -- ./dist
 *   yarn swarm:hash ./dist --verbose
 *
 * Options:
 *   --index <file>      Index document (default "index.html")
 *   --error <file>      Error document (default: none)
 *   --verbose           List every path with its content type and reference (stderr)
 *
 * Prints only the hex root reference on stdout. Every regular file is
 * included (dotfiles too) in byte-sorted path order, unencrypted, without
 * erasure coding; see swarm/website.ts.
 */
import { existsSync, statSync } from "node:fs"
import { resolve } from "node:path"
import { parseArgs } from "node:util"
import { collectWebsiteFiles } from "./swarm/collect"
import { hashWebsite } from "./swarm/website"

function fail(message: string): never {
  console.error(`Error: ${message}`)
  process.exit(1)
}

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    index: { type: "string", default: "index.html" },
    error: { type: "string", default: "" },
    verbose: { type: "boolean", default: false },
  },
})

if (positionals.length > 1) fail("expected a single directory argument")
const dir = resolve(positionals[0] ?? "dist")
if (!existsSync(dir) || !statSync(dir).isDirectory()) fail(`not a directory: ${dir}`)

const errorDocument = values.error
const files = collectWebsiteFiles(dir)
if (!files.some((f) => f.path === values.index)) console.error(`Warning: index document "${values.index}" not found in ${dir}`)

const { reference, entries } = await hashWebsite(files, { indexDocument: values.index, errorDocument })

if (values.verbose) {
  for (const e of entries) console.error(`${e.reference}  ${e.path}  [${e.contentType}]`)
}
console.error(
  `${entries.length} files, index "${values.index}", error ${errorDocument ? `"${errorDocument}"` : "none"}, sorted order`,
)
console.log(reference)
