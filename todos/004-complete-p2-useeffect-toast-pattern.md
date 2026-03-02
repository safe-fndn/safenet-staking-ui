---
status: complete
priority: p2
issue_id: "004"
tags: [code-review, quality, patterns]
dependencies: []
---

# Extract Shared useEffect Toast Pattern

## Problem Statement

The pattern of watching `isSuccess`/`error` in `useEffect` to trigger toasts is repeated 20+ times across 7+ components. This creates boilerplate and inconsistent error handling.

## Findings

- Pattern appears in: `DelegateDialog.tsx`, `UndelegateDialog.tsx`, `WithdrawalCard.tsx`, `ClaimRewardsDialog.tsx`, `SetMerkleRoot.tsx`, `MintToken.tsx`, `ProposeValidators.tsx`, `RecoverTokens.tsx`
- Each instance follows the same structure:
  ```typescript
  useEffect(() => {
    if (isSuccess) { toast({ variant: "success", ... }); reset(); }
  }, [isSuccess, ...])
  useEffect(() => {
    if (error) { toast({ variant: "error", ... }); reset(); }
  }, [error, ...])
  ```
- Some components forget `reset()` after error (was already fixed in SetMerkleRoot)
- ESLint flags `react-hooks/set-state-in-effect` in some of these

## Proposed Solutions

### Option 1: Create `useTransactionToast` hook

**Approach:** Extract a reusable hook that watches transaction state and fires toasts automatically.

```typescript
useTransactionToast({
  isSuccess, error, reset, txHash,
  successTitle: "Delegation successful",
  errorTitle: "Delegation failed",
})
```

**Pros:**
- Eliminates all duplicate useEffect pairs
- Consistent error handling across all components
- Single place to fix issues

**Cons:**
- New abstraction to maintain

**Effort:** 2-3 hours

**Risk:** Low

---

### Option 2: Extend existing write hooks to include toast

**Approach:** Modify `useStake`, `useInitiateWithdrawal`, etc. to accept toast config and handle notifications internally.

**Pros:**
- Zero boilerplate in components
- Components don't need to import toast at all

**Cons:**
- Couples hooks to UI concerns
- Less flexible for custom toast messages

**Effort:** 3-4 hours

**Risk:** Medium

## Recommended Action

**To be filled during triage.**

## Technical Details

**Affected files:**
- All components using the pattern (7+ files)
- New file: `src/hooks/useTransactionToast.ts` (Option 1)

## Acceptance Criteria

- [ ] Duplicate useEffect toast pattern eliminated
- [ ] All transaction success/error toasts still work correctly
- [ ] `reset()` always called after both success and error
- [ ] No ESLint warnings from the pattern
- [ ] Tests pass

## Work Log

### 2026-03-02 - Initial Discovery

**By:** Claude Code (pattern-recognition-specialist agent)

**Actions:**
- Identified 20+ instances across 7+ components
- Noted inconsistent error handling (missing reset in some)
- Catalogued all affected files

## Notes

- This is the most frequently repeated pattern in the codebase
- Consider implementing alongside DelegateDialog refactor (todo #003)
