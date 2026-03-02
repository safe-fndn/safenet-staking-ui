---
status: complete
priority: p2
issue_id: "026"
tags: [code-review, performance]
dependencies: []
---

# Parallelize Withdrawal Linked-List Traversal

## Problem Statement

`useWithdrawalValidators` traverses a linked list with sequential RPC calls — one per withdrawal node. With N pending withdrawals, this is N sequential round-trips (~100ms each), creating O(N) latency.

## Findings

- `src/hooks/useWithdrawalValidators.ts:50-62` — `while` loop with sequential `readContract` calls
- Each call depends on the previous result's `next` pointer (node[3])
- 10 withdrawals = ~1 second serial latency
- 50 withdrawals = ~5 seconds
- Chunked log fetching (lines 81-97) is also sequential

## Proposed Solutions

### Option 1: Multicall with estimated ID range

**Approach:** If withdrawal IDs are sequential, read all nodes between head and tail in a single `Promise.all` batch.

**Pros:**
- Reduces N round-trips to 1 batched call
- viem's batch transport handles coalescing

**Cons:**
- Assumes sequential IDs (need to verify with contract)
- May fetch some invalid IDs that need filtering

**Effort:** 1 hour

**Risk:** Low-Medium

---

### Option 2: Custom multicall contract view

**Approach:** Add a view function to the contract that returns all node data in a single call.

**Pros:**
- Guaranteed single call
- Most efficient solution

**Cons:**
- Requires contract modification
- May not be possible on deployed contract

**Effort:** 2-3 hours (including contract)

**Risk:** Medium

## Recommended Action

**To be filled during triage.**

## Technical Details

**Affected files:**
- `src/hooks/useWithdrawalValidators.ts` — linked list traversal

## Acceptance Criteria

- [ ] Withdrawal data loads in O(1) round-trips instead of O(N)
- [ ] All withdrawal validators resolved correctly
- [ ] Tests pass

## Work Log

### 2026-03-02 - Initial Discovery

**By:** Claude Code (performance-oracle agents)

**Actions:**
- Identified sequential RPC pattern in withdrawal traversal
- Projected scaling impact at 50 withdrawals
