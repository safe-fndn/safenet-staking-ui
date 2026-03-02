import { describe, it, expect } from "vitest"
import { getAddress, keccak256, encodePacked, type Hex } from "viem"
import {
  encodeLeaf,
  buildMerkleTree,
  verifyProof,
  type MerkleEntry,
} from "../merkle-tree"

describe("encodeLeaf", () => {
  it("produces correct keccak256 of encodePacked(address, uint256)", () => {
    const addr = "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045"
    const amount = 1000n * 10n ** 18n
    const result = encodeLeaf(addr, amount)
    const expected = keccak256(
      encodePacked(
        ["address", "uint256"],
        [getAddress(addr), amount],
      ),
    )
    expect(result).toBe(expected)
  })

  it("normalizes mixed-case addresses to checksummed", () => {
    const lower = "0xd8da6bf26964af9d7eed9e03e53415d37aa96045"
    const upper = "0xD8DA6BF26964AF9D7EED9E03E53415D37AA96045"
    const amount = 500n * 10n ** 18n
    expect(encodeLeaf(lower, amount)).toBe(encodeLeaf(upper, amount))
  })
})

describe("buildMerkleTree", () => {
  it("throws on empty entries", () => {
    expect(() => buildMerkleTree([])).toThrow(
      "Cannot build Merkle tree from empty entries",
    )
  })

  it("builds a single-entry tree (root = leaf hash)", () => {
    const entries: MerkleEntry[] = [
      { address: "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045", amount: 1000n },
    ]
    const tree = buildMerkleTree(entries)
    const leafHash = encodeLeaf(entries[0].address, entries[0].amount)

    expect(tree.root).toBe(leafHash)
    expect(tree.proofs.size).toBe(1)

    const proof = tree.proofs.get(getAddress(entries[0].address))!
    expect(proof).toEqual([])
    expect(verifyProof(leafHash, proof, tree.root)).toBe(true)
  })

  it("builds a two-entry tree with valid proofs", () => {
    const entries: MerkleEntry[] = [
      { address: "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045", amount: 1000n * 10n ** 18n },
      { address: "0x71C7656EC7ab88b098defB751B7401B5f6d8976F", amount: 500n * 10n ** 18n },
    ]
    const tree = buildMerkleTree(entries)

    for (const entry of entries) {
      const addr = getAddress(entry.address)
      const leaf = encodeLeaf(addr, entry.amount)
      const proof = tree.proofs.get(addr)!

      expect(proof.length).toBe(1)
      expect(verifyProof(leaf, proof, tree.root)).toBe(true)
    }
  })

  it("builds a three-entry tree with valid proofs", () => {
    const entries: MerkleEntry[] = [
      { address: "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045", amount: 1000n * 10n ** 18n },
      { address: "0x71C7656EC7ab88b098defB751B7401B5f6d8976F", amount: 500n * 10n ** 18n },
      { address: "0x2546BcD3c84621e976D8185a91A922aE77ECEc30", amount: 250n * 10n ** 18n },
    ]
    const tree = buildMerkleTree(entries)

    for (const entry of entries) {
      const addr = getAddress(entry.address)
      const leaf = encodeLeaf(addr, entry.amount)
      const proof = tree.proofs.get(addr)!

      expect(verifyProof(leaf, proof, tree.root)).toBe(true)
    }
  })

  it("produces deterministic root regardless of address casing", () => {
    const entries1: MerkleEntry[] = [
      { address: "0xd8da6bf26964af9d7eed9e03e53415d37aa96045", amount: 100n },
      { address: "0x71c7656ec7ab88b098defb751b7401b5f6d8976f", amount: 200n },
    ]
    const entries2: MerkleEntry[] = [
      { address: "0xD8DA6BF26964AF9D7EED9E03E53415D37AA96045", amount: 100n },
      { address: "0x71C7656EC7AB88B098DEFB751B7401B5F6D8976F", amount: 200n },
    ]
    expect(buildMerkleTree(entries1).root).toBe(buildMerkleTree(entries2).root)
  })

  it("throws on duplicate addresses", () => {
    const entries: MerkleEntry[] = [
      { address: "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045", amount: 100n },
      { address: "0xd8da6bf26964af9d7eed9e03e53415d37aa96045", amount: 200n },
    ]
    expect(() => buildMerkleTree(entries)).toThrow("Duplicate address")
  })

  it("builds a four-entry balanced tree with valid proofs", () => {
    const entries: MerkleEntry[] = [
      { address: "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045", amount: 1000n },
      { address: "0x71C7656EC7ab88b098defB751B7401B5f6d8976F", amount: 500n },
      { address: "0x2546BcD3c84621e976D8185a91A922aE77ECEc30", amount: 250n },
      { address: "0xBcd4042DE499D14e55001CcbB24a551F3b954096", amount: 125n },
    ]
    const tree = buildMerkleTree(entries)

    for (const entry of entries) {
      const addr = getAddress(entry.address)
      const leaf = encodeLeaf(addr, entry.amount)
      const proof = tree.proofs.get(addr)!

      expect(proof.length).toBe(2)
      expect(verifyProof(leaf, proof, tree.root)).toBe(true)
    }
  })

  it("builds a five-entry tree with valid proofs (multi-level odd promotion)", () => {
    const entries: MerkleEntry[] = [
      { address: "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045", amount: 100n },
      { address: "0x71C7656EC7ab88b098defB751B7401B5f6d8976F", amount: 200n },
      { address: "0x2546BcD3c84621e976D8185a91A922aE77ECEc30", amount: 300n },
      { address: "0xBcd4042DE499D14e55001CcbB24a551F3b954096", amount: 400n },
      { address: "0xdD2FD4581271e230360230F9337D5c0430Bf44C0", amount: 500n },
    ]
    const tree = buildMerkleTree(entries)

    for (const entry of entries) {
      const addr = getAddress(entry.address)
      const leaf = encodeLeaf(addr, entry.amount)
      const proof = tree.proofs.get(addr)!

      expect(verifyProof(leaf, proof, tree.root)).toBe(true)
    }
  })

  it("produces different roots for different amounts", () => {
    const entries1: MerkleEntry[] = [
      { address: "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045", amount: 100n },
    ]
    const entries2: MerkleEntry[] = [
      { address: "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045", amount: 200n },
    ]
    expect(buildMerkleTree(entries1).root).not.toBe(
      buildMerkleTree(entries2).root,
    )
  })
})

describe("verifyProof", () => {
  it("rejects proof against wrong root", () => {
    const entries: MerkleEntry[] = [
      { address: "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045", amount: 1000n },
      { address: "0x71C7656EC7ab88b098defB751B7401B5f6d8976F", amount: 500n },
    ]
    const tree = buildMerkleTree(entries)
    const addr = getAddress(entries[0].address)
    const leaf = encodeLeaf(addr, entries[0].amount)
    const proof = tree.proofs.get(addr)!

    const fakeRoot: Hex = "0x0000000000000000000000000000000000000000000000000000000000000001"
    expect(verifyProof(leaf, proof, fakeRoot)).toBe(false)
  })

  it("rejects proof for wrong leaf", () => {
    const entries: MerkleEntry[] = [
      { address: "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045", amount: 1000n },
      { address: "0x71C7656EC7ab88b098defB751B7401B5f6d8976F", amount: 500n },
    ]
    const tree = buildMerkleTree(entries)
    const addr = getAddress(entries[0].address)
    const proof = tree.proofs.get(addr)!

    // Use wrong amount to get different leaf
    const wrongLeaf = encodeLeaf(addr, 999n)
    expect(verifyProof(wrongLeaf, proof, tree.root)).toBe(false)
  })
})
