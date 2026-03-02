---
status: complete
priority: p3
issue_id: "017"
tags: [code-review, quality, simplicity]
dependencies: ["003"]
---

# Fix Dead Stepper Branch in DelegateDialog

## Problem Statement

The `useMemo` computing stepper steps in DelegateDialog has an unreachable duplicate branch where both paths of an `if` statement return identical values.

## Findings

- `src/components/staking/DelegateDialog.tsx:98-103` — identical return in both branches:
  ```typescript
  if (isBatchFlow) {
    if (isBatchSigning || isBatchConfirming) {
      return { currentStep: 0, completedSteps: [] as number[] }
    }
    return { currentStep: 0, completedSteps: [] as number[] } // identical
  }
  ```
- Inner `if` is dead code — both paths return the same object

## Proposed Solutions

### Option 1: Simplify to single return

**Approach:** Remove the inner `if` branch: `if (isBatchFlow) return { currentStep: 0, completedSteps: [] };`

**Pros:**
- 3 lines become 1
- Eliminates dead code

**Cons:**
- None

**Effort:** 5 minutes

**Risk:** Low

## Recommended Action

**To be filled during triage.**

## Technical Details

**Affected files:**
- `src/components/staking/DelegateDialog.tsx` — stepper `useMemo`

## Acceptance Criteria

- [ ] Dead branch removed
- [ ] Stepper behavior unchanged
- [ ] Tests pass

## Work Log

### 2026-03-02 - Initial Discovery

**By:** Claude Code (code-simplicity-reviewer agent)

**Actions:**
- Identified identical return values in both branches
