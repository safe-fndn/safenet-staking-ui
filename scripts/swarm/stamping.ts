/**
 * Postage stamping for a set of chunks with an immutable batch, plus a compact
 * bundle format so stamped chunks can be re-pushed later without the key.
 *
 * Stamps are signed with core-sdk's `Stamper`. Every unique chunk address is
 * stamped exactly once: each stamp consumes a slot of the address's bucket,
 * and an immutable batch never frees slots.
 */
import { Stamper, convertEnvelopeToMarshaledStamp } from "@ethersphere/core-sdk/stamper"
import type { SwarmChunk } from "./website"

/** Bucket depth used for all batches (PostageStamp `minimumBucketDepth`). */
export const BUCKET_DEPTH = 16
/** Smallest batch depth PostageStamp accepts (`depth > bucketDepth`). */
export const MIN_BATCH_DEPTH = BUCKET_DEPTH + 1
export const STAMP_SIZE = 113

export interface StampedChunk extends SwarmChunk {
  /** `batchId (32) || index (8) || timestamp (8) || signature (65)`, the `Swarm-Postage-Stamp` header. */
  stamp: Uint8Array
}

const hex = (b: Uint8Array) => Buffer.from(b).toString("hex")

/** Deduplicates chunks by address, keeping the first occurrence. */
export function uniqueChunks(chunks: Iterable<SwarmChunk>): SwarmChunk[] {
  const seen = new Map<string, SwarmChunk>()
  for (const c of chunks) if (!seen.has(hex(c.address))) seen.set(hex(c.address), c)
  return [...seen.values()]
}

/** A chunk's bucket: the first 16 bits of its address. */
export const bucketOf = (address: Uint8Array) => (address[0] << 8) | address[1]

/**
 * Smallest batch depth whose buckets can hold every chunk: a depth-d batch has
 * 2^(d-16) slots per bucket, and an immutable batch is full as soon as any one
 * bucket is. Chunks must already be unique.
 */
export function planDepth(chunks: SwarmChunk[]): { depth: number; maxBucketFill: number } {
  const fill = new Uint32Array(1 << BUCKET_DEPTH)
  let maxBucketFill = 0
  for (const c of chunks) maxBucketFill = Math.max(maxBucketFill, ++fill[bucketOf(c.address)])
  let depth = MIN_BATCH_DEPTH
  while (1 << (depth - BUCKET_DEPTH) < maxBucketFill) depth++
  return { depth, maxBucketFill }
}

/**
 * Stamps every chunk once with `privateKey` (the batch owner) for the given
 * immutable batch. Chunks must be unique; throws if a bucket overflows.
 */
export function stampChunks(
  chunks: SwarmChunk[],
  privateKey: string,
  batchId: string,
  depth: number,
  timestampMs = Date.now(),
): StampedChunk[] {
  if (uniqueChunks(chunks).length !== chunks.length) throw new Error("chunks must be unique")
  const stamper = Stamper.fromBlank(privateKey.replace(/^0x/, ""), batchId.replace(/^0x/, ""), depth)
  return chunks.map((c) => ({
    ...c,
    stamp: convertEnvelopeToMarshaledStamp(stamper.stamp(c.address, timestampMs)).toUint8Array(),
  }))
}

// Bundle: "SWB1" || count (u32 BE) || records of
// address (32) || stamp (113) || length (u16 BE) || data.
// Fixed-width fields: decodeBundle can only rely on these sizes, so
// encodeBundle refuses addresses or stamps of any other length.
const MAGIC = Buffer.from("SWB1")
const ADDRESS_SIZE = 32
const STAMP_OFFSET = ADDRESS_SIZE
const LENGTH_OFFSET = STAMP_OFFSET + STAMP_SIZE
const HEADER_SIZE = LENGTH_OFFSET + 2

export function encodeBundle(chunks: StampedChunk[]): Uint8Array {
  const parts: Buffer[] = [MAGIC, Buffer.alloc(4)]
  parts[1].writeUInt32BE(chunks.length)
  for (const c of chunks) {
    if (c.address.length !== ADDRESS_SIZE || c.stamp.length !== STAMP_SIZE) {
      throw new Error(`chunk ${hex(c.address)}: address must be ${ADDRESS_SIZE} bytes and stamp ${STAMP_SIZE} bytes`)
    }
    const header = Buffer.alloc(HEADER_SIZE)
    header.set(c.address, 0)
    header.set(c.stamp, STAMP_OFFSET)
    header.writeUInt16BE(c.data.length, LENGTH_OFFSET)
    parts.push(header, Buffer.from(c.data))
  }
  return Buffer.concat(parts)
}

export function decodeBundle(bytes: Uint8Array): StampedChunk[] {
  const buf = Buffer.from(bytes)
  if (!buf.subarray(0, 4).equals(MAGIC)) throw new Error("not a stamped-chunk bundle")
  const count = buf.readUInt32BE(4)
  const chunks: StampedChunk[] = []
  let offset = 8
  for (let i = 0; i < count; i++) {
    const length = buf.readUInt16BE(offset + LENGTH_OFFSET)
    const dataStart = offset + HEADER_SIZE
    if (dataStart + length > buf.length) throw new Error("truncated bundle")
    chunks.push({
      address: new Uint8Array(buf.subarray(offset, offset + ADDRESS_SIZE)),
      stamp: new Uint8Array(buf.subarray(offset + STAMP_OFFSET, offset + LENGTH_OFFSET)),
      data: new Uint8Array(buf.subarray(dataStart, dataStart + length)),
    })
    offset = dataStart + length
  }
  if (offset !== buf.length) throw new Error("trailing bytes in bundle")
  return chunks
}
