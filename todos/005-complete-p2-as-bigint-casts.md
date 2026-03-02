---
status: complete
priority: p2
issue_id: "005"
tags: [code-review, typescript, quality]
dependencies: []
---

# Replace `as bigint` Casts with Proper Type Guards

## Problem Statement

There are ~20 instances of `as bigint` casts throughout the codebase, primarily on values returned from wagmi's `useReadContract`. These bypass TypeScript's type safety and could mask runtime errors if the contract returns unexpected data.

## Findings

- ~20 `as bigint` casts across `src/hooks/useStakingReads.ts`, `src/components/DelegateDialog.tsx`, `src/components/RewardsSection.tsx`, and others
- wagmi's `useReadContract` returns `data` typed as `unknown` by default
- Current pattern: `const balance = data as bigint`
- No runtime validation that the returned value is actually a bigint

## Proposed Solutions

### Option 1: Create typed contract read hooks

**Approach:** Use wagmi's generic type parameters properly so `useReadContract` returns correctly typed data without casts.

```typescript
const { data } = useReadContract({
  address, abi: stakingAbi,
  functionName: "stakedAmount",
  args: [address],
})
// data is already typed as bigint from the ABI
```

**Pros:**
- Zero casts needed
- Type safety from ABI inference
- wagmi's intended usage

**Cons:**
- Need to verify ABI types match wagmi's inference
- May require ABI format changes (already using parseAbi)

**Effort:** 2-3 hours

**Risk:** Low

---

### Option 2: Add runtime type guards

**Approach:** Create `assertBigInt(value)` helper and use at each cast site.

**Pros:**
- Catches runtime type mismatches
- Explicit about expectations

**Cons:**
- More verbose
- Doesn't fix the root cause (wagmi type inference)

**Effort:** 1-2 hours

**Risk:** Low

## Recommended Action

**To be filled during triage.**

## Technical Details

**Affected files:**
- `src/hooks/useStakingReads.ts` — primary location
- `src/components/DelegateDialog.tsx`
- `src/components/RewardsSection.tsx`
- Various other components consuming contract reads

## Acceptance Criteria

- [ ] Zero `as bigint` casts in codebase
- [ ] All contract read values properly typed
- [ ] No `any` types introduced
- [ ] Build passes with strict TypeScript
- [ ] Tests pass

## Work Log

### 2026-03-02 - Initial Discovery

**By:** Claude Code (safe-typescript-reviewer agent)

**Actions:**
- Counted ~20 instances of `as bigint` casts
- Identified wagmi type inference as the proper solution
- Noted this is the most common type safety violation in the codebase
