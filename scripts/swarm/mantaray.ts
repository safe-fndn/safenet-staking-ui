/**
 * Bee-compatible Mantaray manifest trie (unencrypted), ported from Bee v2.8.1
 * pkg/manifest/mantaray/{node,marshal,persist}.go.
 *
 * core-sdk's MantarayNode is not used for building or serialising because it
 * differs from Bee in ways that change the root reference: random obfuscation
 * keys, refBytesSize=0 for entry-less nodes, insertion-ordered unescaped JSON
 * metadata without Go's padding quirk, and different path-separator flag and
 * long-prefix splitting rules. Node chunks are still hashed with core-sdk
 * primitives via `hashBytes`, and the version hash with core-sdk's keccak256.
 */
import { keccak256 } from "@ethersphere/core-sdk/crypto"
import { hashBytes, type RedundancyLevel } from "./file-hash"

const OBFUSCATION_KEY_SIZE = 32
const VERSION_HASH_SIZE = 31
const PREFIX_MAX_SIZE = 30
const PATH_SEPARATOR = 0x2f

const TYPE_VALUE = 2
const TYPE_EDGE = 4
const TYPE_WITH_PATH_SEPARATOR = 8
const TYPE_WITH_METADATA = 16

const VERSION_02_HASH = keccak256(new TextEncoder().encode("mantaray:0.2")).slice(0, VERSION_HASH_SIZE)

/** Go's `json.Marshal` for map[string]string: sorted keys, HTML-safe escaping. */
export function goJsonMarshal(map: Record<string, string>): string {
  const keys = Object.keys(map).sort((a, b) => (a < b ? -1 : a > b ? 1 : 0))
  return `{${keys.map((k) => `${goJsonString(k)}:${goJsonString(map[k])}`).join(",")}}`
}

function goJsonString(s: string): string {
  let out = '"'
  for (const ch of s) {
    const code = ch.codePointAt(0)!
    if (ch === '"') out += '\\"'
    else if (ch === "\\") out += "\\\\"
    else if (ch === "\n") out += "\\n"
    else if (ch === "\r") out += "\\r"
    else if (ch === "\t") out += "\\t"
    else if (ch === "\b") out += "\\b"
    else if (ch === "\f") out += "\\f"
    else if (code < 0x20 || ch === "<" || ch === ">" || ch === "&" || code === 0x2028 || code === 0x2029) {
      out += `\\u${code.toString(16).padStart(4, "0")}`
    } else if (code >= 0xd800 && code <= 0xdfff) out += "\\ufffd" // lone surrogate → invalid UTF-8
    else out += ch
  }
  return out + '"'
}

/**
 * Fork metadata bytes: 2-byte big-endian length, then JSON padded with "\n".
 * Like Bee, a total that is already a multiple of 32 (and > 32) still gets a
 * full extra 32 bytes of padding.
 */
export function encodeForkMetadata(metadata: Record<string, string>): Uint8Array {
  const json = new TextEncoder().encode(goJsonMarshal(metadata))
  const withSize = json.length + 2
  let padding = 0
  if (withSize < OBFUSCATION_KEY_SIZE) padding = OBFUSCATION_KEY_SIZE - withSize
  else if (withSize > OBFUSCATION_KEY_SIZE) padding = OBFUSCATION_KEY_SIZE - (withSize % OBFUSCATION_KEY_SIZE)
  const size = json.length + padding
  if (size > 0xffff) throw new Error("metadata too large")
  const out = new Uint8Array(2 + size).fill(0x0a, 2 + json.length)
  out[0] = size >> 8
  out[1] = size & 0xff
  out.set(json, 2)
  return out
}

function commonPrefix(a: Uint8Array, b: Uint8Array): Uint8Array {
  let i = 0
  while (i < a.length && i < b.length && a[i] === b[i]) i++
  return a.subarray(0, i)
}

interface Fork {
  prefix: Uint8Array
  node: MantarayNode
}

export class MantarayNode {
  type = 0
  refBytesSize = 0
  entry: Uint8Array = new Uint8Array(0)
  metadata: Record<string, string> | undefined
  forks = new Map<number, Fork>()

  private updateIsWithPathSeparator(path: Uint8Array): void {
    if (path.indexOf(PATH_SEPARATOR) > 0) this.type |= TYPE_WITH_PATH_SEPARATOR
    else this.type &= ~TYPE_WITH_PATH_SEPARATOR
  }

  private child(): MantarayNode {
    const nn = new MantarayNode()
    nn.refBytesSize = this.refBytesSize
    return nn
  }

  /** Port of Bee's `Node.Add`, including its order-dependent flag updates. */
  add(path: Uint8Array, entry: Uint8Array, metadata?: Record<string, string>): void {
    if (this.refBytesSize === 0) {
      if (entry.length > 256) throw new Error(`node entry size > 256: ${entry.length}`)
      if (entry.length > 0) this.refBytesSize = entry.length
    } else if (entry.length > 0 && this.refBytesSize !== entry.length) {
      throw new Error(`invalid entry size: ${entry.length}, expected: ${this.refBytesSize}`)
    }

    const hasMetadata = metadata !== undefined && Object.keys(metadata).length > 0

    if (path.length === 0) {
      this.entry = entry
      this.type |= TYPE_VALUE
      if (hasMetadata) {
        this.metadata = metadata
        this.type |= TYPE_WITH_METADATA
      }
      return
    }

    const f = this.forks.get(path[0])
    if (!f) {
      const nn = this.child()
      if (path.length > PREFIX_MAX_SIZE) {
        const prefix = path.subarray(0, PREFIX_MAX_SIZE)
        nn.add(path.subarray(PREFIX_MAX_SIZE), entry, metadata)
        nn.updateIsWithPathSeparator(prefix)
        this.forks.set(path[0], { prefix, node: nn })
        this.type |= TYPE_EDGE
        return
      }
      nn.entry = entry
      if (hasMetadata) {
        nn.metadata = metadata
        nn.type |= TYPE_WITH_METADATA
      }
      nn.type |= TYPE_VALUE
      nn.updateIsWithPathSeparator(path)
      this.forks.set(path[0], { prefix: path, node: nn })
      this.type |= TYPE_EDGE
      return
    }

    const c = commonPrefix(f.prefix, path)
    const rest = f.prefix.subarray(c.length)
    let nn = f.node
    if (rest.length > 0) {
      nn = this.child()
      f.node.updateIsWithPathSeparator(rest)
      nn.forks.set(rest[0], { prefix: rest, node: f.node })
      nn.type |= TYPE_EDGE
      if (path.length === c.length) nn.type |= TYPE_VALUE
    }
    nn.updateIsWithPathSeparator(path)
    nn.add(path.subarray(c.length), entry, metadata)
    this.forks.set(path[0], { prefix: c, node: nn })
    this.type |= TYPE_EDGE
  }

  /** Port of Bee's `MarshalBinary` with the zero obfuscation key (XOR is a no-op). */
  marshal(childRefs: Map<number, Uint8Array>): Uint8Array {
    let refBytesSize = this.refBytesSize
    if (refBytesSize === 0) {
      refBytesSize = this.entry.length > 0 ? this.entry.length : (childRefs.values().next().value?.length ?? 0)
    }

    const parts: Uint8Array[] = []
    const header = new Uint8Array(OBFUSCATION_KEY_SIZE + VERSION_HASH_SIZE + 1)
    header.set(VERSION_02_HASH, OBFUSCATION_KEY_SIZE)
    header[header.length - 1] = refBytesSize
    parts.push(header)

    const entry = new Uint8Array(refBytesSize)
    entry.set(this.entry.subarray(0, refBytesSize))
    parts.push(entry)

    const index = new Uint8Array(32)
    for (const b of this.forks.keys()) index[b >> 3] |= 1 << (b & 7)
    parts.push(index)

    for (const b of [...this.forks.keys()].sort((x, y) => x - y)) {
      const { prefix, node } = this.forks.get(b)!
      const forkHeader = new Uint8Array(2 + PREFIX_MAX_SIZE)
      forkHeader[0] = node.type
      forkHeader[1] = prefix.length
      forkHeader.set(prefix, 2)
      parts.push(forkHeader, childRefs.get(b)!)
      if (node.type & TYPE_WITH_METADATA) parts.push(encodeForkMetadata(node.metadata ?? {}))
    }

    const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0))
    let offset = 0
    for (const p of parts) {
      out.set(p, offset)
      offset += p.length
    }
    return out
  }

  /** Persists the trie bottom-up (like Bee's `Node.Save`) and returns the root reference. */
  async save(level: RedundancyLevel): Promise<Uint8Array> {
    const childRefs = new Map<number, Uint8Array>()
    for (const [b, { node }] of this.forks) childRefs.set(b, await node.save(level))
    return hashBytes(this.marshal(childRefs), level)
  }
}
