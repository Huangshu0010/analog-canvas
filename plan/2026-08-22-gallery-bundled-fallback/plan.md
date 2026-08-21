---
status: completed
experience: none
---

# Bundled Tiles Only When the Gallery Is Empty

## Goal

The feed rendered the bundled Library examples unconditionally, so once the
community gallery gained its first real entries (the seeded pair happens to
be the same two circuits), the wall showed duplicates. The documented G1
contract already says bundled tiles appear "while the gallery is empty";
align the implementation: bundled starter tiles render only when the
feed has zero community entries (empty result or unreachable worker), and
disappear as soon as real content exists.

## State and Ownership

Branched from `origin/main` (post PR #150) as
`claude/gallery-bundled-fallback`; worktree clean.

Owned paths:

- `apps/editor/src/components/gallery-feed.tsx`
- `apps/editor/e2e/gallery.spec.ts`
- `plan/2026-08-22-gallery-bundled-fallback/plan.md`, `plan/log.md`

Shared dependencies: none beyond the feed markup its own spec exercises.

## Work

1. Gate the bundled-tile block on the community entry list being empty.
2. Flip the populated-feed e2e expectation (bundled tiles absent when
   community entries exist); the empty/unreachable scenarios keep proving
   the fallback.

## Validation

- `playwright`: `apps/editor/e2e/gallery.spec.ts`
- feed component unit test, repository typecheck, prettier
- `node scripts/check-test-impact.mjs --base origin/main`
- `git diff --check` and `git status --short --branch`

## Test Impact

- Decision: tests-updated
- Contracts: bundled starter tiles render exactly when the gallery has no
  community entries; a populated feed shows community tiles only
- Primary checks: `apps/editor/e2e/gallery.spec.ts`

## Commit Intent

Committed on `claude/gallery-bundled-fallback` under the user's standing
commit-push-merge direction as:

```text
fix(gallery): show bundled tiles only while the gallery is empty
```

## Outcome

Delivered: the bundled starter tiles now render only when the feed has zero
community entries (empty result or unreachable worker) and vanish as soon
as real content exists, matching the documented G1 contract and removing
the duplicate wall the first seeded entries exposed. Gallery Playwright
spec updated (populated feed shows community tiles alone; empty and
unreachable scenarios still prove the fallback) — 4/4 green with feed unit
tests, typecheck, prettier, test-impact, and diff checks.
