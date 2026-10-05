/**
 * Offline reproduction of the Swarm website collection reference that Bee
 * returns for a Beeport folder upload (tar POSTed to /bzz with
 * `Swarm-Collection: true`), following Bee v2.8.1 `storeDir` (pkg/api/dirs.go).
 */
import { lstatSync, readdirSync, readFileSync } from "node:fs"
import { join } from "node:path"
import { contentTypeFor } from "./content-type"
import { hashBytes, type RedundancyLevel } from "./file-hash"
import { MantarayNode } from "./mantaray"

export interface WebsiteFile {
  /** Relative POSIX path inside the collection, e.g. "assets/index.js". */
  path: string
  data: Uint8Array
}

export interface WebsiteOptions {
  redundancyLevel: RedundancyLevel
  /** `Swarm-Index-Document`; empty string to omit. */
  indexDocument: string
  /** `Swarm-Error-Document`; empty string to omit. */
  errorDocument: string
}

export interface WebsiteEntry {
  path: string
  contentType: string
  reference: string
}

export interface WebsiteHash {
  reference: string
  entries: WebsiteEntry[]
}

const encoder = new TextEncoder()
const toHex = (bytes: Uint8Array) => Buffer.from(bytes).toString("hex")

/**
 * Beeport's folder upload rules (FolderUploadUtils.ts): paths come from the
 * browser's webkitRelativePath with the folder name stripped; entries with
 * "//", ".." or a leading "/" are dropped, and paths over 100 bytes are
 * renamed — we refuse those instead of guessing the renamed path.
 */
function isSkippedByBeeport(path: string): boolean {
  return path.includes("//") || path.includes("..") || path.startsWith("/")
}

/**
 * File insertion order. Bee's manifest trie (and so the root reference)
 * depends on the order files appear in the uploaded tar, which for a Beeport
 * folder upload is the browser's FileList order:
 *
 * - "apfs": what Chrome produces when the folder is picked on macOS (APFS,
 *   case-insensitive). Chrome lists each directory's entries in readdir order
 *   — APFS returns them sorted by filename hash — then descends into pending
 *   subdirectories from a stack (last found, first visited).
 * - "sorted": byte-wise path order, independent of any filesystem.
 */
export type FileOrder = "apfs" | "sorted"

const CRC32C_TABLE = (() => {
  const table = new Uint32Array(256)
  for (let i = 0; i < 256; i++) {
    let c = i
    for (let k = 0; k < 8; k++) c = c & 1 ? (c >>> 1) ^ 0x82f63b78 : c >>> 1
    table[i] = c >>> 0
  }
  return table
})()

/**
 * APFS directory-entry sort key (`j_drec_hashed_key.name_len_and_hash`):
 * CRC-32C over the NFD-normalised, case-folded name as UTF-32LE, low 22 bits,
 * shifted above the 10-bit name length (UTF-8 bytes incl. NUL terminator).
 * Case folding uses toLowerCase, which is exact for ASCII names.
 */
export function apfsNameKey(name: string): number {
  let crc = 0xffffffff
  for (const ch of name.normalize("NFD").toLowerCase()) {
    const cp = ch.codePointAt(0)!
    for (const byte of [cp & 0xff, (cp >>> 8) & 0xff, (cp >>> 16) & 0xff, cp >>> 24]) {
      crc = (CRC32C_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8)) >>> 0
    }
  }
  return (crc & 0x3fffff) * 1024 + ((Buffer.byteLength(name) + 1) & 0x3ff)
}

const byteCompare = (a: string, b: string) => Buffer.compare(Buffer.from(a), Buffer.from(b))

/**
 * Collects every regular file below `root` (dotfiles included, as Beeport does
 * not filter them) in the given insertion order.
 */
export function collectWebsiteFiles(root: string, order: FileOrder = "sorted"): WebsiteFile[] {
  const files: WebsiteFile[] = []
  const pending = [""]
  while (pending.length > 0) {
    const prefix = pending.pop()!
    const dir = join(root, prefix)
    const names = readdirSync(dir).sort(
      order === "apfs" ? (a, b) => apfsNameKey(a) - apfsNameKey(b) || byteCompare(a, b) : byteCompare,
    )
    for (const name of names) {
      const rel = prefix + name
      const stat = lstatSync(join(dir, name))
      if (stat.isSymbolicLink()) throw new Error(`symlinks are not supported: ${rel}`)
      if (stat.isDirectory()) pending.push(`${rel}/`)
      else if (stat.isFile()) files.push({ path: rel, data: readFileSync(join(dir, name)) })
    }
  }
  const kept = files.filter((f) => !isSkippedByBeeport(f.path))
  return order === "sorted" ? kept.sort((a, b) => byteCompare(a.path, b.path)) : kept
}

/** Computes the website collection root reference for `files`, in the given order. */
export async function hashWebsite(files: WebsiteFile[], options: WebsiteOptions): Promise<WebsiteHash> {
  if (files.length === 0) throw new Error("no files to hash")
  if (options.indexDocument.includes("/")) throw new Error("index document must not include a slash")

  const root = new MantarayNode()
  const entries: WebsiteEntry[] = []
  for (const file of files) {
    const path = file.path.replace(/^(\.\/)+/, "")
    if (encoder.encode(path).length > 100) throw new Error(`path longer than 100 bytes (Beeport renames these): ${path}`)
    const contentType = contentTypeFor(path)
    const reference = await hashBytes(file.data, options.redundancyLevel)
    root.add(encoder.encode(path), reference, {
      "Content-Type": contentType,
      Filename: path.slice(path.lastIndexOf("/") + 1),
    })
    entries.push({ path, contentType, reference: toHex(reference) })
  }

  const website: Record<string, string> = {}
  if (options.indexDocument) website["website-index-document"] = options.indexDocument
  if (options.errorDocument) website["website-error-document"] = options.errorDocument
  if (Object.keys(website).length > 0) root.add(encoder.encode("/"), new Uint8Array(0), website)

  return { reference: toHex(await root.save(options.redundancyLevel)), entries }
}
