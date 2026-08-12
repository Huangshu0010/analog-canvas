---
status: completed
experience: none
---

# Organize Editor Source Tree

## Goal

Replace the flat editor `src/` layout with explicit app, canvas, document,
component, demo, presentation, and feature-domain directories while preserving
every module export, runtime call chain, test, and browser behavior.

## State and Ownership

Start state from `git status --short --branch`:

```text
## main...origin/main
```

The worktree is clean, and the accepted architecture branch is already
identical to local and remote-tracking `main`. This target runs directly on
local `main` as requested and owns:

- `apps/editor/src/**` (mechanical moves and relative-import repairs)
- `apps/editor/e2e/**/*.ts` (moved-module import repairs only)
- `plan/2026-08-10-organize-editor-source-tree/plan.md`
- `plan/log.md` (close-out entry only)

Package contracts under `packages/`, E2E behavior, configuration, styles, and
public entry paths are read-only. Root `main.tsx`, `styles.css`, and
`vite-env.d.ts` remain stable entry/infrastructure files; only `main.tsx`'s App
import changes.

## Work

1. Move modules and colocated tests into a documented domain tree without
   changing implementation bodies.
2. Recalculate all relative imports from their old resolved targets so moves
   cannot silently redirect a dependency.
3. Verify rename integrity, no stale old paths, import resolution, complete
   unit/type/build/browser behavior, and a clean worktree after commit.

## Validation

- Verify every planned old path moved exactly once and each implementation
  remains beside its test
- Verify every relative TypeScript import resolves after the move
- Changed-file Prettier
- Full `pnpm test`
- Full `pnpm typecheck`
- `pnpm --filter @icm/editor build`
- Full `pnpm test:e2e`
- `git diff --check`
- `git status --short --branch`

This is intentionally one mechanical target: splitting moves across domains
would leave temporary mixed import paths and create avoidable merge points in
the central App shell. No behavior edits are authorized in this commit.

## Commit Intent

Commit as:

```text
refactor(editor): organize source by domain
```

## Outcome

Moved all 57 formerly flat editor modules and their colocated tests into the
documented domain tree. The final architecture separates app composition,
interaction contracts, canvas infrastructure, document lifecycle, reusable
components, demos, presentation policy, snap infrastructure, and five editing
features. Shared instance geometry moved to `canvas/`, and document navigation
and interaction contracts moved below `app/`, eliminating reverse feature-to-
app and wiring-to-selection dependencies.

Only file locations, relative imports, one E2E type import, and the new source
architecture README changed; implementation behavior remained untouched.
Validation passed: all 68 editor TypeScript relative imports resolve, all 77
Vitest files and 440 tests passed, repository typecheck passed, editor
production build passed, all 59 Playwright flows passed, changed-file Prettier
passed, and `git diff --check` passed. The pre-existing large-chunk warning
remains.
