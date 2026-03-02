---
status: complete
priority: p2
issue_id: "016"
tags: [code-review, quality, simplicity]
dependencies: []
---

# Remove Unused Exports (YAGNI Violations)

## Problem Statement

Several exported functions, hooks, and components are never used by any consumer in the codebase. They add maintenance burden and test surface for code that serves no purpose.

## Findings

- `src/hooks/useStakingReads.ts:20` — `useTotalPendingWithdrawals()` exported but only referenced in its test
- `src/lib/format.ts:35` — `formatTimestamp()` exported but only used in its test
- `src/hooks/useTokenAllowance.ts:60` — `refetchAllowance` returned from hook but never used by callers
- `src/components/ui/card.tsx:25-42` — `CardDescription` and `CardFooter` exported but never imported

## Proposed Solutions

### Option 1: Remove all unused exports

**Approach:** Delete the unused functions/components and their tests.

**Pros:**
- Cleaner API surface
- Reduced test maintenance
- YAGNI compliance

**Cons:**
- Must verify no dynamic usage exists

**Effort:** 30 minutes

**Risk:** Low

## Recommended Action

**To be filled during triage.**

## Technical Details

**Affected files:**
- `src/hooks/useStakingReads.ts` — remove `useTotalPendingWithdrawals`
- `src/lib/format.ts` — remove `formatTimestamp`
- `src/hooks/useTokenAllowance.ts` — remove `refetchAllowance` from return
- `src/components/ui/card.tsx` — remove `CardDescription`, `CardFooter`

## Acceptance Criteria

- [ ] All unused exports removed
- [ ] Build succeeds
- [ ] Tests pass (remaining tests)
- [ ] No import errors

## Work Log

### 2026-03-02 - Initial Discovery

**By:** Claude Code (code-simplicity-reviewer agent)

**Actions:**
- Verified each export has zero consumers via grep
- Catalogued all YAGNI violations
