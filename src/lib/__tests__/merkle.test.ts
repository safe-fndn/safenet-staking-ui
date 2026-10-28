import { describe, it, expect } from "vitest"
import { getAddress, keccak256, encodePacked, type Hex } from "viem"
import { encodeLeaf, verifyProof } from "../merkle"

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

describe("verifyProof", () => {
  it("verifies a real Beta proof and rejects it for the amount plus 1 wei", () => {
    // Served by rewards.safenet-gov.eth on 2026-10-27; the root was the mainnet merkleRoot() then
    const account = "0x03d4969997a6f6cf8b8695c33087aa175a8463d6"
    const cumulativeAmount = 20317997595332681188921n
    const root: Hex = "0x668901980a6c69b801f37cdef375059369dab712db8651a463d1d336b65cfdef"
    const proof: Hex[] = [
      "0x0b229a0fd9f33a327c84e18cc3ef596f89ef753bad71d560ecb36779ed0be3df",
      "0x525d0bf0b999b816f67044fd2499cb1cda4c8c38115f68e81ad52bbb630e2ff3",
      "0xae52a260d480afe56d387a8377c0e8fde9b95c545bd5c1e4fccd6dea6231ea68",
      "0x9db6b610ac99094d7608f92a3b325a4c7e51ca5e05361cd68912e7e0c070ee6a",
      "0x091a5af6de30cb8202c54d931d225999443cf124bfc1175e82585125775173ee",
      "0x167f7771f78dbf44ab35e7b2bd863989768c8b49f12cb7ceaf332d5f14ebc5cb",
      "0x03cd694ab2683a045cde30da241bc93058f55c9ef280c034f1f59a0912e179c0",
      "0x3d0d86a9f6e45e4336636f682b589e5a6b1a150f4851898b9a1ca33215a9b8d1",
    ]

    expect(verifyProof(encodeLeaf(account, cumulativeAmount), proof, root)).toBe(true)
    expect(verifyProof(encodeLeaf(account, cumulativeAmount + 1n), proof, root)).toBe(false)
  })

  // Two-leaf tree: the proof for one leaf is the other leaf
  const addr = getAddress("0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045")
  const leaf = encodeLeaf(addr, 1000n)
  const sibling = encodeLeaf("0x71C7656EC7ab88b098defB751B7401B5f6d8976F", 500n)

  it("rejects proof against wrong root", () => {
    const fakeRoot: Hex = "0x0000000000000000000000000000000000000000000000000000000000000001"
    expect(verifyProof(leaf, [sibling], fakeRoot)).toBe(false)
  })
})
