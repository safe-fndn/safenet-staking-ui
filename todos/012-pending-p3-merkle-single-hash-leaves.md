---
status: pending
priority: p3
issue_id: "012"
tags: [code-review, security]
dependencies: []
---

# Double-Hash Merkle Leaves to Prevent Second Preimage Attacks

## Problem Statement

The Merkle tree implementation uses single-hashed leaves (`keccak256(encodePacked(address, amount))`). OpenZeppelin's MerkleProof library recommends double-hashing leaves to prevent second preimage attacks where an inner node could be confused with a leaf.

## Findings

- `scripts/merkle-tree.ts:28` — `encodeLeaf` uses single hash
- OpenZeppelin's standard is `keccak256(bytes.concat(keccak256(abi.encode(addr, amount))))`
- The MerkleDrop contract must match whatever hashing the script uses
- Current implementation works correctly but doesn't follow latest OZ convention
- Risk is theoretical — requires specific tree construction to exploit

## Proposed Solutions

### Option 1: Double-hash leaves

**Approach:** Change `encodeLeaf` to `keccak256(keccak256(encodePacked(...)))` and update the contract to match.

**Pros:**
- Follows OpenZeppelin best practice
- Eliminates theoretical second preimage attack

**Cons:**
- Requires contract redeployment or update
- Breaking change for existing proofs

**Effort:** 1 hour (script) + contract deployment

**Risk:** Low (but requires contract change)

---

### Option 2: Keep current approach, document the tradeoff

**Approach:** Document that single-hash is used intentionally and that the contract matches.

**Pros:**
- No changes needed
- Current implementation is correct

**Cons:**
- Doesn't follow latest convention

**Effort:** 15 minutes

**Risk:** Low

## Recommended Action

**To be filled during triage.**

## Technical Details

**Affected files:**
- `scripts/merkle-tree.ts` — `encodeLeaf` function
- `scripts/__tests__/merkle-tree.test.ts` — tests would need updating
- MerkleDrop smart contract (external)

## Acceptance Criteria

- [ ] Decision documented on single vs double hash
- [ ] Script and contract use matching hash approach
- [ ] All tests pass
- [ ] Proof generation still works correctly

## Work Log

### 2026-03-02 - Initial Discovery

**By:** Claude Code (security-sentinel agent)

**Actions:**
- Identified single-hash leaf pattern
- Compared against OpenZeppelin convention
- Classified as P3 due to theoretical risk only
