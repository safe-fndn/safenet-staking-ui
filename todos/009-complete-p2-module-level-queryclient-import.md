---
status: complete
priority: p2
issue_id: "009"
tags: [code-review, architecture]
dependencies: []
---

# Remove Module-Level queryClient Import from main.tsx

## Problem Statement

The `queryClient` instance is created and exported from `main.tsx`, then imported at module level in other files. This creates a tight coupling to the app entry point and makes testing harder.

## Findings

- `src/main.tsx` creates and exports `queryClient`
- Other modules import it at module level for cache invalidation or direct queries
- This bypasses React Query's provider pattern
- Makes unit testing difficult (can't provide a test-specific client)
- Circular dependency risk since `main.tsx` is the entry point

## Proposed Solutions

### Option 1: Move queryClient to dedicated module

**Approach:** Create `src/config/queryClient.ts` that exports the client. Both `main.tsx` and consumers import from there.

**Pros:**
- Breaks circular dependency risk
- Clear module ownership
- Easy to swap in tests

**Cons:**
- Still module-level singleton

**Effort:** 30 minutes

**Risk:** Low

---

### Option 2: Use `useQueryClient()` hook everywhere

**Approach:** Replace all module-level imports with React Query's `useQueryClient()` hook.

**Pros:**
- Follows React Query's intended pattern
- Naturally testable via provider
- No singletons

**Cons:**
- Only works inside components/hooks
- May need refactoring of utility functions that invalidate cache

**Effort:** 1-2 hours

**Risk:** Low

## Recommended Action

**To be filled during triage.**

## Technical Details

**Affected files:**
- `src/main.tsx` — move queryClient creation out
- All files importing queryClient from main.tsx
- New: `src/config/queryClient.ts` (Option 1)

## Acceptance Criteria

- [ ] queryClient not exported from main.tsx
- [ ] No circular dependency warnings
- [ ] React Query cache invalidation still works
- [ ] Tests pass

## Work Log

### 2026-03-02 - Initial Discovery

**By:** Claude Code (architecture-strategist agent)

**Actions:**
- Identified module-level queryClient import pattern
- Noted circular dependency risk with main.tsx
