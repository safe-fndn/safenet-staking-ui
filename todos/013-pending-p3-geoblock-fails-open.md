---
status: pending
priority: p3
issue_id: "013"
tags: [code-review, security]
dependencies: []
---

# Geo-blocking Fails Open on Lookup Errors

## Problem Statement

The geo-blocking check in `useGeoblockCheck.ts` fails open — if the `api.country.is` lookup fails (network error, rate limit, API down), users from restricted countries can still access the app. This is a documented design decision but worth tracking.

## Findings

- `src/hooks/useGeoblockCheck.ts` — catch block allows access on any error
- This is explicitly documented as "fails open" in CLAUDE.md
- Alternative: fail closed (block on error) would cause false positives for legitimate users
- The sanctions API provides a separate layer of protection

## Proposed Solutions

### Option 1: Accept current behavior (document explicitly)

**Approach:** Keep fail-open with clear code comments explaining the rationale.

**Pros:**
- No false positives for legitimate users
- Sanctions API provides backup protection

**Cons:**
- Restricted users can access during API outages

**Effort:** 15 minutes (add comments)

**Risk:** Low

---

### Option 2: Add retry with timeout

**Approach:** Retry the geo check 2-3 times before failing open. If all retries fail, still fail open but log a warning.

**Pros:**
- Reduces window of fail-open behavior
- Still no false positives

**Cons:**
- Adds latency on failure
- Still fails open ultimately

**Effort:** 30 minutes

**Risk:** Low

## Recommended Action

**To be filled during triage.**

## Technical Details

**Affected files:**
- `src/hooks/useGeoblockCheck.ts`

## Acceptance Criteria

- [ ] Behavior is explicitly documented in code
- [ ] Decision on fail-open vs fail-closed is recorded
- [ ] Tests pass

## Work Log

### 2026-03-02 - Initial Discovery

**By:** Claude Code (security-sentinel agent)

**Actions:**
- Confirmed fail-open behavior
- Noted existing documentation in CLAUDE.md
- Classified as P3 since it's a conscious design decision
