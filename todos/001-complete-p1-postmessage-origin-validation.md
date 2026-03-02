---
status: complete
priority: p1
issue_id: "001"
tags: [code-review, security]
dependencies: []
---

# Add Origin Validation to postMessage Handler

## Problem Statement

The `useDarkMode` hook listens for `message` events via `window.addEventListener("message", ...)` but does not validate the origin of incoming messages. Any page or iframe could send crafted messages to manipulate the theme state.

## Findings

- `src/hooks/useDarkMode.ts` — `window.addEventListener("message", handler)` accepts messages from any origin
- The handler processes `event.data` without checking `event.origin`
- While the impact is limited (only affects theme toggling), it violates security best practices for postMessage

## Proposed Solutions

### Option 1: Validate origin against known Safe Wallet origins

**Approach:** Check `event.origin` against a whitelist of expected parent origins (Safe Wallet app URL).

**Pros:**
- Correct security posture
- Minimal code change

**Cons:**
- Need to maintain origin whitelist

**Effort:** 30 minutes

**Risk:** Low

---

### Option 2: Use structured message format with type check

**Approach:** Require a specific `type` field in the message and validate format before processing. Combined with origin check.

**Pros:**
- Defense in depth
- More robust message handling

**Cons:**
- Slightly more code

**Effort:** 1 hour

**Risk:** Low

## Recommended Action

**To be filled during triage.**

## Technical Details

**Affected files:**
- `src/hooks/useDarkMode.ts` — message event handler

## Acceptance Criteria

- [ ] postMessage handler validates `event.origin`
- [ ] Unknown origins are ignored silently
- [ ] Dark mode still works correctly within Safe Wallet iframe
- [ ] Tests pass

## Work Log

### 2026-03-02 - Initial Discovery

**By:** Claude Code (security-sentinel agent)

**Actions:**
- Identified missing origin validation in postMessage handler
- Classified as P1 due to security best practice violation

## Notes

- This is a standard OWASP recommendation for all postMessage handlers
