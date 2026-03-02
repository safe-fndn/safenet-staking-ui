---
status: complete
priority: p3
issue_id: "028"
tags: [code-review, performance]
dependencies: []
---

# Switch Admin App lucide-react to Deep Imports

## Problem Statement

The admin app uses barrel imports from `lucide-react` while the main app uses deep imports. Barrel imports force the bundler to parse the entire icon set, slowing dev server startup and HMR.

## Findings

- Admin files using barrel imports: ProposeValidators.tsx, RecoverTokens.tsx, ExecuteValidators.tsx, EventLog.tsx, SetMerkleRoot.tsx, ProposeDelay.tsx, MintToken.tsx, toaster.tsx
- Main app uses deep imports: `lucide-react/dist/esm/icons/loader-2`
- Production builds tree-shake correctly, but dev experience is impacted

## Proposed Solutions

### Option 1: Switch to deep imports

**Approach:** Replace `import { Loader2 } from "lucide-react"` with `import Loader2 from "lucide-react/dist/esm/icons/loader-2"`.

**Pros:**
- Faster dev server startup and HMR
- Consistent with main app pattern

**Cons:**
- More verbose import paths

**Effort:** 15 minutes

**Risk:** Low

## Recommended Action

**To be filled during triage.**

## Technical Details

**Affected files:**
- 8 admin component files

## Acceptance Criteria

- [ ] All admin lucide imports use deep paths
- [ ] Icons render correctly
- [ ] Build succeeds

## Work Log

### 2026-03-02 - Initial Discovery

**By:** Claude Code (performance-oracle agent)
