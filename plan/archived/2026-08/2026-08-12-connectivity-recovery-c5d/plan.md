---
status: completed
experience: none
---

# Expand project-search results by concrete hierarchy path

## Goal

When the same child Cell is instantiated by multiple parents, return one search
result per reachable concrete `HierarchyFrame` chain instead of silently
choosing one document-only path; show the caller path in the dialog.

## State and Ownership

Start state from `git status --short --branch`:

```text
## roadmap/connectivity-routing-debugging...origin/roadmap/connectivity-routing-debugging
```

The worktree is clean. This target owns pure path enumeration, search result
expansion and dialog presentation. Canonical navigation consumes the resulting
locator unchanged.

- `packages/derived/src/hierarchy-navigation.ts`
- `packages/derived/src/hierarchy-navigation.test.ts`
- `packages/derived/src/project-search.ts`
- `packages/derived/src/project-search.test.ts`
- `apps/editor/src/features/search/project-search-dialog.tsx`
- `apps/editor/src/features/search/project-search-dialog.test.tsx`
- `docs/roadmap/connectivity-recovery-status.md`
- `plan/2026-08-12-connectivity-recovery-c5d/plan.md`
- `plan/log.md`

## Work

1. Enumerate deterministic concrete paths with cycle protection.
2. Expand best object search matches by all paths from the project top Cell.
3. Render caller path and retain direct Cell search behavior.
4. Record the resolved multiple-caller presentation gate.

## Validation

- focused hierarchy/search/dialog tests
- workspace typecheck
- `git diff --check` and status

## Commit Intent

```text
feat(search): expose concrete hierarchy caller paths
```

## Outcome

Search now enumerates each cycle-safe concrete caller path from the project
top Cell and carries that path in the canonical result locator. The dialog
renders its instance chain, while the prior direct and single-child navigation
behavior remains covered.

Validation passed: 12 focused hierarchy/search/dialog tests, two focused
browser search flows, workspace typecheck, targeted Prettier, and
`git diff --check`.
