---
status: complete
priority: p2
issue_id: "015"
tags: [code-review, performance, simplicity]
dependencies: []
---

# Eliminate CountdownTimer Wrapper — Double useCountdown Call

## Problem Statement

`WithdrawalCard` calls `useCountdown(claimableAt)` for its progress bar, then renders `<CountdownTimer claimableAt={claimableAt}>` which calls `useCountdown` again for the same timestamp. This creates two separate intervals ticking every second for the same value.

## Findings

- `src/components/withdrawals/WithdrawalCard.tsx` — calls `useCountdown(claimableAt)` at line ~25
- `src/components/withdrawals/CountdownTimer.tsx` (21 lines) — wrapper that calls `useCountdown(claimableAt)` again and renders a `<Badge>`
- Result: two intervals per withdrawal card, redundant computation
- CountdownTimer is used exactly once

## Proposed Solutions

### Option 1: Inline badge rendering into WithdrawalCard

**Approach:** Remove `CountdownTimer` component. Use the existing `secondsLeft` value from WithdrawalCard's `useCountdown` call to render the badge directly.

**Pros:**
- Eliminates redundant interval
- Removes unnecessary file and component
- Clearer data flow

**Cons:**
- Slightly more JSX in WithdrawalCard

**Effort:** 15 minutes

**Risk:** Low

## Recommended Action

**To be filled during triage.**

## Technical Details

**Files affected:**
- `src/components/withdrawals/WithdrawalCard.tsx` — add badge inline
- `src/components/withdrawals/CountdownTimer.tsx` — delete

## Acceptance Criteria

- [ ] CountdownTimer.tsx deleted
- [ ] Badge rendering inlined in WithdrawalCard
- [ ] Only one useCountdown call per card
- [ ] Countdown display unchanged
- [ ] Tests pass

## Work Log

### 2026-03-02 - Initial Discovery

**By:** Claude Code (code-simplicity-reviewer agent)

**Actions:**
- Identified double useCountdown hook call per withdrawal card
- Confirmed CountdownTimer used exactly once
