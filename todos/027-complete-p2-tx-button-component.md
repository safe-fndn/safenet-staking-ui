---
status: complete
priority: p2
issue_id: "027"
tags: [code-review, quality, simplicity]
dependencies: ["004"]
---

# Extract TxButton Component for Signing/Confirming UI Pattern

## Problem Statement

The signing/confirming button UI pattern (`isSigningTx ? <Loader2>Confirm in Wallet... : isConfirmingTx ? <Loader2>Confirming... : label`) is repeated 8+ times across the codebase, each 8-12 lines.

## Findings

- Pattern appears in: DelegateDialog (4x), UndelegateDialog (1x), WithdrawalCard (1x), WithdrawalQueue (1x), ClaimRewardsDialog (1x)
- Each instance is 8-12 lines of identical JSX with different labels
- Inconsistent wording across instances is possible

## Proposed Solutions

### Option 1: Create TxButton component

**Approach:** Extract a `<TxButton>` that accepts `isSigning`, `isConfirming`, and label props.

**Pros:**
- ~60 lines saved
- Consistent wording/styling
- Single place to update button UX

**Cons:**
- New component to maintain

**Effort:** 1 hour

**Risk:** Low

## Recommended Action

**To be filled during triage.**

## Technical Details

**Affected files:**
- 5+ component files with the button pattern
- New: `src/components/ui/TxButton.tsx`

## Acceptance Criteria

- [ ] TxButton component created
- [ ] All transaction buttons use TxButton
- [ ] Consistent signing/confirming labels
- [ ] Tests pass

## Work Log

### 2026-03-02 - Initial Discovery

**By:** Claude Code (code-simplicity-reviewer agents)

**Actions:**
- Counted 8+ instances of the pattern
- Estimated ~60 lines savings
