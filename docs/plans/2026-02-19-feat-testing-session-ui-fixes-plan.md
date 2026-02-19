---
title: "feat: Testing Session UI Fixes"
type: feat
date: 2026-02-19
---

# Testing Session UI Fixes

## Overview

Address all 18 UI issues identified during the testing session by 4 reviewers. These fixes span copy corrections, styling improvements, SafeApp-specific behavior, and one feature addition (batch claims). All changes are localized to existing components with no new dependencies required.

## Problem Statement / Motivation

The testing session revealed inconsistent terminology, accessibility issues (color contrast, cursor styles), and missing SafeApp-specific behaviors. These issues degrade user trust and usability, especially within the Safe Wallet iframe context where most users will interact with the dApp.

## Proposed Solution

Group fixes into 4 categories and implement in order of dependency. Each fix is isolated to 1-3 files plus their tests.

---

## Fixes by Category

### A. Copy & Terminology (Fixes #1, #3, #4, #12, #17)

#### Fix #1 — Change "claim" to "withdraw" on Withdrawals page

The Withdrawals page header description says "claim undelegated tokens" but the action is withdrawing.

**Files:**
- `src/pages/WithdrawalsPage.tsx:8` — change `"claim undelegated tokens"` to `"withdraw undelegated tokens"`
- `src/components/dashboard/QuickActions.tsx:37` — change `"Claim Withdrawals"` to `"Withdraw"`

**Note:** Keep the `"Claim"` button label on `WithdrawalCard` as-is — the action of claiming a specific withdrawal is correct terminology for the contract operation.

**Tests:** `QuickActions.test.tsx` assertions on button text.

#### Fix #3 — Change "on chain" to "onchain"

5 component files use `"on chain"` (two words). Standardize to `"onchain"` (one word, per Ethereum community convention).

**Files:**
- `src/components/withdrawals/WithdrawalCard.tsx:66` — `"Confirming on chain…"` → `"Confirming onchain…"`
- `src/components/staking/DelegateDialog.tsx:266,319` — same
- `src/components/staking/UndelegateDialog.tsx:116` — same
- `src/components/dashboard/ClaimRewardsDialog.tsx:113` — same
- `src/components/staking/DelegateDialog.tsx:189` — `"on-chain"` → `"onchain"` (in toast)

**Tests:** `DelegateDialog.test.tsx:224`, `UndelegateDialog.test.tsx:170`, `WithdrawalCard.test.tsx:82` — update assertions.

#### Fix #4 — Change "unbonding period" to "unstaking period"

**Files:**
- `src/components/staking/DelegateDialog.tsx:248` — `"Unbonding period"` → `"Unstaking period"`
- `src/components/staking/UndelegateDialog.tsx:103` — same

**Tests:** `DelegateDialog.test.tsx:230`, `UndelegateDialog.test.tsx:114` — update assertions.

#### Fix #12 — Unify Stake/Delegate terminology to "Delegate"/"Undelegate"

Per CLAUDE.md: "The UI uses 'delegation' terminology externally." Standardize all user-facing labels to Delegate/Undelegate. Keep hook/function names as-is (they match the contract).

**Files:**
- `src/components/staking/DelegateDialog.tsx:209` — title `"Stake SAFE"` → `"Delegate SAFE"`
- `src/components/staking/DelegateDialog.tsx:211` — `"Stake tokens toward"` → `"Delegate tokens to"`
- `src/components/staking/DelegateDialog.tsx:322` — button `"Stake"` → `"Delegate"`
- `src/components/staking/DelegateDialog.tsx:86-88` — stepper labels: unify to `["Approve", "Delegate", "Done"]` / `["Delegate", "Done"]`
- `src/components/validators/ValidatorCard.tsx:111,120` — `"Stake"` → `"Delegate"`, `"Unstake"` → `"Undelegate"`
- `src/pages/ValidatorDetailPage.tsx` — `"Stake"` → `"Delegate"`, `"Unstake"` → `"Undelegate"`
- `src/components/dashboard/StakingSection.tsx:61` — `"Unstake"` → `"Undelegate"`

**Tests:** `DelegateDialog.test.tsx` (multiple assertions), `QuickActions.test.tsx` — update button text assertions.

#### Fix #17 — Rename "Stake Distribution" to "Your Stake Distribution"

**Files:**
- `src/components/dashboard/StakeDistribution.tsx:103,113` — both `CardTitle` elements: `"Stake Distribution"` → `"Your Stake Distribution"`

**Tests:** None expected (no test asserts on this heading).

---

### B. UI & Styling (Fixes #2, #5, #8, #13, #14, #15)

#### Fix #2 — Round token amounts to integers in overview displays

Change `maxDecimals` default or update call sites to show `0` decimals for overview/summary displays. Keep decimals in input fields and detailed views.

**Approach:** Update specific call sites to pass `maxDecimals=0` rather than changing the default (which would affect input displays where decimals matter).

**Files to update (pass `18, 0` as 2nd and 3rd args):**
- `src/components/withdrawals/WithdrawalCard.tsx:48`
- `src/components/dashboard/ClaimableBanner.tsx:31`
- `src/components/wallet/ConnectButton.tsx:159`
- `src/components/dashboard/StatsOverview.tsx:26` (`:19` already uses `0`)
- `src/components/dashboard/PortfolioBreakdown.tsx:20`
- `src/components/dashboard/UserPositions.tsx:37`
- `src/components/dashboard/StakingSection.tsx:43,151`
- `src/components/dashboard/RewardsSection.tsx:25`
- `src/components/validators/ValidatorCard.tsx:86,98`
- `src/pages/ValidatorDetailPage.tsx:131,140`

**Keep decimals (do NOT change):**
- `src/components/staking/AmountInput.tsx:32` — balance display next to input
- `src/components/dashboard/StakeDistribution.tsx:38` — chart tooltip (fine-grained)
- `src/components/dashboard/ClaimRewardsDialog.tsx:47,96` — claim dialog amounts

**Tests:** `format.test.ts` already covers `maxDecimals=0`. Component tests may need amount assertion updates.

#### Fix #5 — Add SAFE token logo next to "SAFE" text

The SVG already exists at `src/assets/safe-token-logo.svg`.

**Approach:** Create a small `<SafeTokenBadge />` component that renders the logo + "SAFE" text together, then use it in the most prominent locations.

**Files:**
- New: `src/components/ui/SafeTokenBadge.tsx` — inline SVG import + "SAFE" text, accepting `className` prop
- Update key locations to use `<SafeTokenBadge />`:
  - `src/components/wallet/ConnectButton.tsx:159` — balance display
  - `src/components/dashboard/StatsOverview.tsx` — stat cards
  - `src/components/withdrawals/WithdrawalCard.tsx` — amount display

**Note:** Don't replace every "SAFE" string — focus on the 3-4 most prominent displays.

#### Fix #8 — Add pointer cursor to action buttons

Tailwind CSS v4 resets `cursor: pointer` on buttons. Add it to the CVA base class.

**Files:**
- `src/components/ui/button.tsx:7` — add `cursor-pointer` to base class string

**Tests:** None (CSS-only change).

#### Fix #13 — Standardize disabled button styles

Currently `disabled:opacity-50` is the only disabled style. Review if any variants need distinct disabled styling.

**Approach:** The current `disabled:pointer-events-none disabled:opacity-50` is standard. The real issue is likely that some non-`<Button>` elements (raw `<button>` tags) don't inherit these styles. Audit `WithdrawalCard` and `WithdrawalQueue` for raw buttons that need consistent disabled styling.

**Files:**
- `src/components/ui/button.tsx` — no change needed if current pattern is correct
- `src/components/withdrawals/WithdrawalCard.tsx` — verify disabled Claim button uses `<Button>` component (not raw `<button>`)

#### Fix #14 — Fix white-on-green contrast for Claim button

White text (`text-primary-foreground`) on `#12FF80` (`bg-safe-green`) has ~1.6:1 contrast ratio (fails WCAG AA).

**Files:**
- `src/components/dashboard/QuickActions.tsx:33` — change `text-primary-foreground` to `text-foreground` (which is dark in light mode, light in dark mode — good contrast on green in both)
- Audit any other `bg-safe-green` + `text-primary-foreground` occurrences

**Tests:** None (CSS-only change).

#### Fix #15 — Use relative timestamps for future withdrawals

Currently `WithdrawalCard` always shows absolute timestamp via `formatTimestamp()`. For future (not-yet-claimable) withdrawals, show relative time instead.

**Approach:** When `secondsLeft > 0`, show `"Claimable in {formatCountdown(secondsLeft)}"` instead of `"Claimable at: {formatTimestamp(...)}"`. When claimable (`secondsLeft === 0`), show `"Ready to withdraw"`.

**Files:**
- `src/components/withdrawals/WithdrawalCard.tsx:49-51` — conditional timestamp display

**Tests:** `WithdrawalCard.test.tsx` — update timestamp-related assertions.

---

### C. SafeApp-Specific (Fixes #6, #7, #11, #16)

#### Fix #6 — Show dark mode toggle in SafeApp iframe mode

The Header currently hides the dark mode toggle when `isSafeApp` is true.

**Files:**
- `src/components/layout/Header.tsx:62` — remove `{!isSafeApp && (` conditional wrapper around dark mode toggle

**Tests:** None expected (Header toggle is not unit tested).

#### Fix #7 — Fix wrong WalletConnect icon in Safe UI

The connector menu in `ConnectButton` doesn't render any icons — just `{connector.name}`. The "wrong icon" issue is likely in the WalletConnect modal itself, which is outside our control.

**Approach:** Add connector icons to our connector menu using the `connector.icon` property from wagmi. This gives us control over what users see.

**Files:**
- `src/components/wallet/ConnectButton.tsx:127-139` — add `{connector.icon && <img>}` before `{connector.name}`

**Tests:** No test impact (visual-only change).

#### Fix #11 — Hide Disconnect button in SafeApp iframe mode

In Safe Wallet iframe, disconnecting doesn't make sense — the parent app manages the connection.

**Files:**
- `src/components/wallet/ConnectButton.tsx:173` — wrap Disconnect button with `{!isIframe && (...)}`

**Tests:** `ConnectButton.test.tsx:93-103,105-117` — update to account for SafeApp mode.

#### Fix #16 — Show spinner only on the claimed withdrawal, not all

Currently `WithdrawalQueue` passes a single `isSigningTx`/`isConfirmingTx` to every `WithdrawalCard`. All cards show the spinner when any claim is in progress.

**Approach:** Track which withdrawal index is being claimed. Only pass signing/confirming state to that specific card.

**Files:**
- `src/components/withdrawals/WithdrawalQueue.tsx` — add `claimingIndex` state, pass `isSigningTx`/`isConfirmingTx` only to the card at that index
- `src/components/withdrawals/WithdrawalCard.tsx` — no changes needed (already accepts these props)

**Tests:** `WithdrawalCard.test.tsx` — existing tests cover per-card signing state.

---

### D. Feature Enhancement (Fixes #9, #10, #18)

#### Fix #9 — Add more info to unstaking period tooltip

The current info text is minimal. Add a tooltip with more context about what happens during the unstaking period.

**Files:**
- `src/components/staking/UndelegateDialog.tsx:100-104` — wrap the `<Info>` icon with a `<Tooltip>` component explaining: tokens are locked during the unstaking period, they don't earn rewards, and must be claimed manually after the period ends
- `src/components/staking/DelegateDialog.tsx:246-249` — same tooltip on the info line

#### Fix #10 — Fix inconsistent validator address display

When `useWithdrawalValidators` can't find a validator for a withdrawal index, it returns `0x0000...` and `ValidatorLabel` renders `null`. This leaves some cards without validator info.

**Approach:** Show a fallback like "Unknown validator" instead of hiding the label entirely.

**Files:**
- `src/components/withdrawals/WithdrawalCard.tsx:23-31` — in `ValidatorLabel`, show `"Unknown validator"` when address is zero or metadata is missing

#### Fix #18 — Batch withdrawal claims via multisend in SafeApp mode

When multiple withdrawals are claimable, allow claiming all at once using Safe's batch transaction feature (already used for approve+stake in `useBatchStake`).

**Approach:** Follow the existing `useBatchStake` pattern in `useStakingWrites.ts`. Create a `useBatchClaimWithdrawals` hook that sends N `claimWithdrawal()` calls as a batch.

**Files:**
- `src/hooks/useStakingWrites.ts` — add `useBatchClaimWithdrawals(count)` hook following `useBatchStake` pattern
- `src/components/withdrawals/WithdrawalQueue.tsx` — add "Claim All" button when in SafeApp mode and multiple withdrawals are claimable, using the batch hook
- `src/components/withdrawals/WithdrawalCard.tsx` — no changes

**Reference:** Brainstorm doc at `docs/brainstorms/2026-02-11-safe-batch-transactions-brainstorm.md` documents the batching pattern using wagmi's `useSendCalls` (EIP-5792).

---

## Implementation Order

Recommended order to minimize conflicts and test churn:

1. **Fix #8** (cursor) — 1 line change, zero test impact
2. **Fix #14** (green contrast) — CSS-only, zero test impact
3. **Fix #6** (dark mode toggle) — 1 line removal
4. **Fix #17** (heading rename) — 2 line change
5. **Fix #3** (onchain) — mechanical find-replace across 6 files + 3 tests
6. **Fix #4** (unstaking period) — 2 files + 2 tests
7. **Fix #1** (claim→withdraw copy) — 2 files + tests
8. **Fix #12** (Delegate terminology) — largest copy change, ~8 files + tests
9. **Fix #2** (integer rounding) — ~12 call sites
10. **Fix #11** (hide disconnect) — 1 file + tests
11. **Fix #13** (disabled buttons) — audit + possible fixes
12. **Fix #15** (relative timestamps) — 1 file + tests
13. **Fix #5** (SAFE logo) — new component + 3-4 file updates
14. **Fix #7** (connector icons) — 1 file
15. **Fix #16** (per-item spinner) — 1 file + tests
16. **Fix #9** (tooltip info) — 2 files
17. **Fix #10** (validator display) — 1 file
18. **Fix #18** (batch claims) — new hook + queue update (most complex)

## Acceptance Criteria

- [ ] All 18 fixes implemented per specifications above
- [ ] All copy changes reflected in corresponding test assertions
- [ ] `npm run lint` passes with zero new errors
- [ ] `npm test` — all tests pass (261+ tests)
- [ ] `npm run build` succeeds
- [ ] Green contrast ratio on Claim button meets WCAG AA (4.5:1+)
- [ ] SafeApp iframe: dark mode toggle visible, disconnect button hidden
- [ ] Batch "Claim All" works in SafeApp mode with 2+ claimable withdrawals
- [ ] No regressions in non-SafeApp wallet connection flow

## Dependencies & Risks

- **Fix #12 has the widest blast radius** — touches 8+ files and many test assertions. Do this carefully with a full test run after.
- **Fix #18 is the only feature-level change** — requires new hook + UI. Could be split into a separate PR if the other 17 fixes are ready first.
- **Fix #7 depends on wagmi connector.icon availability** — verify the icon property exists at runtime for each connector type.
- **No new dependencies needed** — all fixes use existing libraries and patterns.

## Shared Utility Opportunity

Multiple files duplicate `const isSafeApp = window.self !== window.top`. Consider extracting to `src/lib/isSafeApp.ts` during this work, but only if it reduces complexity (not a standalone task).

## References & Research

### Internal References
- SafeApp iframe detection: `src/hooks/useDarkMode.ts:3`, `src/hooks/useStakingWrites.ts:11`, `src/hooks/useAutoConnect.ts:18`, `src/components/wallet/ConnectButton.tsx:14`
- Token formatting: `src/lib/format.ts:4-17`
- Button variants: `src/components/ui/button.tsx:6-30`
- Batch staking pattern: `src/hooks/useStakingWrites.ts:50-122`
- SAFE token logo SVG: `src/assets/safe-token-logo.svg`
- Dark mode toggle conditional: `src/components/layout/Header.tsx:62`
- Brainstorm: `docs/brainstorms/2026-02-11-safe-batch-transactions-brainstorm.md`
- CLAUDE.md terminology guidance: "UI uses 'delegation' terminology externally"
