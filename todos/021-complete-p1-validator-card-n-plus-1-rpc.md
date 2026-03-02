---
status: complete
priority: p1
issue_id: "021"
tags: [code-review, performance]
dependencies: []
---

# Fix N+1 RPC Pattern in ValidatorCard

## Problem Statement

Each `ValidatorCard` independently calls `useUserStakeOnValidator(validator)`, creating N separate RPC polling queries for N validators. Timer drift causes these to fire individually instead of batching, creating up to N separate RPC calls every 30 seconds.

## Findings

- `src/components/validators/ValidatorCard.tsx:29` — individual `useUserStakeOnValidator` per card
- `ValidatorList` already batches total stakes via `useValidatorTotalStakes(validatorAddresses)`
- With 10 validators: up to 10 individual RPC calls per poll cycle (vs 1 batched)
- At 50 validators: 50 individual calls — significant RPC load
- Both performance agents flagged this as the highest priority issue

## Proposed Solutions

### Option 1: Lift useUserStakesOnValidators to ValidatorList

**Approach:** Call `useUserStakesOnValidators` in `ValidatorList` (matching the total stakes pattern) and pass individual stakes as props to each `ValidatorCard`.

**Pros:**
- Consolidates N calls into 1 batched multicall
- Follows existing pattern (total stakes already done this way)
- Minimal refactoring

**Cons:**
- ValidatorCard loses self-contained data fetching

**Effort:** 30 minutes

**Risk:** Low

## Recommended Action

**To be filled during triage.**

## Technical Details

**Affected files:**
- `src/components/validators/ValidatorList.tsx` — add `useUserStakesOnValidators`
- `src/components/validators/ValidatorCard.tsx` — accept `userStake` prop instead of fetching

## Acceptance Criteria

- [ ] Single batched multicall replaces N individual calls
- [ ] User stake displayed correctly on each card
- [ ] Polling continues at 30s interval
- [ ] Tests pass

## Work Log

### 2026-03-02 - Initial Discovery

**By:** Claude Code (performance-oracle agents, both flagged independently)

**Actions:**
- Identified N+1 RPC pattern in ValidatorCard
- Confirmed existing batched pattern for total stakes
- Projected impact at scale: 50 validators = 50 individual calls
