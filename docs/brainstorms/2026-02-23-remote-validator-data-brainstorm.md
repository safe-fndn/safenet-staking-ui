# Brainstorm: Fetch Validator Data from Remote Endpoint

**Date:** 2026-02-23
**Status:** Ready for planning

## What We're Building

Replace the static `src/data/validators.json` file and on-chain validator event scanning with a single remote JSON endpoint that provides all validator information (addresses, labels, commission, active status, participation rate).

**Endpoint:** `https://raw.githubusercontent.com/safe-fndn/safenet-validator-info/refs/heads/main/assets/safenet-validator-info.json`
**Repo:** https://github.com/safe-fndn/safenet-validator-info
**Update frequency:** Hourly (currently static placeholder data, will be populated with real data)

## Why This Approach

The current system has two separate data sources that are merged at render time:
1. On-chain event scanning (`useValidators`) for validator addresses and active status
2. Static JSON (`validators.json`) for display metadata (label, commission, uptime)

The remote endpoint consolidates both into a single source, which:
- Eliminates the chunked `getLogs` scanning (slow, RPC-dependent, complex fallback logic)
- Provides richer metadata that can be updated without deploying the UI
- Decouples validator display data from the build artifact

## Key Decisions

1. **Single source of truth:** The remote endpoint replaces both `validators.json` (static metadata) and `useValidators` (on-chain event scanning). No fallback to on-chain scanning.

2. **Active status from endpoint:** The `is_active` field from the endpoint replaces on-chain `ValidatorUpdated` event tracking.

3. **Fetch strategy:** Fetch once on page load, cache with React Query (`staleTime` ~5 min). Re-fetch on window focus. No polling. Sufficient for hourly updates.

4. **UI label rename:** "Uptime" becomes "Participation (14d)" to reflect the actual metric (`participation_rate_14d`).

## Data Shape Mapping

### Remote endpoint (array):
```json
{
  "address": "0x...",
  "label": "Validator A",
  "commission": 0.05,
  "is_active": true,
  "participation_rate_14d": 0.8523
}
```

### Current internal model:
```ts
// useValidators returns:
{ address: Address, isActive: boolean }

// useValidatorMetadata returns:
{ label: string, commission: number, uptime: number } | null
```

### Key transformations needed:
- `commission`: 0.05 (decimal) -> 5 (percentage) OR update all display code to handle decimals
- `participation_rate_14d`: 0.8523 (decimal) -> display as "85.23%"
- `uptime` field renamed to `participation` or similar in internal model
- Array -> keyed-by-address map for efficient lookup

## Scope of Changes

### Remove:
- `src/data/validators.json` (static file)
- `src/hooks/useValidators.ts` (on-chain event scanning)
- Related tests

### Modify:
- `src/hooks/useValidatorMetadata.ts` -> becomes a real async hook using React Query
- 7 components using `useValidatorMetadata` hook (may need loading state handling)
- 2 components directly importing `validators.json` (`ValidatorList`, `StakeDistribution`)
- All UI labels showing "Uptime" -> "Participation (14d)"
- Commission display code if format changes

### New:
- Fetch hook for the remote endpoint (or fold into existing hook)

## Open Questions

1. **Endpoint reliability:** What happens if the GitHub raw URL is down? Show empty state? Cache last-known data in localStorage? (Current decision: no special fallback, React Query handles retries.)

2. **Malformed JSON:** The current endpoint JSON has trailing commas after some entries (invalid JSON). Will this be fixed before real data is populated?

3. **Commission format:** Should we normalize commission to percentage (5%) internally and keep all display code as-is, or update display code to handle decimals (0.05)?

4. **New validators:** If a new validator appears on-chain before the hourly endpoint update, it won't show in the UI until the next endpoint refresh. Is this acceptable?

5. **Endpoint URL configuration:** Should the endpoint URL be an environment variable (like `VITE_VALIDATOR_INFO_URL`) for flexibility across environments?
