/**
 * Collects the files of a website folder in a defined insertion order. Bee's
 * manifest trie (and so the root reference) depends on that order.
 */
import { lstatSync, readdirSync, readFileSync } from "node:fs"
import { join } from "node:path"
import type { WebsiteFile } from "./website"

/**
 * Beeport's folder upload (FolderUploadUtils.ts) silently drops paths that
 * contain "..", e.g. a file named `app..js` (a directory listing never yields
 * "//", a leading "/" or real ".." segments). Such a folder cannot be
 * reproduced as a Beeport upload, so `apfs` order refuses it explicitly.
 * Paths over 100 bytes, which Beeport renames, are refused by `hashWebsite`.
 */
function droppedByBeeport(path: string): boolean {
  return path.includes("..")
}

/**
 * File insertion order:
 *
 * - "sorted": byte-wise path order, independent of any filesystem.
 * - "apfs": what a Beeport folder upload produces when the folder is picked in
 *   Chrome on macOS (APFS, case-insensitive). Beeport keeps the browser's
 *   FileList order; Chrome lists each directory's entries in readdir order —
 *   APFS returns them sorted by filename hash — then descends into pending
 *   subdirectories from a stack (last found, first visited).
 */
export type FileOrder = "sorted" | "apfs"

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
 * Collects every regular file below `root` (dotfiles included) in the given
 * insertion order. Nothing is skipped: every file is part of the hash.
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
  if (order === "apfs") {
    const dropped = files.filter((f) => droppedByBeeport(f.path)).map((f) => f.path)
    if (dropped.length > 0) throw new Error(`Beeport would silently skip these files, so "apfs" order cannot reproduce the upload: ${dropped.join(", ")}`)
    return files
  }
  return files.sort((a, b) => byteCompare(a.path, b.path))
}
