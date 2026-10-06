/**
 * Offline Swarm website collection: chunks every file and builds the
 * manifest with core-sdk (`ChunkSplitter`, `MantarayNode`). No erasure
 * coding, no encryption.
 *
 * The reference is fully determined by the files, their order (see
 * collect.ts) and the index/error documents: manifest nodes use a zero
 * obfuscation key instead of core-sdk's random default.
 */
import { ChunkSplitter, type ChunkBuilder } from "@ethersphere/core-sdk/chunk"
import { MantarayNode } from "@ethersphere/core-sdk/mantaray"
import { contentTypeFor } from "./content-type"

export interface WebsiteFile {
  /** Relative POSIX path inside the collection, e.g. "assets/index.js". */
  path: string
  data: Uint8Array
}

export interface WebsiteOptions {
  /** `website-index-document`; empty string to omit. */
  indexDocument: string
  /** `website-error-document`; empty string to omit. */
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

/** A content-addressed chunk: `data` is span (8 bytes) || payload. */
export interface SwarmChunk {
  address: Uint8Array
  data: Uint8Array
}

export type ChunkSink = (chunk: SwarmChunk) => void

const toHex = (bytes: Uint8Array) => Buffer.from(bytes).toString("hex")
const ZERO_KEY = new Uint8Array(32)

function zeroObfuscationKeys(node: MantarayNode): void {
  node.obfuscationKey = ZERO_KEY
  for (const fork of node.forks.values()) zeroObfuscationKeys(fork.node)
}

/**
 * Computes the website collection root reference for `files`, in the given
 * order. `onChunk` receives every chunk of the collection (file contents and
 * manifest nodes), e.g. for uploading; identical files yield duplicate chunks.
 */
export async function hashWebsite(files: WebsiteFile[], options: WebsiteOptions, onChunk?: ChunkSink): Promise<WebsiteHash> {
  if (files.length === 0) throw new Error("no files to hash")
  if (options.indexDocument.includes("/")) throw new Error("index document must not include a slash")

  const emit = (chunk: ChunkBuilder) => onChunk?.({ address: chunk.hash().toUint8Array(), data: chunk.build() })
  const root = new MantarayNode()
  const entries: WebsiteEntry[] = []
  for (const file of files) {
    const splitter = new ChunkSplitter(async (batch) => {
      for (const { chunk } of batch) emit(chunk)
      return []
    })
    await splitter.append(file.data)
    const rootChunk = await splitter.finalize()
    emit(rootChunk)
    const reference = rootChunk.hash().toUint8Array()
    const contentType = contentTypeFor(file.path)
    root.addFork(file.path, reference, {
      "Content-Type": contentType,
      Filename: file.path.slice(file.path.lastIndexOf("/") + 1),
    })
    entries.push({ path: file.path, contentType, reference: toHex(reference) })
  }

  const website: Record<string, string> = {}
  if (options.indexDocument) website["website-index-document"] = options.indexDocument
  if (options.errorDocument) website["website-error-document"] = options.errorDocument
  if (Object.keys(website).length > 0) root.addFork("/", ZERO_KEY, website)

  zeroObfuscationKeys(root)
  const { reference } = await root.saveRecursively(async (chunk) => emit(chunk))
  return { reference: toHex(reference), entries }
}
