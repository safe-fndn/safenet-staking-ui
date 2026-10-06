/**
 * Collects the files of a website folder in a defined insertion order. Bee's
 * manifest trie (and so the root reference) depends on that order.
 */
import { lstatSync, readdirSync, readFileSync } from "node:fs"
import { join } from "node:path"
import type { WebsiteFile } from "./website"

const byteCompare = (a: string, b: string) => Buffer.compare(Buffer.from(a), Buffer.from(b))

/**
 * Collects every regular file below `root` (dotfiles included) in byte-wise
 * path order, independent of any filesystem. Nothing is skipped: every file is
 * part of the hash. Symlinks are refused.
 */
export function collectWebsiteFiles(root: string): WebsiteFile[] {
  const files: WebsiteFile[] = []
  const pending = [""]
  while (pending.length > 0) {
    const prefix = pending.pop()!
    const dir = join(root, prefix)
    for (const name of readdirSync(dir)) {
      const rel = prefix + name
      const stat = lstatSync(join(dir, name))
      if (stat.isSymbolicLink()) throw new Error(`symlinks are not supported: ${rel}`)
      if (stat.isDirectory()) pending.push(`${rel}/`)
      else if (stat.isFile()) files.push({ path: rel, data: readFileSync(join(dir, name)) })
    }
  }
  return files.sort((a, b) => byteCompare(a.path, b.path))
}
