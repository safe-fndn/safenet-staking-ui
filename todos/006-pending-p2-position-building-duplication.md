---
status: pending
priority: p2
issue_id: "006"
tags: [code-review, patterns, quality]
dependencies: []
---

# Consolidate Position Building Logic

## Problem Statement

Position building (mapping validators + staked amounts into display objects) is duplicated across 4 components. Changes to the position data shape require updating 4 places.

## Findings

- Position building logic repeated in:
  - `src/components/UserPositions.tsx`
  - `src/components/PortfolioBreakdown.tsx`
  - `src/components/StakeDistribution.tsx`
  - `src/components/StakingSection.tsx`
- Each builds a similar list of `{ validator, amount, percentage }` objects from the same source data
- Slight variations in structure but same core computation

## Proposed Solutions

### Option 1: Create `usePositions` hook

**Approach:** Extract position building into a shared hook that returns the computed positions list.

**Pros:**
- Single source of truth
- Memoized computation
- Components become pure display

**Cons:**
- New hook to maintain

**Effort:** 1-2 hours

**Risk:** Low

---

### Option 2: Shared utility function

**Approach:** Create a `buildPositions()` function in `src/lib/` that takes raw data and returns positions.

**Pros:**
- Simpler than a hook (pure function)
- Easy to test

**Cons:**
- Each component still needs to call it and manage memoization

**Effort:** 1 hour

**Risk:** Low

## Recommended Action

**To be filled during triage.**

## Technical Details

**Affected files:**
- `src/components/UserPositions.tsx`
- `src/components/PortfolioBreakdown.tsx`
- `src/components/StakeDistribution.tsx`
- `src/components/StakingSection.tsx`
- New: `src/hooks/usePositions.ts` or `src/lib/positions.ts`

## Acceptance Criteria

- [ ] Position building logic exists in exactly one place
- [ ] All 4 components use the shared implementation
- [ ] Display behavior unchanged
- [ ] Tests pass

## Work Log

### 2026-03-02 - Initial Discovery

**By:** Claude Code (pattern-recognition-specialist agent)

**Actions:**
- Identified 4 components with duplicated position building
- Catalogued the variations in each
