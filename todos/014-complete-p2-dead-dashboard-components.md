---
status: complete
priority: p2
issue_id: "014"
tags: [code-review, quality, simplicity]
dependencies: []
---

# Remove 4 Dead Dashboard Components (~500 LOC)

## Problem Statement

Four dashboard components exist as files but are never rendered by any page. They add confusion about which components are the "real" dashboard and inflate the codebase.

## Findings

- `src/components/dashboard/RewardsSection.tsx` (52 lines) — never imported outside its test
- `src/components/dashboard/EligibilityNotice.tsx` (27 lines) — never imported outside its test
- `src/components/dashboard/PortfolioBreakdown.tsx` (88 lines) — never imported outside its test
- `src/components/dashboard/UserPositions.tsx` (154 lines) — never imported outside its test
- All four duplicate functionality already present in `StakingSection.tsx`
- Their tests (~300+ lines) also become orphaned dead code

## Proposed Solutions

### Option 1: Delete files and their tests

**Approach:** Remove all 4 component files and their corresponding test files.

**Pros:**
- ~500 LOC source code removed, ~800+ including tests
- Eliminates confusion about which components are active
- Reduces test suite runtime

**Cons:**
- If future pages need these components, they'd need to be recreated
- But StakingSection already contains the logic

**Effort:** 30 minutes

**Risk:** Low (verified no imports exist)

## Recommended Action

**To be filled during triage.**

## Technical Details

**Files to delete:**
- `src/components/dashboard/RewardsSection.tsx`
- `src/components/dashboard/EligibilityNotice.tsx`
- `src/components/dashboard/PortfolioBreakdown.tsx`
- `src/components/dashboard/UserPositions.tsx`
- `src/components/__tests__/EligibilityNotice.test.tsx`
- `src/components/__tests__/PortfolioBreakdown.test.tsx`
- `src/components/__tests__/UserPositions.test.tsx`

## Acceptance Criteria

- [ ] All 4 dead component files deleted
- [ ] Corresponding test files deleted
- [ ] No import errors in the build
- [ ] `yarn build` succeeds
- [ ] `yarn test` passes

## Work Log

### 2026-03-02 - Initial Discovery

**By:** Claude Code (code-simplicity-reviewer agent)

**Actions:**
- Verified via grep that no page imports these components
- Confirmed StakingSection.tsx contains equivalent functionality
- Estimated ~800 LOC total removal
