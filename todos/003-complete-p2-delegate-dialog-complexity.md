---
status: complete
priority: p2
issue_id: "003"
tags: [code-review, quality, architecture]
dependencies: []
---

# Refactor DelegateDialog — Reduce Complexity

## Problem Statement

`DelegateDialog.tsx` is 341 lines with 9 `useEffect` hooks, exceeding the project's 100-line/function limit and making the component hard to reason about. Multiple agents flagged this independently.

## Findings

- `src/components/DelegateDialog.tsx` — 341 lines, cyclomatic complexity well above 8
- 9 separate `useEffect` hooks managing step transitions, approval state, success/error toasts
- Step logic (Approve → Delegate → Done) is interleaved with UI rendering
- Similar patterns exist in `UndelegateDialog.tsx` but at smaller scale
- Flagged by: TypeScript reviewer, Architecture strategist, Pattern recognition

## Proposed Solutions

### Option 1: Extract step logic into a custom hook

**Approach:** Create `useDelegateFlow` hook that encapsulates step management, approval flow, and transaction state. Dialog component becomes pure UI.

**Pros:**
- Clear separation of concerns
- Hook is independently testable
- Dialog component drops to ~150 lines

**Cons:**
- New abstraction to maintain
- Hook may still be complex internally

**Effort:** 3-4 hours

**Risk:** Medium (must preserve exact behavior)

---

### Option 2: Extract into sub-components per step

**Approach:** Split into `ApproveStep`, `DelegateStep`, `DoneStep` components, each managing its own effects and UI.

**Pros:**
- Each component is small and focused
- Natural code splitting by step

**Cons:**
- Need to pass shared state between steps
- More files to manage

**Effort:** 4-5 hours

**Risk:** Medium

---

### Option 3: useReducer for step state machine

**Approach:** Replace the multiple useEffect hooks with a `useReducer` that models the step transitions as a state machine.

**Pros:**
- Explicit state transitions, easier to debug
- Eliminates cascading effects
- Well-tested pattern for multi-step flows

**Cons:**
- Learning curve for reducer pattern
- Action types add boilerplate

**Effort:** 3-4 hours

**Risk:** Low-Medium

## Recommended Action

**To be filled during triage.**

## Technical Details

**Affected files:**
- `src/components/DelegateDialog.tsx` — primary refactor target
- Potentially: `src/components/UndelegateDialog.tsx` — similar but smaller

## Acceptance Criteria

- [ ] DelegateDialog main component ≤150 lines
- [ ] No function exceeds 100 lines
- [ ] Cyclomatic complexity ≤8 per function
- [ ] All existing behavior preserved (approve → delegate → done flow)
- [ ] Gas estimation still works
- [ ] Toast notifications still fire correctly
- [ ] Tests pass

## Work Log

### 2026-03-02 - Initial Discovery

**By:** Claude Code (multiple agents)

**Actions:**
- TypeScript reviewer flagged complexity and effect count
- Architecture strategist flagged as architectural concern
- Pattern recognition specialist flagged repeated toast effect pattern

## Notes

- This was the most-flagged file across all review agents
- Consider applying the same pattern to UndelegateDialog if the refactor works well
