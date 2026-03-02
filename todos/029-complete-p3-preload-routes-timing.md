---
status: complete
priority: p3
issue_id: "029"
tags: [code-review, performance]
dependencies: []
---

# Move Route Preloading to useEffect (After First Paint)

## Problem Statement

`requestIdleCallback(preloadAllRoutes)` runs at module evaluation time (top-level side effect) before React renders the first frame. If it fires quickly, preload fetches compete with critical initial resources.

## Findings

- `src/App.tsx:39-43` — `requestIdleCallback(preloadAllRoutes)` at module level
- Runs during bundle parse, before first React render
- Could compete with compliance checks and initial data fetches

## Proposed Solutions

### Option 1: Move to useEffect in App component

**Approach:** Trigger preload inside a `useEffect` so it runs after first meaningful paint.

**Pros:**
- Critical resources load first
- Preload only happens after app is interactive

**Cons:**
- Slightly later preload

**Effort:** 5 minutes

**Risk:** Low

## Recommended Action

**To be filled during triage.**

## Technical Details

**Affected files:**
- `src/App.tsx` — move `requestIdleCallback` into `useEffect`

## Acceptance Criteria

- [ ] Preloading occurs after first paint
- [ ] Lazy routes still load quickly when navigated to
- [ ] Tests pass

## Work Log

### 2026-03-02 - Initial Discovery

**By:** Claude Code (performance-oracle agent)
