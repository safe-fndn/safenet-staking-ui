---
status: pending
priority: p3
issue_id: "018"
tags: [code-review, simplicity]
dependencies: []
---

# Inline ValidatorControls into ValidatorList

## Problem Statement

`ValidatorControls` is a 28-line wrapper around a single `<Input>` with a search icon. It is used exactly once in `ValidatorList.tsx`. The wrapper adds a file, an interface, and an import for no functional benefit.

## Findings

- `src/components/validators/ValidatorControls.tsx` — 28 lines, used once
- No logic, no state, pure JSX pass-through
- Could be 5 lines inline in ValidatorList

## Proposed Solutions

### Option 1: Inline into ValidatorList

**Approach:** Move the search input JSX directly into ValidatorList.tsx, delete ValidatorControls.

**Pros:**
- One fewer file
- Simpler codebase

**Cons:**
- ValidatorList gets slightly longer

**Effort:** 10 minutes

**Risk:** Low

## Recommended Action

**To be filled during triage.**

## Technical Details

**Affected files:**
- `src/components/validators/ValidatorList.tsx` — add inline JSX
- `src/components/validators/ValidatorControls.tsx` — delete

## Acceptance Criteria

- [ ] ValidatorControls.tsx deleted
- [ ] Search input works identically in ValidatorList
- [ ] Tests pass

## Work Log

### 2026-03-02 - Initial Discovery

**By:** Claude Code (code-simplicity-reviewer agent)
