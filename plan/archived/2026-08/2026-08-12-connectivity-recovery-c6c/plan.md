---
status: completed
experience: none
---

# Navigate to canonical locators across hierarchy

## Goal

Replace the editor's document-id stack and ad-hoc search/ERC document switching
with a hierarchy-frame-aware `navigateTo(locator)` flow that locates direct
objects and endpoints across imported Cells.

## State and Ownership

Start state from `git status --short --branch`:

```text
## roadmap/connectivity-routing-debugging...origin/roadmap/connectivity-routing-debugging
```

The worktree is clean. This target owns hierarchy path derivation and editor
navigation consumers. It does not alter transactions, hierarchy electrical
semantics, or search ranking.

- `packages/derived/src/hierarchy-navigation.ts`
- `packages/derived/src/hierarchy-navigation.test.ts`
- `packages/derived/src/index.ts`
- `apps/editor/src/app/App.tsx`
- `apps/editor/e2e/manual-editor.spec.ts`
- `plan/2026-08-12-connectivity-recovery-c6c/plan.md`
- `plan/log.md`

Read-only shared dependencies:

- canonical `ObjectLocator` / `HierarchyFrame`
- revision-aware connectivity index hierarchy edges
- editor document controller histories

## Work

1. Build a deterministic, cycle-safe hierarchy path from top document to a
   target document using canonical index edges.
2. Store editor navigation history as hierarchy frames, not bare document ids.
3. Centralize locator navigation and migrate Ctrl+F plus ERC diagnostic clicks
   to it, preserving object/endpoint selection and Net highlighting.
4. Cover deterministic path derivation plus existing search/ERC navigation
   consumers; a fixture-backed cross-Cell browser flow remains C6d because it
   needs a reusable imported-hierarchy editor fixture.

## Validation

- focused derived and editor Vitest/Playwright tests
- `corepack pnpm typecheck`
- `git diff --check`
- `git status --short --branch`

## Commit Intent

Commit as:

```text
feat(editor): navigate canonical locators across hierarchy
```

## Outcome

Added a deterministic, cycle-safe hierarchy path resolver built from canonical
connectivity index edges. The editor now stores `HierarchyFrame[]`, and one
`navigateToLocator()` migrates Ctrl+F and ERC target navigation while retaining
endpoint selection and current-document Net highlighting. Derived hierarchy,
App, search/ERC browser regressions, and typecheck passed. A reusable imported
hierarchy browser fixture is intentionally deferred to C6d rather than
manufacturing an unrelated fixture in this target.
