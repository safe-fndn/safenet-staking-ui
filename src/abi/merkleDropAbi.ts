import { parseAbi } from "viem"

export const merkleDropAbi = parseAbi([
  "function merkleRoot() view returns (bytes32)",
  "function cumulativeClaimed(address account) view returns (uint256)",
  "function claim(address account, uint256 cumulativeAmount, bytes32 expectedMerkleRoot, bytes32[] merkleProof)",
  "event Claimed(address indexed account, uint256 amount)",
  "error InvalidProof()",
  "error NothingToClaim()",
  "error MerkleRootWasUpdated()",
])
