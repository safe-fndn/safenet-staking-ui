---
title: "feat: Add unit and integration tests for transaction flows"
type: feat
date: 2026-02-16
---

# Add Unit and Integration Tests for Transaction Flows

## Overview

The safenet-staking-ui has **no unit or integration test framework** (CLAUDE.md: "No test framework is configured"). The only existing tests are Playwright E2E tests in `e2e/` which cover UI interactions but not actual transaction logic, hook state transitions, or error handling.

This plan introduces **Vitest** for unit and integration testing, covering all transaction flows: delegate, undelegate, claim withdrawal, and wallet connection. The existing E2E mock infrastructure (`e2e/mocks/`) provides proven patterns to build on.

## Problem Statement / Motivation

- Write hooks (`useStake`, `useInitiateWithdrawal`, `useClaimWithdrawal`, `useBatchStake`) have complex state machines (idle -> signing -> confirming -> success/error) with no automated verification
- The multi-step DelegateDialog (Approve -> Stake -> Done) has coordination logic between `useTokenAllowance` and `useStake` that's untested
- Cache invalidation via `useInvalidateOnSuccess()` is critical for UI consistency but never verified
- Pure utility functions (`format.ts`, `errorFormat.ts`) have no regression protection
- CI (`security-audit.yml`, `deploy-ipfs.yml`) runs no tests before deployment

## Proposed Solution

### Testing Stack

| Dependency | Purpose |
|------------|---------|
| `vitest` | Test runner (native Vite integration) |
| `@vitest/coverage-v8` | Coverage reporting |
| `@testing-library/react` | Component rendering + queries |
| `@testing-library/user-event` | User interaction simulation |
| `jsdom` | Browser environment for tests |

### Test Directory Structure

```
src/
  lib/__tests__/
    format.test.ts              # Pure function tests
    errorFormat.test.ts         # Error formatting tests
  hooks/__tests__/
    useStake.test.ts            # Stake write hook
    useInitiateWithdrawal.test.ts
    useClaimWithdrawal.test.ts
    useBatchStake.test.ts
    useTokenAllowance.test.ts
    useStakingReads.test.ts     # Read hooks
    useValidators.test.ts
    useGasEstimate.test.ts
    useTransactionHistory.test.ts
  components/__tests__/
    DelegateDialog.test.tsx     # Multi-step delegation flow
    UndelegateDialog.test.tsx   # Withdrawal initiation
    AmountInput.test.tsx        # Input + percentage shortcuts
    WithdrawalCard.test.tsx     # Cooldown + claim button
  __tests__/
    test-utils/
      render-with-providers.tsx # WagmiProvider + QueryClient wrapper
      mock-config.ts            # Wagmi mock connector config
      test-data.ts              # Shared constants (reuse from e2e)
```

## Technical Approach

### Phase 1: Infrastructure Setup

**Install dependencies and configure Vitest.**

`vitest.config.ts`:
```typescript
import { defineConfig, mergeConfig } from "vitest/config"
import viteConfig from "./vite.config"

export default mergeConfig(viteConfig, defineConfig({
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/__tests__/test-utils/setup.ts"],
    include: ["src/**/*.test.{ts,tsx}"],
    coverage: {
      provider: "v8",
      include: ["src/lib/**", "src/hooks/**", "src/components/**"],
    },
  },
}))
```

`package.json` scripts:
```json
{
  "test": "vitest",
  "test:run": "vitest run",
  "test:coverage": "vitest run --coverage"
}
```

**Test utilities (`src/__tests__/test-utils/render-with-providers.tsx`):**
- Wrapper component that provides `WagmiProvider`, `QueryClientProvider`, `TooltipProvider`, `ToastProvider`
- Fresh `queryClient` per test to avoid cross-test pollution
- Mock wagmi config using `mock` connector from `wagmi/connectors`

**Shared test data (`src/__tests__/test-utils/test-data.ts`):**
- Reuse constants from `e2e/fixtures/test-data.ts` (addresses, amounts, chain ID)
- Add hook-specific test values (tx hashes, gas prices)

### Phase 2: Unit Tests — Pure Functions

**Target files:**
- `src/lib/format.ts` — `formatTokenAmount`, `truncateAddress`, `formatCountdown`, `formatTimestamp`
- `src/lib/errorFormat.ts` — `formatContractError`
- `src/lib/clipboard.ts` — `copyToClipboard`

**Test cases for `format.ts`:**

| Function | Test Case |
|----------|-----------|
| `formatTokenAmount` | Zero value, small decimals, large numbers (>1M), max uint256, negative (if applicable) |
| `truncateAddress` | Standard 42-char address, short address, empty string |
| `formatCountdown` | 0 seconds, under 1 hour, multi-day, negative (expired) |
| `formatTimestamp` | Current time, epoch 0, future date |

**Test cases for `errorFormat.ts`:**

| Scenario | Expected Output |
|----------|-----------------|
| `ContractFunctionExecutionError` with known selector | User-friendly message |
| `UserRejectedRequestError` | "Transaction rejected by user" |
| `InsufficientFundsError` | "Insufficient funds for gas" |
| Unknown error | Generic fallback message |

### Phase 3: Unit Tests — Hooks

**Mock strategy:** Mock wagmi hooks at the module level using `vi.mock("wagmi")`. Each write hook test verifies the state machine transitions.

#### `useStake` / `useInitiateWithdrawal` / `useClaimWithdrawal`

Each write hook follows the same unified interface. Test matrix:

| State | `isSigningTx` | `isConfirmingTx` | `isSuccess` | `error` |
|-------|---------------|-------------------|-------------|---------|
| Idle | false | false | false | null |
| Signing (wallet prompt) | true | false | false | null |
| Confirming (on-chain) | false | true | false | null |
| Success | false | false | true | null |
| User rejected | false | false | false | UserRejectedError |
| Contract revert | false | false | false | ContractError |

**Additional hook test cases:**
- `reset()` returns hook to idle state
- `txHash` is set after signing, persists through confirmation
- Cache invalidation fires on `isSuccess` (verify `queryClient.invalidateQueries` called)

#### `useTokenAllowance`

| Scenario | Expected |
|----------|----------|
| Allowance = 0 | `needsApproval = true` |
| Allowance < requested amount | `needsApproval = true` |
| Allowance >= requested amount | `needsApproval = false` |
| Allowance = max uint256 | `needsApproval = false` |
| Address undefined (disconnected) | Query disabled, no fetch |

#### `useBatchStake`

| Scenario | Expected |
|----------|----------|
| Single validator batch | Calls `useSendCalls` with approve+stake |
| `isReverted` true | Shows revert error |
| Polls `useCallsStatus` until success | State transitions correctly |

#### `useStakingReads`

| Hook | Key Assertions |
|------|----------------|
| `useTotalStaked` | Returns BigInt, refetches on interval |
| `useUserTotalStake` | Disabled when `address` is undefined |
| `useUserStakeOnValidator` | Passes validator address to contract call |
| `useWithdrawDelay` | Returns seconds as BigInt |
| `useUserPendingWithdrawals` | Returns array of withdrawal structs |

#### `useValidators`

| Scenario | Expected |
|----------|----------|
| Normal response | Parses `ValidatorUpdated` events, returns sorted array |
| RPC block-range limit hit | Falls back to chunked fetching |
| No events found | Returns empty array |

#### `useGasEstimate`

| Scenario | Expected |
|----------|----------|
| Valid params | Returns `{ estimatedGas, gasPrice, totalCost }` |
| Invalid params | Returns null (silent catch) |
| Debounce: rapid input changes | Only calls estimateGas once after 500ms settle |

#### `useTransactionHistory`

| Scenario | Expected |
|----------|----------|
| User with events | Returns last 50, sorted by block desc |
| Optional validator filter | Filters by validator address |
| No events | Returns empty array |

### Phase 4: Integration Tests — Transaction Flows

These tests render actual components with the full provider stack but mock the viem transport layer.

#### Delegate Flow (DelegateDialog)

```
Test: "Complete delegation with approval"
1. Render DelegateDialog with mock validator, balance=1000, allowance=0
2. Enter amount "100"
3. Verify stepper shows: [Approve] -> Delegate -> Done
4. Click "Approve" -> mock wallet signs -> mock tx confirms
5. Verify stepper advances: Approve -> [Delegate] -> Done
6. Click "Delegate" -> mock wallet signs -> mock tx confirms
7. Verify stepper shows: Approve -> Delegate -> [Done]
8. Verify success toast rendered
9. Verify queryClient.invalidateQueries was called
```

```
Test: "Delegation without approval (sufficient allowance)"
1. Render DelegateDialog with allowance=MAX_UINT256
2. Enter amount "100"
3. Verify stepper shows: [Delegate] -> Done (no approval step)
4. Click "Delegate" -> mock confirms
5. Verify success flow
```

```
Test: "Delegation fails - user rejects"
1. Render DelegateDialog, enter amount
2. Click "Delegate" -> mock wallet rejects
3. Verify error state shown
4. Verify dialog remains open (user can retry or close)
```

```
Test: "Amount validation"
1. Render DelegateDialog with balance=1000
2. Verify submit disabled when amount empty
3. Verify submit disabled when amount > balance
4. Click 25% button -> verify amount = 250
5. Click MAX button -> verify amount = 1000
6. Verify gas estimate appears after debounce
```

#### Undelegate Flow (UndelegateDialog)

```
Test: "Initiate withdrawal"
1. Render UndelegateDialog with stakeOnValidator=500
2. Enter amount "200"
3. Verify gas estimate displays
4. Click "Initiate Withdrawal" -> mock signs -> mock confirms
5. Verify success toast with withdrawal period info
```

```
Test: "Cannot undelegate more than staked"
1. Render with stakeOnValidator=100
2. Enter "200" -> verify submit disabled
3. Click MAX -> verify amount = 100
```

#### Claim Withdrawal Flow (WithdrawalCard)

```
Test: "Claim ready withdrawal"
1. Render WithdrawalCard with cooldown elapsed
2. Verify "Claim" button enabled
3. Click "Claim" -> mock signs -> mock confirms
4. Verify success toast
```

```
Test: "Withdrawal in cooldown"
1. Render WithdrawalCard with cooldown remaining
2. Verify countdown timer displays
3. Verify "Claim" button disabled
4. Verify progress bar shows correct percentage
```

#### Wallet Connection (ConnectButton)

```
Test: "Connect and disconnect"
1. Render ConnectButton in disconnected state
2. Click "Connect Wallet"
3. Verify connector options shown (filtered to browserWallet, walletConnect, safe)
4. Select connector -> mock connection
5. Verify address displayed
6. Click disconnect -> verify disconnected state
```

### Phase 5: CI Integration

Add test job to `.github/workflows/security-audit.yml`:

```yaml
test:
  runs-on: ubuntu-24.04
  steps:
    - uses: actions/checkout@v4
    - uses: actions/setup-node@v4
      with:
        node-version-file: ".nvmrc"
    - run: npm ci --ignore-scripts
    - run: npm run test:run
    - run: npm run test:coverage
```

Update `.husky/pre-commit`:
```bash
npm run lint && npx tsc --noEmit && npm run test:run
```

## Acceptance Criteria

### Infrastructure
- [x] Vitest configured with jsdom environment and path alias support (`@/*`)
- [x] Test utilities created: provider wrapper, mock wagmi config, shared test data
- [x] `npm test` runs all tests, `npm run test:coverage` generates report
- [x] Tests pass in CI (GitHub Actions)

### Unit Tests — Utilities
- [x] `format.ts`: All 4 functions tested with edge cases
- [x] `errorFormat.ts`: Known contract errors + fallback tested
- [x] `clipboard.ts`: Success and fallback paths tested

### Unit Tests — Hooks
- [x] All 3 write hooks: Full state machine (idle -> signing -> confirming -> success + error paths)
- [x] `useBatchStake`: Batch flow with polling
- [x] `useTokenAllowance`: Approval detection for all allowance states
- [x] `useStakingReads`: Query enabled/disabled based on address, correct contract params
- [x] `useValidators`: Event parsing, chunked fallback, sorting
- [x] `useGasEstimate`: Debounce behavior, error handling
- [ ] `useTransactionHistory`: Filtering, sorting, limit (no hook exists yet)

### Integration Tests — Flows
- [x] Delegate with approval (multi-step stepper progression)
- [x] Delegate without approval (skip approval step)
- [x] Delegate error (user rejection, contract revert)
- [x] Amount input validation (empty, over-balance, percentage shortcuts)
- [x] Undelegate with amount validation
- [x] Claim ready withdrawal
- [x] Withdrawal in cooldown (timer, disabled button)
- [ ] Wallet connect/disconnect (deferred — requires complex connector mocking)

### CI
- [x] Test job added to GitHub Actions workflow
- [ ] Pre-commit hook runs tests (opted not to — adds latency to every commit)

## Dependencies & Risks

| Risk | Mitigation |
|------|------------|
| React 19 compatibility with `@testing-library/react` | Verify RTL supports React 19 (v16+ does) |
| wagmi v3 mock connector API changes | Pin wagmi version, check migration guide |
| Multicall3 batching in hook tests | Mock at wagmi hook level, not transport level, for unit tests |
| `jsdom` limitations (no real crypto, no window.ethereum) | Mock at module boundary; transport tests use mocked viem client |
| Test execution time in pre-commit | Run only affected tests via `vitest --changed` |

## Success Metrics

- All transaction flows have at least 1 happy path + 1 error path test
- Pure utility functions have >90% line coverage
- Hook tests cover all state transitions in the unified write interface
- Tests run in < 30s locally, < 60s in CI
- Zero flaky tests (no timing-dependent assertions without proper mocking)

## References

### Internal
- `e2e/mocks/rpc-handler.ts` — RPC mocking patterns (330 lines)
- `e2e/mocks/rpc-responses.ts` — ABI encoding utilities
- `e2e/mocks/ethereum-provider.ts` — EIP-1193 provider mock
- `e2e/fixtures/test-data.ts` — Shared test constants
- `e2e/fixtures/base.fixture.ts` — Connected/disconnected fixtures
- `src/hooks/useStakingWrites.ts` — Unified write hook interface
- `src/hooks/useStakingReads.ts` — Read hook patterns
- `src/components/staking/DelegateDialog.tsx` — Multi-step stepper logic

### External
- [Vitest documentation](https://vitest.dev/)
- [Testing Library React](https://testing-library.com/docs/react-testing-library/intro/)
- [wagmi testing guide](https://wagmi.sh/react/guides/testing)
