---
status: complete
priority: p3
issue_id: "019"
tags: [code-review, simplicity]
dependencies: []
---

# Remove Placeholder Pages (FAQ, Terms)

## Problem Statement

`FaqPage` and `TermsOfUsePage` contain only "TODO: Add content" placeholders. They add route definitions, lazy imports, preload entries, and footer links — all for pages that deliver no content.

## Findings

- `src/pages/FaqPage.tsx` — 9 lines, content is "TODO"
- `src/pages/TermsOfUsePage.tsx` — 9 lines, content is "TODO"
- Both routed in App.tsx, lazy-loaded, linked from footer
- YAGNI: shipped infrastructure for content that doesn't exist yet

## Proposed Solutions

### Option 1: Remove routes and pages until content exists

**Approach:** Delete pages, remove routes from App.tsx, remove footer links.

**Pros:**
- ~20 LOC removed
- No empty pages in production

**Cons:**
- Must re-add when content is ready

**Effort:** 15 minutes

**Risk:** Low

---

### Option 2: Keep routes, add actual content

**Approach:** Write the FAQ and Terms of Use content.

**Pros:**
- Pages become useful

**Cons:**
- Content needs review/approval

**Effort:** 2-4 hours (content creation)

**Risk:** Low

## Recommended Action

**To be filled during triage.**

## Technical Details

**Affected files:**
- `src/pages/FaqPage.tsx` — delete or populate
- `src/pages/TermsOfUsePage.tsx` — delete or populate
- `src/App.tsx` — remove routes if deleting
- `src/components/Layout.tsx` — remove footer links if deleting

## Acceptance Criteria

- [ ] Pages either contain real content or are removed
- [ ] No "TODO" placeholders in production
- [ ] Build succeeds
- [ ] Tests pass

## Work Log

### 2026-03-02 - Initial Discovery

**By:** Claude Code (code-simplicity-reviewer agent)
