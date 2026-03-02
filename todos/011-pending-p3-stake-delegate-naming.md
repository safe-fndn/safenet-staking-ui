---
status: pending
priority: p3
issue_id: "011"
tags: [code-review, quality, patterns]
dependencies: []
---

# Clarify Stake vs Delegate Naming Convention

## Problem Statement

The codebase uses "stake" in code (hooks, functions) and "delegate" in UI, which is documented in CLAUDE.md. However, some internal code inconsistently mixes the terms, making it harder for new developers to understand the mapping.

## Findings

- Contract functions: `stake()`, `initiateWithdrawal()`, `claimWithdrawal()`
- Hooks: `useStake`, `useInitiateWithdrawal`, `useClaimWithdrawal`
- UI labels: "Delegate", "Undelegate", "Claim"
- Some component names use "Delegate" (DelegateDialog) while referencing "stake" hooks internally
- The convention is documented but not enforced

## Proposed Solutions

### Option 1: Add code comments at boundary points

**Approach:** Add brief comments at the hooks ↔ components boundary explaining the naming convention.

**Pros:**
- Minimal change
- Documents intent for new developers

**Cons:**
- Comments can become stale

**Effort:** 30 minutes

**Risk:** Low

---

### Option 2: Create alias hooks with delegate naming

**Approach:** Create `useDelegate` as an alias for `useStake`, etc. Components import the delegate-named hooks.

**Pros:**
- Components use consistent "delegate" terminology
- Clearer mapping

**Cons:**
- More indirection
- Two names for the same thing

**Effort:** 1 hour

**Risk:** Low

## Recommended Action

**To be filled during triage.**

## Technical Details

**Affected files:**
- `src/hooks/useStakingWrites.ts` — hook definitions
- `src/components/DelegateDialog.tsx` — primary consumer
- `src/components/UndelegateDialog.tsx`

## Acceptance Criteria

- [ ] Naming convention is clear and discoverable
- [ ] No confusion about stake vs delegate terminology
- [ ] Tests pass

## Work Log

### 2026-03-02 - Initial Discovery

**By:** Claude Code (pattern-recognition-specialist agent)

**Actions:**
- Catalogued naming inconsistencies
- Noted existing CLAUDE.md documentation
- Classified as P3 enhancement
