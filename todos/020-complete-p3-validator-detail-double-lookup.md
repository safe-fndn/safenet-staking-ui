---
status: complete
priority: p3
issue_id: "020"
tags: [code-review, simplicity, performance]
dependencies: []
---

# Fix Double Validator Lookup in ValidatorDetailPage

## Problem Statement

`ValidatorDetailPage` performs two separate lookups for the same validator — `validators?.find(...)` and `findValidator(validators, validator)` — which is an unnecessary O(n) scan.

## Findings

- `src/pages/ValidatorDetailPage.tsx:27-28`:
  ```typescript
  const validatorInfo = validators?.find(
    (v) => v.address.toLowerCase() === validator.toLowerCase()
  )
  const metadata = findValidator(validators, validator)
  ```
- Both find the same object by address
- `validatorInfo` used for `isActive` check; `metadata` used for `label`
- One call to `findValidator` suffices for both

## Proposed Solutions

### Option 1: Use single findValidator call

**Approach:** Remove the `.find()` call, derive `isActive` from `findValidator` result.

**Pros:**
- Eliminates redundant O(n) scan
- Cleaner code

**Cons:**
- None

**Effort:** 5 minutes

**Risk:** Low

## Recommended Action

**To be filled during triage.**

## Technical Details

**Affected files:**
- `src/pages/ValidatorDetailPage.tsx` — lines 27-28

## Acceptance Criteria

- [ ] Single validator lookup per render
- [ ] All validator info still displayed correctly
- [ ] Tests pass

## Work Log

### 2026-03-02 - Initial Discovery

**By:** Claude Code (code-simplicity-reviewer agent)
