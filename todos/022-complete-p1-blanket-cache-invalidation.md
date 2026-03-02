---
status: complete
priority: p1
issue_id: "022"
tags: [code-review, performance]
dependencies: []
---

# Replace Blanket Cache Invalidation with Targeted Invalidation

## Problem Statement

`useInvalidateOnSuccess` invalidates ALL `readContract` and `readContracts` queries across the entire app after any successful write. This creates a thundering-herd effect where a single stake transaction triggers 15-20 simultaneous RPC refetches.

## Findings

- `src/hooks/useStakingWrites.ts:13-23` — nuclear invalidation of all contract reads
- After a successful stake: user balance, all validator stakes, total staked, token allowance, sanctions check, merkle reads, and every other contract query all refetch simultaneously
- `extraKeys` default parameter `[]` creates unstable reference (latent bug for future callers)
- Same pattern in `src/hooks/useTokenAllowance.ts:35-37`

## Proposed Solutions

### Option 1: Targeted invalidation per transaction type

**Approach:** Each write hook invalidates only the specific query keys affected by that transaction.

```typescript
// After stake: only invalidate user stake + total stake
useInvalidateOnSuccess(isSuccess, [
  ["readContract", { functionName: "stakes" }],
  ["readContract", { functionName: "stakedAmount" }],
])
```

**Pros:**
- Only affected queries refetch
- Reduces post-tx RPC burst from 15-20 to 2-3 calls
- Better UX (unrelated data doesn't flash)

**Cons:**
- Must carefully map which queries each write affects
- Risk of missing a query that should be invalidated

**Effort:** 1-2 hours

**Risk:** Medium (must verify all affected queries are covered)

---

### Option 2: Use wagmi's queryKey utilities

**Approach:** Use wagmi's built-in query key construction to precisely target specific contract reads.

**Pros:**
- Type-safe query key matching
- Follows wagmi best practices

**Cons:**
- Depends on wagmi's internal query key format

**Effort:** 1-2 hours

**Risk:** Low-Medium

## Recommended Action

**To be filled during triage.**

## Technical Details

**Affected files:**
- `src/hooks/useStakingWrites.ts` — `useInvalidateOnSuccess`
- `src/hooks/useTokenAllowance.ts` — similar invalidation

## Acceptance Criteria

- [ ] No blanket `readContract`/`readContracts` invalidation
- [ ] Each write type invalidates only affected queries
- [ ] Post-tx data updates correctly for all transaction types
- [ ] RPC call count after tx reduced by 5x+
- [ ] Tests pass

## Work Log

### 2026-03-02 - Initial Discovery

**By:** Claude Code (performance-oracle agents)

**Actions:**
- Identified thundering-herd invalidation pattern
- Estimated 15-20 simultaneous refetches per write
- Both performance agents flagged independently
