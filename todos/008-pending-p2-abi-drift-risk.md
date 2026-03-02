---
status: pending
priority: p2
issue_id: "008"
tags: [code-review, architecture]
dependencies: []
---

# Consolidate ABI Definitions Between Main and Admin Apps

## Problem Statement

The main app and admin app each maintain separate ABI files that may reference the same contracts. If ABIs drift out of sync, one app could call functions with wrong signatures.

## Findings

- Main app ABIs: `src/abi/stakingAbi.ts`, `src/abi/erc20Abi.ts`
- Admin app ABIs: `admin/src/abi/merkleDropAbi.ts`, plus any staking/token ABIs
- No shared ABI source between the two apps
- Both use `parseAbi` with human-readable signatures (reduces but doesn't eliminate drift risk)
- Currently low risk since they reference mostly different functions, but grows as features are added

## Proposed Solutions

### Option 1: Shared ABI package/directory

**Approach:** Create a `shared/abi/` directory at project root that both apps import from.

**Pros:**
- Single source of truth for all ABIs
- Eliminates drift entirely

**Cons:**
- Adds cross-app dependency
- Both apps need import path configuration

**Effort:** 1-2 hours

**Risk:** Low

---

### Option 2: Keep separate, add CI check

**Approach:** Keep ABIs separate but add a lint/CI check that verifies function signatures match when the same contract is referenced.

**Pros:**
- No structural changes
- Catches drift at CI time

**Cons:**
- Reactive, not preventive
- More complex CI setup

**Effort:** 2-3 hours

**Risk:** Low

## Recommended Action

**To be filled during triage.**

## Technical Details

**Affected files:**
- `src/abi/stakingAbi.ts`
- `src/abi/erc20Abi.ts`
- `admin/src/abi/merkleDropAbi.ts`
- Potentially new: `shared/abi/` or similar

## Acceptance Criteria

- [ ] ABI definitions are either shared or verified in CI
- [ ] No duplicate function signatures with different parameters
- [ ] Both apps build successfully
- [ ] Tests pass

## Work Log

### 2026-03-02 - Initial Discovery

**By:** Claude Code (architecture-strategist agent)

**Actions:**
- Identified separate ABI files in main and admin apps
- Assessed current drift risk as low but growing
