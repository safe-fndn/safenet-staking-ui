---
status: complete
priority: p2
issue_id: "023"
tags: [code-review, performance]
dependencies: []
---

# Conditionally Render Dialogs to Eliminate Idle Query Subscriptions

## Problem Statement

`DelegateDialog` and `UndelegateDialog` are always mounted (even when closed) in each `ValidatorCard`. Their hooks (`useTokenBalance`, `useTokenAllowance`, `useUserStakeOnValidator`, `useWithdrawDelay`) create active polling queries even when the dialog is invisible.

## Findings

- `src/components/validators/ValidatorCard.tsx` — always renders both dialogs
- With 10 validator cards: 20 mounted dialog components, ~40 idle query subscriptions
- Each subscription polls every 30 seconds
- Radix Dialog conditionally renders portal content, but hooks run at component level

## Proposed Solutions

### Option 1: Conditionally mount dialogs

**Approach:** Only render dialog components when `open` is true.

```tsx
// Instead of:
<DelegateDialog open={delegateOpen} onOpenChange={setDelegateOpen} />
// Use:
{delegateOpen && <DelegateDialog open onOpenChange={setDelegateOpen} />}
```

**Pros:**
- Eliminates 40+ idle query subscriptions on validators page
- Zero hooks run for closed dialogs
- Minimal code change

**Cons:**
- Slight delay on first open (hooks need to fetch)
- Dialog state resets on close (amount, step)

**Effort:** 15 minutes

**Risk:** Low

## Recommended Action

**To be filled during triage.**

## Technical Details

**Affected files:**
- `src/components/validators/ValidatorCard.tsx` — 2 dialogs per card
- `src/pages/ValidatorDetailPage.tsx` — 2 dialogs
- `src/components/dashboard/StakingSection.tsx` — ClaimRewardsDialog

## Acceptance Criteria

- [ ] Dialogs only mount when opened
- [ ] Dialog functionality unchanged
- [ ] No idle query subscriptions for closed dialogs
- [ ] Tests pass

## Work Log

### 2026-03-02 - Initial Discovery

**By:** Claude Code (performance-oracle agent)

**Actions:**
- Identified 40+ idle query subscriptions from unmounted dialogs
- Confirmed Radix Dialog pattern allows conditional mounting
