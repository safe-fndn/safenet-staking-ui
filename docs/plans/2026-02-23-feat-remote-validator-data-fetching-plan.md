---
title: "feat: Fetch validator data from remote endpoint"
type: feat
date: 2026-02-23
brainstorm: docs/brainstorms/2026-02-23-remote-validator-data-brainstorm.md
---

# feat: Fetch validator data from remote endpoint

## Overview

Replace the static `src/data/validators.json` file and on-chain `ValidatorUpdated` event scanning with a single remote JSON endpoint. The endpoint provides all validator information (addresses, labels, commission, active status, participation rate) and will be updated hourly.

This consolidates two independent data sources (on-chain events + static JSON) into one, eliminating the complex chunked `getLogs` scanning and decoupling validator metadata from the build artifact.

## Problem Statement / Motivation

Currently, validator data flows through two separate channels merged at render time:
1. **On-chain event scanning** (`useValidators`) — discovers addresses and active status by scanning `ValidatorUpdated` events from a deploy block. Uses chunked fallback for RPC block-range limits. Slow on first load (~1-5s).
2. **Static JSON** (`validators.json`) — hardcoded labels, commission, and uptime. Requires a deploy to update.

The remote endpoint at `https://raw.githubusercontent.com/safe-fndn/safenet-validator-info/refs/heads/main/assets/safenet-validator-info.json` consolidates both into a single HTTP fetch that loads in ~200-500ms.

## Proposed Solution

### Architecture: Unified ValidatorInfo type

Expand the `ValidatorInfo` type to include all fields from the remote endpoint. Retire `useValidatorMetadata` as a separate hook. Provide a synchronous lookup helper that reads from the same React Query cache.

```ts
// New ValidatorInfo — replaces both old ValidatorInfo and ValidatorMetadata
interface ValidatorInfo {
  address: Address
  isActive: boolean
  label: string
  commission: number          // percentage (5, not 0.05) — normalized on ingest
  participationRate: number   // percentage (85.23, not 0.8523) — normalized on ingest
}
```

**Why merge rather than keep separate hooks:** The current `useValidatorMetadata` is synchronous — 7+ components assume instant data. Making it async would require adding loading states to every consumer. By folding metadata into `ValidatorInfo` (already async with loading/error handling), consumers that already handle `useValidators`' loading state get metadata for free.

### Data normalization (on ingest)

Transform the remote response in the fetch function:
- `commission`: `0.05` → `5` (multiply by 100)
- `participation_rate_14d`: `0.8523` → `85.23` (multiply by 100, round to 2 decimals)
- `address`: normalize to checksummed format via `getAddress()`
- `is_active` → `isActive` (camelCase)
- `participation_rate_14d` → `participationRate` (camelCase, shortened)

This keeps all display code unchanged (still renders `{value}%`).

### Endpoint URL configuration

Add `VITE_VALIDATOR_INFO_URL` env var with the GitHub raw URL as default. Allows staging/testing environments to point to different data.

### Validator lookup helper

Replace `useValidatorMetadata` with a non-hook helper that accepts the already-fetched validators array:

```ts
// Used by components that need to look up a single validator by address
// from the already-loaded validators list
function findValidator(
  validators: ValidatorInfo[] | undefined,
  address: string
): ValidatorInfo | null
```

Components that currently call `useValidatorMetadata(address)` will instead receive validators from a parent or call `useValidators()` directly and use `findValidator`.

## Technical Considerations

### Loading state transition

Components like `WithdrawalCard.ValidatorLabel` and `PortfolioBreakdown.ValidatorRow` currently get instant metadata. After this change, they depend on the `useValidators` query. During the initial fetch (~200-500ms), they show truncated addresses as fallback — consistent with the existing "unknown validator" behavior.

### Cache invalidation

`useStakingWrites.ts` invalidates `["validators"]` query key on successful staking transactions (line 25: `STAKING_EXTRA_KEYS`). This key must remain the same in the new hook to preserve this behavior. After invalidation, React Query re-fetches the remote endpoint, which won't reflect the on-chain change until the next hourly update. This is acceptable — the staking reads (`useReadContract`) poll every 30s and will reflect the on-chain state.

### Known tradeoff: endpoint-only validators

If a validator exists on-chain but is absent from the endpoint, the user's stake to it becomes invisible in the UI. The on-chain position still exists and can be managed via the contract directly. This is accepted per the brainstorm decision of "no fallback to on-chain scanning."

### Content Security Policy

If a CSP `connect-src` directive exists, it must include `raw.githubusercontent.com`. The current app does not set restrictive CSP headers (Vite dev server and static hosting), so this is not a concern today.

## Acceptance Criteria

### Functional

- [x] Validators page loads validator data from the remote endpoint
- [x] Dashboard shows correct validator count, labels, commission, and participation rates
- [x] Validator detail page displays commission and participation (14d) correctly
- [x] Search/filter on Validators page works with fetched labels
- [x] StakeDistribution chart uses fetched labels
- [x] WithdrawalCard shows fetched validator labels
- [x] "Uptime" label renamed to "Participation (14d)" in all 6 locations
- [x] Commission displays correctly (e.g., "5%" not "0.05%")
- [x] Participation rate displays correctly (e.g., "85.23%" not "0.8523%")
- [x] Deep-link `?delegate=0x...` still works after data loads

### Error handling

- [x] Endpoint down: validators page shows error message with retry button
- [x] Malformed JSON: graceful error, not a crash
- [x] Missing fields in a validator entry: entry skipped or defaults applied

### Non-functional

- [x] `VITE_VALIDATOR_INFO_URL` env var configures the endpoint (with default)
- [x] React Query cache: `staleTime: 5 * 60 * 1000`, default `refetchOnWindowFocus`
- [x] `src/data/validators.json` deleted
- [x] On-chain event scanning removed from `useValidators.ts`
- [x] `useValidatorMetadata.ts` removed (replaced by `findValidator` helper)
- [x] All tests pass (`yarn test`)
- [x] Lint passes (`yarn lint`)
- [x] Build succeeds (`yarn build`)

## MVP Implementation

### Phase 1: New fetch hook + type changes

#### `src/hooks/useValidators.ts` (rewrite)

```ts
import { useQuery } from "@tanstack/react-query"
import { type Address, getAddress } from "viem"

const DEFAULT_URL =
  "https://raw.githubusercontent.com/safe-fndn/safenet-validator-info/refs/heads/main/assets/safenet-validator-info.json"

export interface ValidatorInfo {
  address: Address
  isActive: boolean
  label: string
  commission: number
  participationRate: number
}

interface RawValidator {
  address: string
  label: string
  commission: number
  is_active: boolean
  participation_rate_14d: number
}

function isValidEntry(v: unknown): v is RawValidator {
  return (
    typeof v === "object" && v !== null &&
    typeof (v as RawValidator).address === "string" &&
    typeof (v as RawValidator).label === "string"
  )
}

async function fetchValidators(): Promise<ValidatorInfo[]> {
  const url = import.meta.env.VITE_VALIDATOR_INFO_URL || DEFAULT_URL
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Failed to fetch validators: ${res.status}`)
  const json: unknown = await res.json()
  if (!Array.isArray(json)) throw new Error("Invalid validator data format")
  return json.filter(isValidEntry).map((v) => ({
    address: getAddress(v.address),
    isActive: v.is_active ?? true,
    label: v.label,
    commission: Math.round(v.commission * 100 * 100) / 100,
    participationRate:
      Math.round((v.participation_rate_14d ?? 0) * 100 * 100) / 100,
  }))
}

export function useValidators() {
  return useQuery({
    queryKey: ["validators"],
    queryFn: fetchValidators,
    staleTime: 5 * 60 * 1000,
  })
}

// Lookup helper — synchronous once data is loaded
export function findValidator(
  validators: ValidatorInfo[] | undefined,
  address: string
): ValidatorInfo | null {
  if (!validators) return null
  const target = address.toLowerCase()
  return validators.find(
    (v) => v.address.toLowerCase() === target
  ) ?? null
}
```

#### `src/hooks/useValidatorMetadata.ts` (delete)

Remove this file entirely. All consumers migrate to `findValidator`.

#### `src/data/validators.json` (delete)

Remove the static data file.

### Phase 2: Update consumers

**Components using `useValidatorMetadata` → `findValidator`:**

Each component that called `useValidatorMetadata(address)` needs:
1. Access to the validators array (from `useValidators()` or passed as prop)
2. Replace `useValidatorMetadata(address)` with `findValidator(validators, address)`
3. Replace `metadata.uptime` with `metadata.participationRate`
4. Replace "Uptime" text with "Participation (14d)"

| Component | File | Changes |
|-----------|------|---------|
| `ValidatorCard` | `src/components/validators/ValidatorCard.tsx` | Add `validators` prop or `useValidators()`. Replace hook call. Rename uptime label. |
| `ValidatorDetailPage` | `src/pages/ValidatorDetailPage.tsx` | Already calls `useValidators()`. Replace hook. Rename uptime label. |
| `PortfolioBreakdown` | `src/components/dashboard/PortfolioBreakdown.tsx` | `ValidatorRow` needs validators array. Replace hook. |
| `UserPositions` | `src/components/dashboard/UserPositions.tsx` | `PositionRow` needs validators array. Replace hook. Rename uptime column. |
| `StakingSection` | `src/components/dashboard/StakingSection.tsx` | `PositionRow` needs validators array. Replace hook. Rename uptime column. |
| `WithdrawalCard` | `src/components/withdrawals/WithdrawalCard.tsx` | `ValidatorLabel` needs validators array. Replace hook. |

**Components directly importing `validators.json`:**

| Component | File | Changes |
|-----------|------|---------|
| `ValidatorList` | `src/components/validators/ValidatorList.tsx` | Remove JSON import (line 9). Use validators from `useValidators()` for search filtering. |
| `StakeDistribution` | `src/components/dashboard/StakeDistribution.tsx` | Remove JSON import (line 9). Accept validators as prop or call `useValidators()`. |

### Phase 3: Config and env updates

#### `.env.example`

Add: `VITE_VALIDATOR_INFO_URL=` (optional, with comment explaining the default)

#### `CLAUDE.md`

Update the Environment Variables table to include `VITE_VALIDATOR_INFO_URL`.
Update the Architecture section to reflect the remote fetch instead of static JSON + on-chain scanning.

### Phase 4: Test updates

**Hook tests (full rewrite):**

| Test file | Strategy |
|-----------|----------|
| `src/hooks/__tests__/useValidators.test.ts` | Mock `fetch` with remote endpoint response. Test normalization (commission × 100, participationRate × 100). Test error handling (network failure, malformed JSON, missing fields). Test address normalization. |
| `src/hooks/__tests__/useValidatorMetadata.test.ts` | Delete file (hook no longer exists). |

**Component test mock updates (update mock shape):**

All component tests that mock `useValidatorMetadata` need to:
1. Remove the `useValidatorMetadata` mock
2. Update the `useValidators` mock to return expanded `ValidatorInfo[]` with label, commission, participationRate
3. Update any assertions checking "Uptime" text → "Participation (14d)"
4. Update commission/participationRate mock values

| Test file | Mock changes |
|-----------|-------------|
| `src/components/__tests__/ValidatorCard.test.tsx` | Update `useValidators` mock data, remove metadata mock, update "Uptime" assertion |
| `src/pages/__tests__/ValidatorDetailPage.test.tsx` | Same |
| `src/components/__tests__/UserPositions.test.tsx` | Same + update "Uptime" column assertion |
| `src/components/__tests__/PortfolioBreakdown.test.tsx` | Update `useValidators` mock data, remove metadata mock |
| `src/components/__tests__/StakingSection.test.tsx` | Same + update "Uptime" column assertion |
| `src/components/__tests__/WithdrawalQueue.test.tsx` | Update metadata mock |
| `src/components/__tests__/WithdrawalCard.test.tsx` | Update metadata mock |
| `src/components/__tests__/ValidatorList.test.tsx` | Update `useValidators` mock data shape |

**Staking writes test:**

| Test file | Changes |
|-----------|---------|
| `src/hooks/__tests__/useStakingWrites.test.ts` | Verify `["validators"]` invalidation key still works (line 387). No change needed if queryKey stays `["validators"]`. |

**Test data fixtures:**

| File | Changes |
|------|---------|
| `src/__tests__/test-data.ts` | Update `MOCK_VALIDATORS` to match new `ValidatorInfo` shape |
| `e2e/fixtures/test-data.ts` | Update validator fixtures, remove `validators.json` comment |

## Dependencies & Risks

**Dependencies:**
- The remote endpoint must serve valid JSON (no trailing commas). Current endpoint has invalid JSON — must be fixed before this ships.
- `VITE_STAKING_DEPLOY_BLOCK` env var is still needed by `useWithdrawalValidators.ts` — do NOT remove it.

**Risks:**
- **Endpoint outage** → validators list empty, users cannot delegate/undelegate. Accepted tradeoff per brainstorm decision.
- **Stale endpoint data** → endpoint says validator is active but it was deregistered on-chain. Delegation tx reverts with contract error. Mitigated by `formatContractError` showing a user-friendly message.
- **Invisible positions** → user has stake to a validator absent from endpoint. Position not shown in UI. Accepted tradeoff.

## References

- Brainstorm: `docs/brainstorms/2026-02-23-remote-validator-data-brainstorm.md`
- Existing remote fetch pattern to follow: `src/hooks/useRewardProof.ts`
- React Query cache invalidation: `src/hooks/useStakingWrites.ts:13-25`
- Remote endpoint: https://github.com/safe-fndn/safenet-validator-info
