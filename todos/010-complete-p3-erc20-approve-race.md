---
status: complete
priority: p3
issue_id: "010"
tags: [code-review, security]
dependencies: []
---

# ERC-20 Approve Race Condition

## Problem Statement

The approve flow in `DelegateDialog` calls `approve(amount)` directly. If a user has an existing non-zero allowance and approves a new amount, a front-running attack could exploit the transition (ERC-20 approve race condition). While unlikely in practice (especially in Safe Wallet), it's a known best practice to approve-to-zero first.

## Findings

- `src/components/DelegateDialog.tsx` — approve call doesn't check for existing non-zero allowance
- `src/hooks/useTokenAllowance.ts` — provides allowance but no approve-to-zero helper
- In Safe Wallet context, this is mitigated by batched transactions
- For injected wallets, the race condition is theoretically possible

## Proposed Solutions

### Option 1: Approve to zero first

**Approach:** If current allowance > 0 and new amount != current allowance, first approve(0) then approve(amount).

**Pros:**
- Standard mitigation for ERC-20 approve race
- Well-known pattern

**Cons:**
- Two transactions instead of one for non-Safe wallets
- Worse UX

**Effort:** 1 hour

**Risk:** Low

---

### Option 2: Use increaseAllowance if available

**Approach:** Use `increaseAllowance` function instead of `approve` if the token supports it.

**Pros:**
- No race condition by design
- Single transaction

**Cons:**
- Not all ERC-20 tokens implement it
- Need to check SAFE token contract

**Effort:** 1 hour

**Risk:** Low

## Recommended Action

**To be filled during triage.**

## Technical Details

**Affected files:**
- `src/components/DelegateDialog.tsx` — approve flow
- `src/hooks/useTokenAllowance.ts` — allowance management

## Acceptance Criteria

- [ ] Approve race condition mitigated
- [ ] Works for both Safe Wallet and injected wallets
- [ ] Tests pass

## Work Log

### 2026-03-02 - Initial Discovery

**By:** Claude Code (security-sentinel agent)

**Actions:**
- Identified standard ERC-20 approve race condition
- Noted mitigation in Safe Wallet context
- Classified as P3 due to low practical risk
