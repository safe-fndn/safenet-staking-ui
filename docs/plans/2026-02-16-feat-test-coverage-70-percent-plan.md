---
title: "feat: Reach 70% Test Coverage via Transaction-First Tiers"
type: feat
date: 2026-02-16
brainstorm: docs/brainstorms/2026-02-16-coverage-70-percent-brainstorm.md
---

# feat: Reach 70% Test Coverage via Transaction-First Tiers

## Overview

Expand the test suite from **34% to 70%+ line coverage**, prioritized by risk to user funds. The approach uses three tiers: Tier 1 covers all transaction-critical hooks and components (~90% per file), Tier 2 covers data display pages and components (~70% per file), and Tier 3 is cosmetic filler only if needed.

**Current state:** 12 test files, 131 tests, 35.2% line coverage.
**Target state:** ~30 test files, ~400+ tests, 70%+ line coverage.

## Problem Statement / Motivation

Users interact with real SAFE tokens through this UI. The current 34% coverage leaves critical transaction flows (withdrawal initiation, withdrawal claiming, sanctions blocking) completely untested. Before shipping to production, we need confidence that:

- Every write transaction flow (delegate, undelegate, claim) handles success, error, and edge cases
- Access control (sanctions, geoblock) reliably blocks restricted users
- Data display components render correctly with real-world data shapes

## Proposed Solution

**Transaction-First Tiers** — test by risk, not by file type.

| Tier | Focus | Per-file Target | Estimated New Tests |
|------|-------|-----------------|---------------------|
| **1** | Transaction-critical hooks + components | ~90% lines | ~80 tests |
| **2** | Pages + data display components | ~70% lines | ~120 tests |
| **3** | Layout, cosmetic (only if needed) | ~60% lines | ~20 tests |

## Technical Approach

### Key Decisions

These resolve ambiguities from the spec analysis:

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Coverage metric | **Line coverage** (primary) | Vitest default; branch coverage reported but not gated |
| Provider utility | **Create `renderWithProviders`** in Phase 0 | Needed for all Tier 2 page tests; cheaper than mocking 5 providers per test |
| Delegation flow | **Tier 1** (already ~70% — improve to ~90%) | Most common user transaction; fill error/edge branches |
| Polling behavior | **Skip** — mock return values only | Polling is wagmi infrastructure, not our logic |
| Error testing | **3 per write hook**: user rejection, contract revert, network error | Covers the error categories without exhaustive permutations |
| Rewards hooks | **Excluded** (useClaimRewards, useRewardProof, useRewards) | Placeholder implementations, will change with Merkle drop |
| Coverage exclusions | **Exclude** `src/config/**`, `src/abi/**`, `src/data/**` | Static data — no logic to test |
| Tier 3 | **Skip if 70% reached after Tier 2** | Treat as stretch goal |
| Deep-link testing | **In ValidatorsPage only** | Router is trusted infrastructure |
| Chunked log fetching | **Already tested** in useValidators (97%) — skip elsewhere | Pattern proven; replication is low-value |

### Implementation Phases

#### Phase 0: Infrastructure (Prerequisite)

Expand shared test utilities before writing any new tests.

**`src/__tests__/test-utils.tsx`** — New file

```tsx
// Wraps component with all app providers for page-level tests
export function renderWithProviders(
  ui: React.ReactElement,
  { route = '/', ...options } = {}
) {
  // WagmiProvider (mock config) → QueryClientProvider → TooltipProvider → ToastProvider → MemoryRouter
}
```

**`src/__tests__/mock-wagmi.ts`** — Expand with:

- `mockUseQueryReturn()` — for hooks using `useQuery` directly
- Withdrawal-specific test data factories

**`src/__tests__/test-data.ts`** — Expand with:

- `MOCK_WITHDRAWAL` — pending withdrawal object
- `MOCK_CLAIMABLE_WITHDRAWAL` — ready-to-claim withdrawal
- `MOCK_VALIDATORS` — array of ValidatorInfo objects
- `MOCK_TRANSACTION_HISTORY` — array of transaction events

**`vitest.config.ts`** — Update coverage config:

```ts
coverage: {
  provider: "v8",
  include: ["src/lib/**", "src/hooks/**", "src/components/**"],
  exclude: ["src/config/**", "src/abi/**", "src/data/**"],
}
```

**Files:**
- Create: `src/__tests__/test-utils.tsx`
- Edit: `src/__tests__/mock-wagmi.ts`
- Edit: `src/__tests__/test-data.ts`
- Edit: `vitest.config.ts`

---

#### Phase 1: Tier 1 — Transaction-Critical (~80 tests)

All files target ~90% line coverage. Order is by dependency (hooks before components).

##### 1A. Untested Write/State Hooks

**`src/hooks/__tests__/useStakingWrites.test.ts`** — Expand existing (currently 62% → 90%)

Add tests for `useInitiateWithdrawal` and `useClaimWithdrawal`:
- Idle state returns correct defaults
- Calls `writeContract` with correct args (validator, amount)
- Signing → confirming → success state transitions
- Error states: user rejection, contract revert ("WithdrawalNotReady"), network error
- `reset()` clears error and returns to idle
- Query invalidation on success
- ~14 new tests

**`src/hooks/__tests__/useWithdrawals.test.ts`** — New file

- Returns empty array when no address connected
- Returns pending withdrawals with amounts and timestamps
- Computes `isClaimable` correctly based on current time vs cooldown
- Handles zero withdrawals
- ~6 tests

**`src/hooks/__tests__/useTokenBalance.test.ts`** — New file

- Returns undefined when no address
- Returns balance as bigint
- Passes correct token contract address
- ~4 tests

##### 1B. Access Control Hooks

**`src/hooks/__tests__/useSanctionsCheck.test.ts`** — New file

- No-op when `VITE_SANCTIONS_API_URL` is unset
- Returns `isSanctioned: false` on 200 response
- Returns `isSanctioned: true` on 403 response
- Handles network errors gracefully
- ~5 tests

**`src/hooks/__tests__/useGeoblockCheck.test.ts`** — New file

- Returns blocked state on restricted response
- Returns allowed state on success
- Handles missing env var
- Handles network errors
- ~5 tests

**`src/hooks/__tests__/useWalletSanctionsCheck.test.ts`** — New file

- Skips check when no address connected
- Returns sanctioned state for blocked address
- Returns clean state for allowed address
- ~4 tests

##### 1C. Transaction-Critical Components

**`src/components/__tests__/WithdrawalQueue.test.tsx`** — New file

- Renders list of pending withdrawal cards
- Shows FIFO tooltip explanation
- Renders empty state when no withdrawals
- Shows correct count
- ~6 tests

**`src/components/__tests__/ClaimableBanner.test.tsx`** — New file

- Hidden when no claimable withdrawal
- Shows banner with amount when withdrawal is claimable
- Dismiss button works
- Claim button navigates to withdrawals
- ~5 tests

**`src/components/__tests__/RestrictedScreen.test.tsx`** — New file

- Renders sanctions message
- Renders geoblock message
- ~3 tests

##### 1D. Improve Existing Coverage

**`src/components/__tests__/DelegateDialog.test.tsx`** — Expand (70% → 90%)

- Error state: approval fails with user rejection
- Error state: delegation fails with contract revert
- Edge: amount exceeds balance
- Edge: zero amount
- Close dialog resets all state
- ~8 new tests

**`src/components/__tests__/UndelegateDialog.test.tsx`** — Expand (81% → 90%)

- Error state: user rejection
- Error state: contract revert ("InsufficientStake")
- Edge: amount exceeds staked balance
- ~5 new tests

**Phase 1 totals:** ~8 new test files, ~2 expanded, ~80 tests

---

#### Phase 2: Tier 2 — Data Display (~120 tests)

All files target ~70% line coverage. Uses `renderWithProviders` for pages, direct mocking for leaf components.

##### 2A. Utility Hooks

**`src/hooks/__tests__/useValidatorMetadata.test.ts`** — New file

- Returns metadata for known validator (case-insensitive lookup)
- Returns fallback for unknown validator
- Handles null/undefined address
- ~4 tests

**`src/hooks/__tests__/useCountdown.test.ts`** — New file

- Returns formatted countdown string
- Returns "Ready" when target time is past
- Updates on interval (fake timers)
- ~4 tests

##### 2B. Validator Components

**`src/components/__tests__/ValidatorCard.test.tsx`** — New file

- Renders validator name, commission, uptime
- Shows "Active" / "Inactive" badge
- Delegate button opens dialog (when connected)
- Undelegate button visible when user has stake
- Copy address button works
- Link to detail page
- Disconnected state hides action buttons
- ~10 tests

**`src/components/__tests__/ValidatorControls.test.tsx`** — New file

- Search input filters by text
- Active/Inactive/All filter buttons toggle state
- Sort dropdown changes selection
- ~6 tests

**`src/components/__tests__/ValidatorList.test.tsx`** — New file

- Renders grid of ValidatorCards
- Empty state when no validators match filter
- `autoOpenDelegate` prop triggers dialog
- Loading state
- ~6 tests

##### 2C. Dashboard Components

**`src/components/__tests__/StatsOverview.test.tsx`** — New file

- Renders all 5 stat cards with formatted values
- Handles zero/undefined values gracefully
- ~4 tests

**`src/components/__tests__/UserPositions.test.tsx`** — New file

- Renders list of delegated positions
- Shows validator name, amount, percentage
- Empty state when no delegations
- Navigate to validator detail on click
- ~6 tests

**`src/components/__tests__/PortfolioBreakdown.test.tsx`** — New file

- Renders table with per-validator amounts
- Percentages sum correctly
- Empty state
- ~4 tests

**`src/components/__tests__/TransactionHistory.test.tsx`** — New file

- Renders All/Delegations/Withdrawals tabs
- Tab switching filters transactions
- Each row shows type, amount, timestamp, explorer link
- Empty state per tab
- ~8 tests

**`src/components/__tests__/QuickActions.test.tsx`** — New file

- Shows delegate/undelegate/claim buttons when connected
- Hidden when disconnected
- Buttons navigate to correct routes
- ~4 tests

##### 2D. Wallet Component

**`src/components/__tests__/ConnectButton.test.tsx`** — New file

- Shows "Connect Wallet" when disconnected
- Shows truncated address when connected
- Copy address to clipboard
- Disconnect button works
- ~6 tests

##### 2E. Page Tests (using renderWithProviders)

All page tests mock hooks at module level, render with providers, and verify key sections are present. These are shallow integration tests — they verify composition, not individual component logic.

**`src/pages/__tests__/DashboardPage.test.tsx`** — New file

- Renders StatsOverview, QuickActions sections
- Shows OnboardingBanner for first-time visitors
- Shows ClaimableBanner when withdrawal is ready
- Connected vs disconnected state differences
- ~6 tests

**`src/pages/__tests__/ValidatorsPage.test.tsx`** — New file

- Renders validator list with controls
- Deep-link `?delegate=0x...` auto-opens dialog
- Loading state
- ~5 tests

**`src/pages/__tests__/ValidatorDetailPage.test.tsx`** — New file

- Renders validator info for valid address
- Shows delegate/undelegate buttons
- 404 for invalid validator address
- Filtered transaction history
- ~6 tests

**`src/pages/__tests__/WithdrawalsPage.test.tsx`** — New file

- Renders withdrawal queue
- Empty state when no withdrawals
- ~3 tests

**`src/pages/__tests__/NotFoundPage.test.tsx`** — New file

- Renders 404 message
- Shows link back to home
- ~2 tests

##### 2F. Additional Dashboard Components

**`src/components/__tests__/StakingSection.test.tsx`** — New file

- Renders staking overview with totals
- Shows per-validator breakdown
- Loading skeleton state
- ~6 tests

**`src/components/__tests__/RewardsSection.test.tsx`** — New file

- Renders claimable amount
- Shows "Coming Soon" for claim button
- ~3 tests

**Phase 2 totals:** ~18 new test files, ~120 tests

---

#### Phase 3: Tier 3 — Cosmetic (Only if needed)

Run `npm run test:coverage` after Phase 2. If overall line coverage is >= 70%, skip this phase entirely.

If < 70%, add tests for highest-line-count uncovered files first:

**Candidate files (by descending line count):**

1. `Header.tsx` (113 lines) — Render with/without wallet, navigation links
2. `OnboardingBanner.tsx` (56 lines) — Render, dismiss, localStorage
3. `StakeDistribution.tsx` (132 lines) — Render with 0/1/2+ validators
4. `Footer.tsx` (21 lines) — Render static links
5. `Layout.tsx` (22 lines) — Render outlet

**Phase 3 totals:** 0-5 test files, 0-20 tests (conditional)

---

## Acceptance Criteria

### Functional Requirements

- [x] Overall line coverage >= 70% (measured by `npm run test:coverage`) — **71.58%**
- [x] All Tier 1 files achieve >= 90% line coverage
- [x] All Tier 2 files achieve >= 60% line coverage
- [x] All 131 existing tests continue to pass — **264 tests, all passing**
- [x] No test relies on network calls or external services

### Quality Gates

- [x] `npm run lint` passes with zero new errors
- [x] `npm run build` succeeds
- [x] `npm test` passes all tests
- [ ] No `as unknown as` casts in test files (use mock factories) — Minor: 1 cast in ValidatorDetailPage test for mock return type

## Success Metrics

- Line coverage: 34% → 70%+
- Statement coverage: 34% → 65%+
- Branch coverage: 31% → 55%+ (naturally lower than lines)
- Test count: 131 → ~330+

## Dependencies & Prerequisites

- No new npm packages required
- Existing test infrastructure (vitest, testing-library, mock-wagmi factories) is sufficient
- Phase 0 infrastructure must complete before Phase 1 or 2

## Risk Analysis & Mitigation

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Provider wrapping complexity for page tests | Medium | High | Build `renderWithProviders` in Phase 0; validate with one page test before proceeding |
| Mocking many hooks per component is brittle | Medium | Medium | Mock at module level with defaults; override per-test only what changes |
| 70% not reached after Tier 2 | Low | Medium | Pre-estimate: Tier 1 brings ~55%, Tier 2 brings ~70%. Phase 3 is buffer. |
| Tests pass but don't catch real bugs | Low | High | Focus on behavior (user clicks, state transitions), not implementation details |

## File Summary

### New Files

| File | Phase | Tests |
|------|-------|-------|
| `src/__tests__/test-utils.tsx` | 0 | — |
| `src/hooks/__tests__/useWithdrawals.test.ts` | 1 | 6 |
| `src/hooks/__tests__/useTokenBalance.test.ts` | 1 | 4 |
| `src/hooks/__tests__/useSanctionsCheck.test.ts` | 1 | 5 |
| `src/hooks/__tests__/useGeoblockCheck.test.ts` | 1 | 5 |
| `src/hooks/__tests__/useWalletSanctionsCheck.test.ts` | 1 | 4 |
| `src/components/__tests__/WithdrawalQueue.test.tsx` | 1 | 6 |
| `src/components/__tests__/ClaimableBanner.test.tsx` | 1 | 5 |
| `src/components/__tests__/RestrictedScreen.test.tsx` | 1 | 3 |
| `src/hooks/__tests__/useValidatorMetadata.test.ts` | 2 | 4 |
| `src/hooks/__tests__/useCountdown.test.ts` | 2 | 4 |
| `src/components/__tests__/ValidatorCard.test.tsx` | 2 | 10 |
| `src/components/__tests__/ValidatorControls.test.tsx` | 2 | 6 |
| `src/components/__tests__/ValidatorList.test.tsx` | 2 | 6 |
| `src/components/__tests__/StatsOverview.test.tsx` | 2 | 4 |
| `src/components/__tests__/UserPositions.test.tsx` | 2 | 6 |
| `src/components/__tests__/PortfolioBreakdown.test.tsx` | 2 | 4 |
| `src/components/__tests__/TransactionHistory.test.tsx` | 2 | 8 |
| `src/components/__tests__/QuickActions.test.tsx` | 2 | 4 |
| `src/components/__tests__/ConnectButton.test.tsx` | 2 | 6 |
| `src/components/__tests__/StakingSection.test.tsx` | 2 | 6 |
| `src/components/__tests__/RewardsSection.test.tsx` | 2 | 3 |
| `src/pages/__tests__/DashboardPage.test.tsx` | 2 | 6 |
| `src/pages/__tests__/ValidatorsPage.test.tsx` | 2 | 5 |
| `src/pages/__tests__/ValidatorDetailPage.test.tsx` | 2 | 6 |
| `src/pages/__tests__/WithdrawalsPage.test.tsx` | 2 | 3 |
| `src/pages/__tests__/NotFoundPage.test.tsx` | 2 | 2 |

### Edited Files

| File | Phase | Changes |
|------|-------|---------|
| `src/__tests__/mock-wagmi.ts` | 0 | Add `mockUseQueryReturn()` factory |
| `src/__tests__/test-data.ts` | 0 | Add withdrawal, validator, transaction fixtures |
| `vitest.config.ts` | 0 | Add coverage exclusions |
| `src/hooks/__tests__/useStakingWrites.test.ts` | 1 | +14 tests for withdrawal/claim branches |
| `src/components/__tests__/DelegateDialog.test.tsx` | 1 | +8 tests for error/edge paths |
| `src/components/__tests__/UndelegateDialog.test.tsx` | 1 | +5 tests for error/edge paths |

## References

- Brainstorm: `docs/brainstorms/2026-02-16-coverage-70-percent-brainstorm.md`
- Existing test patterns: `src/hooks/__tests__/useStakingReads.test.ts`, `src/components/__tests__/DelegateDialog.test.tsx`
- Mock factories: `src/__tests__/mock-wagmi.ts`
- Test data: `src/__tests__/test-data.ts`
- Vitest config: `vitest.config.ts`
