/**
 * Offline reproduction of the Swarm website collection reference that Bee
 * returns for a Beeport folder upload (tar POSTed to /bzz with
 * `Swarm-Collection: true`), following Bee v2.8.1 `storeDir` (pkg/api/dirs.go).
 * Files are added in the order given; see collect.ts for how that order is chosen.
 */
import { contentTypeFor } from "./content-type"
import { hashBytes, type ChunkSink, type RedundancyLevel } from "./file-hash"
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
 * Computes the website collection root reference for `files`, in the given
 * order. `onChunk` receives every chunk of the collection (file contents and
 * manifest nodes), e.g. for uploading; identical files yield duplicate chunks.
 */
export async function hashWebsite(files: WebsiteFile[], options: WebsiteOptions, onChunk?: ChunkSink): Promise<WebsiteHash> {
  if (files.length === 0) throw new Error("no files to hash")
  if (options.indexDocument.includes("/")) throw new Error("index document must not include a slash")

  const root = new MantarayNode()
  const entries: WebsiteEntry[] = []
  for (const file of files) {
    const path = file.path.replace(/^(\.\/)+/, "")
    if (encoder.encode(path).length > 100) throw new Error(`path longer than 100 bytes (Beeport renames these): ${path}`)
    const contentType = contentTypeFor(path)
    const reference = await hashBytes(file.data, options.redundancyLevel, onChunk)
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

  return { reference: toHex(await root.save(options.redundancyLevel, onChunk)), entries }
}
