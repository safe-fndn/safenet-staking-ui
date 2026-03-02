/**
 * Pure Merkle tree logic for generating proofs compatible with
 * the MerkleDrop contract (OpenZeppelin sorted-pair convention).
 *
 * Uses viem for encoding and hashing — no additional dependencies.
 */
import {
  keccak256,
  encodePacked,
  getAddress,
  type Address,
  type Hex,
} from "viem"

export interface MerkleEntry {
  address: Address
  amount: bigint
}

export interface MerkleTree {
  root: Hex
  proofs: Map<Address, Hex[]>
}

/** Encode a leaf as keccak256(abi.encodePacked(address, uint256)). */
export function encodeLeaf(address: Address, amount: bigint): Hex {
  const normalized = getAddress(address)
  return keccak256(
    encodePacked(["address", "uint256"], [normalized, amount]),
  )
}

/**
 * Hash a pair of nodes using sorted order (OpenZeppelin convention).
 * The smaller value comes first to ensure deterministic ordering.
 */
function hashPair(a: Hex, b: Hex): Hex {
  const [left, right] = a < b ? [a, b] : [b, a]
  return keccak256(encodePacked(["bytes32", "bytes32"], [left, right]))
}

/**
 * Build a sorted binary Merkle tree from a list of entries.
 *
 * Returns the root hash and a map of address → proof (sibling hashes).
 * Entries must be non-empty.
 */
export function buildMerkleTree(entries: MerkleEntry[]): MerkleTree {
  if (entries.length === 0) {
    throw new Error("Cannot build Merkle tree from empty entries")
  }

  // Normalize addresses and check for duplicates
  const normalized = entries.map((e) => ({
    address: getAddress(e.address),
    amount: e.amount,
  }))

  const seen = new Set<Address>()
  for (const e of normalized) {
    if (seen.has(e.address)) {
      throw new Error(`Duplicate address in entries: ${e.address}`)
    }
    seen.add(e.address)
  }

  // Build leaves (skip redundant getAddress — already normalized above)
  const leaves: Hex[] = normalized.map((e) =>
    keccak256(encodePacked(["address", "uint256"], [e.address, e.amount])),
  )

  // Build tree layers bottom-up
  const layers: Hex[][] = [leaves]
  let current = leaves

  while (current.length > 1) {
    const next: Hex[] = []
    for (let i = 0; i < current.length; i += 2) {
      if (i + 1 < current.length) {
        next.push(hashPair(current[i], current[i + 1]))
      } else {
        // Odd node promoted unchanged
        next.push(current[i])
      }
    }
    layers.push(next)
    current = next
  }

  const root = current[0]

  // Extract proofs by walking up the tree
  const proofs = new Map<Address, Hex[]>()
  for (let entryIdx = 0; entryIdx < normalized.length; entryIdx++) {
    const proof: Hex[] = []
    let idx = entryIdx

    for (let layer = 0; layer < layers.length - 1; layer++) {
      const layerNodes = layers[layer]
      const siblingIdx = idx % 2 === 0 ? idx + 1 : idx - 1

      if (siblingIdx < layerNodes.length) {
        proof.push(layerNodes[siblingIdx])
      }

      idx = Math.floor(idx / 2)
    }

    proofs.set(normalized[entryIdx].address, proof)
  }

  return { root, proofs }
}

/**
 * Verify that a proof is valid for a given leaf against a root.
 * Useful for testing proof correctness.
 */
export function verifyProof(
  leaf: Hex,
  proof: Hex[],
  root: Hex,
): boolean {
  let current = leaf
  for (const sibling of proof) {
    current = hashPair(current, sibling)
  }
  return current === root
}
