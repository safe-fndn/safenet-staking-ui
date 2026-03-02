---
status: complete
priority: p1
issue_id: "002"
tags: [code-review, architecture, quality]
dependencies: []
---

# Add React Error Boundaries

## Problem Statement

The application has no React error boundaries. Any unhandled rendering error in a component will crash the entire app with a white screen. This is especially critical for a financial dApp where users may have pending transactions.

## Findings

- No `ErrorBoundary` component exists anywhere in the codebase
- `src/App.tsx` renders all routes without error boundary wrapping
- Key risk areas: contract read hooks that could throw on malformed data, recharts rendering, validator data parsing
- A single component error (e.g., in `StakeDistribution` chart) would take down the entire app

## Proposed Solutions

### Option 1: Route-level error boundaries

**Approach:** Wrap each route's lazy-loaded component with an error boundary that shows a fallback UI and retry button.

**Pros:**
- Isolates page-level crashes
- User can navigate to other pages even if one crashes
- Works naturally with React.lazy + Suspense

**Cons:**
- Doesn't protect shared layout components

**Effort:** 2-3 hours

**Risk:** Low

---

### Option 2: Route-level + section-level boundaries

**Approach:** Add route-level boundaries plus granular boundaries around high-risk sections (charts, contract data displays, withdrawal queue).

**Pros:**
- Maximum resilience — chart crash doesn't take down the whole page
- Better UX with targeted fallbacks

**Cons:**
- More boilerplate
- Need to decide boundary granularity

**Effort:** 4-5 hours

**Risk:** Low

## Recommended Action

**To be filled during triage.**

## Technical Details

**Affected files:**
- `src/App.tsx` — route definitions need boundary wrapping
- New file: `src/components/ErrorBoundary.tsx`
- Optionally: individual page components for section-level boundaries

**High-risk components:**
- `src/components/StakeDistribution.tsx` (recharts)
- `src/components/WithdrawalQueue.tsx` (contract data)
- `src/components/RewardsSection.tsx` (Merkle proof data)

## Acceptance Criteria

- [ ] Error boundary component created with fallback UI
- [ ] All routes wrapped with error boundaries
- [ ] Simulated component error shows fallback, not white screen
- [ ] User can navigate away from a crashed route
- [ ] Tests pass

## Work Log

### 2026-03-02 - Initial Discovery

**By:** Claude Code (architecture-strategist agent)

**Actions:**
- Confirmed zero error boundaries in codebase
- Identified high-risk rendering areas
- Rated as HIGH priority architectural gap

## Notes

- React docs recommend error boundaries as a standard practice for production apps
- Especially important for dApps where users need access to withdrawal/claim functionality
