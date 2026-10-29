import {
  keccak256,
  encodePacked,
  getAddress,
  type Address,
  type Hex,
} from "viem"

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
export function hashPair(a: Hex, b: Hex): Hex {
  const [left, right] = a < b ? [a, b] : [b, a]
  return keccak256(encodePacked(["bytes32", "bytes32"], [left, right]))
}

/**
 * Verify that a proof is valid for a given leaf against a root.
 * Expects lowercase hex: hashPair orders nodes by string comparison.
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
