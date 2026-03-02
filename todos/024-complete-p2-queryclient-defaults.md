---
status: complete
priority: p2
issue_id: "024"
tags: [code-review, performance]
dependencies: []
---

# Configure QueryClient Default Options

## Problem Statement

`QueryClient` is created with no default options (`staleTime: 0`), meaning every component mount triggers an immediate background refetch even if data was fetched milliseconds ago. Route transitions cause redundant RPC bursts.

## Findings

- `src/main.tsx:11` — `new QueryClient()` with no options
- Default `staleTime: 0` means data is always considered stale
- Navigating Dashboard → Validators → Dashboard causes every query to refetch
- Many hooks already set `refetchInterval: 15_000`, but staleTime is still 0

## Proposed Solutions

### Option 1: Set sensible defaults

**Approach:** Configure `staleTime: 30_000` to match polling interval.

```typescript
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      refetchOnWindowFocus: false,
    },
  },
})
```

**Pros:**
- Eliminates redundant refetches on route transitions
- 2-minute implementation
- Major impact on perceived performance

**Cons:**
- Data could be up to 30s stale on remount

**Effort:** 5 minutes

**Risk:** Low

## Recommended Action

**To be filled during triage.**

## Technical Details

**Affected files:**
- `src/main.tsx` — QueryClient configuration

## Acceptance Criteria

- [ ] QueryClient has explicit staleTime and gcTime
- [ ] Route transitions don't trigger redundant refetches
- [ ] Polling still works at expected intervals
- [ ] Tests pass

## Work Log

### 2026-03-02 - Initial Discovery

**By:** Claude Code (performance-oracle agents)
