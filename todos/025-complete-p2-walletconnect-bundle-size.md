---
status: complete
priority: p2
issue_id: "025"
tags: [code-review, performance]
dependencies: []
---

# Dynamic-Import WalletConnect to Reduce Bundle Size (~1.8MB)

## Problem Statement

WalletConnect/Reown adds ~1.8MB (500KB gzipped) to the bundle even when the `VITE_WALLETCONNECT_PROJECT_ID` env var is not set. The conditional array spread cannot be tree-shaken by Vite.

## Findings

- `src/config/wagmi.ts` — WalletConnect imported statically
- Bundle chunks: `core-DJRo1_DS.js` (607KB), `index-B3_sXUo_.js` (503KB), `index-BIi_xRdB.js` (640KB), `w3m-modal-Bbz8jxWj.js` (165KB)
- Total: ~1.9MB minified, ~548KB gzipped
- Conditional `...(projectId ? [walletConnect()] : [])` cannot be tree-shaken

## Proposed Solutions

### Option 1: Dynamic import WalletConnect

**Approach:** Use `await import("wagmi/connectors")` to lazily load WalletConnect only when configured.

**Pros:**
- ~1.8MB savings when WalletConnect not configured
- Loaded asynchronously even when configured (not blocking initial render)

**Cons:**
- Requires async config initialization
- Testing complexity

**Effort:** 1-2 hours

**Risk:** Medium (must test all connector flows)

---

### Option 2: manualChunks for parallel loading

**Approach:** Add WalletConnect to Vite `manualChunks` so it loads in parallel, not blocking the critical path.

**Pros:**
- Simpler implementation
- Still loads WalletConnect, just non-blocking

**Cons:**
- Doesn't reduce total download size

**Effort:** 30 minutes

**Risk:** Low

## Recommended Action

**To be filled during triage.**

## Technical Details

**Affected files:**
- `src/config/wagmi.ts` — connector setup
- `vite.config.ts` — potentially for manualChunks

## Acceptance Criteria

- [ ] WalletConnect not bundled when env var is unset (Option 1)
- [ ] All wallet connectors still work correctly
- [ ] Build succeeds
- [ ] Tests pass

## Work Log

### 2026-03-02 - Initial Discovery

**By:** Claude Code (performance-oracle agent)

**Actions:**
- Analyzed build output chunk sizes
- Identified ~1.8MB WalletConnect bundle weight

### 2026-03-02 - Resolved (Option 2: manualChunks)

**By:** Claude Code (agent)

**Actions:**
- Replaced static `manualChunks` object with function-based approach
- Function matches all `@walletconnect/` and `@reown/` modules (including transitive deps) by path, isolating them into a `vendor-walletconnect` chunk
- Result: 269KB (83KB gz) WalletConnect chunk loads in parallel instead of blocking the critical path
- Build succeeds, all 278 tests pass, lint clean
