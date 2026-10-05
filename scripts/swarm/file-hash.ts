/**
 * Bee-compatible content reference for a byte stream (unencrypted), with an
 * optional erasure-coding (redundancy) level.
 *
 * This mirrors Bee v2.8.1's hash trie (pkg/file/pipeline/hashtrie) and
 * redundancy params (pkg/file/redundancy) step by step, including how a lone
 * "carrier" chunk is lifted to the next level and fed into that level's
 * Reed-Solomon batch. Chunk hashing (BMT), Reed-Solomon parity generation,
 * the parity tables and span level encoding all come from
 * @ethersphere/core-sdk; only the tree bookkeeping lives here, because
 * core-sdk's ChunkSplitter structures erasure-coded trees differently.
 */
import { ChunkBuilder, Uint8ArrayReader, makeReplicas } from "@ethersphere/core-sdk/chunk"
import {
  encodeRedundancyLevel,
  getMaxShards,
  getParities,
  makeErasureBatch,
} from "@ethersphere/core-sdk/erasure-coding"

export type RedundancyLevel = 0 | 1 | 2 | 3 | 4

/**
 * A chunk as uploaded to Bee's `POST /chunks`: its address and wire bytes.
 * Content-addressed chunks ("cac") are `span || payload`; root replicas are
 * single-owner chunks ("soc"): `identifier || signature || span || payload`.
 */
export interface SwarmChunk {
  address: Uint8Array
  data: Uint8Array
  type: "cac" | "soc"
}

/**
 * Receives every chunk produced while hashing: data, intermediate and parity
 * chunks, and — for erasure-coded uploads — the dispersed replicas of the root.
 */
export type ChunkSink = (chunk: SwarmChunk) => void

const CHUNK_SIZE = 4096
const BRANCHES = 128
const MAX_LEVEL = 8
const UINT64_MASK = (1n << 64n) - 1n

interface TrieRef {
  span: bigint
  ref: Uint8Array
  parity: boolean
  /** The chunk behind a non-parity reference, so the root chunk can be replicated. */
  chunk?: ChunkBuilder
}

function makeChunk(span: bigint, payload: Uint8Array): ChunkBuilder {
  const chunk = new ChunkBuilder(span)
  if (payload.length > 0) chunk.writer.write(new Uint8ArrayReader(payload))
  return chunk
}

/** Wire bytes of a chunk: the 8-byte span followed by the first `payloadLength` payload bytes. */
function wireBytes(chunk: ChunkBuilder, payloadLength: number): Uint8Array {
  return chunk.build().subarray(0, 8 + payloadLength)
}

class HashTrie {
  private readonly levels: TrieRef[][] = Array.from({ length: MAX_LEVEL + 1 }, () => [])
  /** Reed-Solomon shard buffers per chunk level (0 = data chunks). */
  private readonly rsBuffers: ChunkBuilder[][] = Array.from({ length: MAX_LEVEL }, () => [])
  private readonly maxShards: number
  private readonly maxChildren: number
  private readonly encodeParities: (batch: { chunk: ChunkBuilder }[]) => Promise<{ chunk: ChunkBuilder }[]>

  constructor(
    private readonly level: RedundancyLevel,
    private readonly onChunk: ChunkSink = () => {},
  ) {
    this.maxShards = level === 0 ? BRANCHES : getMaxShards(level, false)
    this.maxChildren = this.maxShards + (level === 0 ? 0 : getParities(level, this.maxShards, false))
    this.encodeParities = makeErasureBatch(level, false, async () => {})
  }

  async writeData(chunk: ChunkBuilder, payloadLength: number): Promise<void> {
    const ref = chunk.hash().toUint8Array()
    this.onChunk({ address: ref, data: wireBytes(chunk, payloadLength), type: "cac" })
    await this.writeToLevel(1, { span: chunk.span, ref, parity: false, chunk })
    await this.rsWrite(0, chunk)
  }

  private async writeToLevel(level: number, entry: TrieRef): Promise<void> {
    this.levels[level].push(entry)
    if (this.levels[level].length === this.maxChildren) await this.wrapLevel(level)
  }

  private async rsWrite(chunkLevel: number, chunk: ChunkBuilder): Promise<void> {
    if (this.level === 0) return
    this.rsBuffers[chunkLevel].push(chunk)
    if (this.rsBuffers[chunkLevel].length === this.maxShards) await this.rsEncode(chunkLevel)
  }

  private async rsEncode(chunkLevel: number): Promise<void> {
    const shards = this.rsBuffers[chunkLevel]
    if (this.level === 0 || shards.length === 0) return
    this.rsBuffers[chunkLevel] = []
    const parities = await this.encodeParities(shards.map((chunk) => ({ chunk })))
    for (const { chunk } of parities) {
      // Parity chunks always carry a full payload; their "span" is the first 8 bytes of the parity shard.
      const ref = chunk.hash().toUint8Array()
      this.onChunk({ address: ref, data: wireBytes(chunk, CHUNK_SIZE), type: "cac" })
      await this.writeToLevel(chunkLevel + 1, { span: chunk.span, ref, parity: true })
    }
  }

  private async wrapLevel(level: number): Promise<void> {
    const entries = this.levels[level]
    this.levels[level] = []

    // Bee sums the (possibly level-encoded) child spans as raw uint64s, then
    // overwrites the top byte with the redundancy level if parities exist.
    let span = 0n
    for (const e of entries) if (!e.parity) span = (span + e.span) & UINT64_MASK
    if (entries.some((e) => e.parity)) span = encodeRedundancyLevel(span, this.level)

    const payload = new Uint8Array(entries.length * 32)
    entries.forEach((e, i) => payload.set(e.ref, i * 32))
    const chunk = makeChunk(span, payload)
    const ref = chunk.hash().toUint8Array()
    this.onChunk({ address: ref, data: wireBytes(chunk, payload.length), type: "cac" })

    await this.writeToLevel(level + 1, { span, ref, parity: false, chunk })
    await this.rsWrite(level, chunk)
  }

  async sum(): Promise<Uint8Array> {
    for (let i = 1; i < MAX_LEVEL; i++) {
      const count = this.levels[i].length
      if (count === 0) continue
      if (count === 1) {
        // Carrier chunk: lift the single reference unchanged to the next level.
        const [carrier] = this.levels[i]
        this.levels[i] = []
        this.levels[i + 1].push(carrier)
        if (this.level !== 0) {
          const buffered = this.rsBuffers[i - 1]
          if (buffered.length !== 1) throw new Error(`carrier chunk expected 1 buffered shard, got ${buffered.length}`)
          this.rsBuffers[i - 1] = []
          await this.rsWrite(i, buffered[0])
        }
        continue
      }
      await this.rsEncode(i - 1)
      await this.wrapLevel(i)
    }
    if (this.levels[MAX_LEVEL].length !== 1) throw new Error("inconsistent hash trie")
    const root = this.levels[MAX_LEVEL][0]
    // Like Bee's replicas putter: erasure-coded uploads also store dispersed
    // single-owner-chunk replicas of the root (2/4/8/16 for levels 1–4),
    // signed with the well-known replicas key, so the root stays retrievable.
    if (this.level !== 0) {
      for (const r of makeReplicas(root.chunk!, this.level)) {
        this.onChunk({ address: r.address.toUint8Array(), data: r.data, type: "soc" })
      }
    }
    return root.ref
  }
}

/**
 * Root reference of `data` as Bee computes it for an unencrypted upload.
 * `onChunk` receives every chunk of the resulting tree, e.g. for uploading.
 */
export async function hashBytes(data: Uint8Array, level: RedundancyLevel, onChunk?: ChunkSink): Promise<Uint8Array> {
  const trie = new HashTrie(level, onChunk)
  if (data.length === 0) {
    await trie.writeData(makeChunk(0n, data), 0)
  }
  for (let offset = 0; offset < data.length; offset += CHUNK_SIZE) {
    const payload = data.subarray(offset, offset + CHUNK_SIZE)
    await trie.writeData(makeChunk(BigInt(payload.length), payload), payload.length)
  }
  return trie.sum()
}
