---
status: complete
priority: p2
issue_id: "007"
tags: [code-review, patterns, quality]
dependencies: []
---

# Consolidate isSafeApp Detection

## Problem Statement

Safe App detection logic (`window.parent !== window` or connector-based checks) is repeated in 4 different locations. This makes it fragile and inconsistent.

## Findings

- Safe App detection appears in:
  - `src/hooks/useDarkMode.ts`
  - `src/components/ConnectButton.tsx`
  - `src/components/DelegateDialog.tsx`
  - `src/components/Layout.tsx` (or similar)
- Different approaches used: some check `window.parent`, others check wagmi connector type
- Inconsistent behavior if detection logic changes

## Proposed Solutions

### Option 1: Create `useIsSafeApp` hook

**Approach:** Single hook that returns `boolean` indicating if running inside Safe Wallet iframe.

**Pros:**
- Single source of truth
- Consistent detection across app
- Easy to mock in tests

**Cons:**
- Hook overhead for a simple check

**Effort:** 30 minutes

**Risk:** Low

---

### Option 2: Export from config/constants

**Approach:** Compute `IS_SAFE_APP` once at module level and export as constant.

**Pros:**
- Simplest possible approach
- No hook overhead

**Cons:**
- Can't react to connector changes
- Module-level side effect

**Effort:** 20 minutes

**Risk:** Low

## Recommended Action

**To be filled during triage.**

## Technical Details

**Affected files:**
- 4 components/hooks with duplicate detection
- New: `src/hooks/useIsSafeApp.ts`

## Acceptance Criteria

- [ ] Safe App detection exists in one place
- [ ] All components use the shared implementation
- [ ] Behavior unchanged in Safe Wallet iframe
- [ ] Tests pass

## Work Log

### 2026-03-02 - Initial Discovery

**By:** Claude Code (pattern-recognition-specialist agent)

**Actions:**
- Identified 4 locations with duplicate Safe App detection
- Noted inconsistent approaches across locations
