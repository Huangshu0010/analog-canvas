---
status: completed
experience: none
---

# Insert Component Dialog and GUI Refinement

## Goal

Replace the permanent component library with a Virtuoso-style `I` insertion
dialog that combines categorized text selection with one authoritative symbol
preview, then refine the editor chrome so the canvas is visually primary,
interaction feedback is clearer, controls are consistent, and page-level
scrolling is eliminated.

## State and Ownership

Start state from `git status --short --branch`:

```text
## codex/insert-component-dialog
```

This is a clean, isolated worktree created from commit `d649c18`. The primary
worktree contains an unrelated active Snap Engine target with uncommitted
changes to `App.tsx` and `styles.css`; isolation prevents overwriting that
worker. This target may later require a focused rebase after the Snap Engine
target lands because both features touch the editor shell.

Owned paths:

- `apps/editor/src/App.tsx`
- `apps/editor/src/styles.css`
- `apps/editor/src/features/component-insert/**`
- `apps/editor/src/features/editor-shell/**`
- focused editor shortcut, component insertion, shell, and E2E tests
- `playwright.config.ts` for worktree-safe E2E server isolation
- `docs/specs/editor-interaction.md`
- this target plan and `plan/log.md`

Shared/read-only boundaries:

- Persisted Project/Document schemas, Edit Engine transactions, symbol
  definitions, formal schematic rendering, and Agent API remain unchanged.
- The active Snap Engine worktree is read-only and will not be modified.
- Symbol previews must reuse `renderSymbolDefinitionBody`; no second preview
  asset system is introduced.

## Work

1. Establish a component-insert feature boundary containing catalog filtering,
   categorized option navigation, the master/detail dialog, and focused tests.
2. Add the guarded `I` shortcut, dialog focus/keyboard behavior, Apply/Enter
   placement transition, recent-symbol ordering, and existing canvas preview.
3. Remove the permanent component library and convert the shell to a
   canvas-first layout while retaining the explicit Selection shelf.
4. Refine information density, floating controls, hover/tool/snap/selection
   feedback, low-interference zoom controls, empty-canvas guidance, and
   viewport-contained scrolling without changing formal export styling.
5. Update the normative editor interaction document and focused E2E coverage.

## Validation

- focused Vitest tests for component catalog/dialog behavior and shortcuts
- focused Playwright tests for `I` open/search/navigation/Apply/place/Escape,
  selection stability, viewport scrolling, and canvas controls
- `pnpm typecheck`
- `pnpm --filter @icm/editor build`
- real local-browser visual and interaction inspection
- `git diff --check`
- `git status --short --branch`

Editor-wide typecheck/build and real browser inspection are justified because
this target changes the application shell, global shortcut flow, and viewport
layout. Formal renderer and model suites are not expected unless focused checks
expose a shared-contract risk.

## Commit Intent

Commit as:

```text
feat(editor): add component insert dialog and refine workspace
```

## Outcome

Implemented the `I`-driven component insertion feature under
`features/component-insert/`: categorized text search, authoritative Symbol DSL
preview, keyboard selection, disabled invalid Apply, recent-within-category
ordering, pointer-following placement preview, placement rotation, and
single-shot commit/cancel. Removed the permanent component library and replaced
the width-owning dock with a canvas-overlay Inspect shelf containing concise
selection facts.

Refined the workspace with viewport-contained layout, empty-state guidance,
bottom-right zoom controls, unified linear icons, active-tool/hover/placement
feedback, clearer rich-text/drafting controls, a wider Guide hit band, and
worktree-isolated Playwright ports. Formal schematic rendering and persisted
protocols were unchanged.

Validation passed: 26 focused Vitest tests; repository typecheck; the editor and
its seven workspace dependencies built; all 61 Playwright flows passed on an
isolated port; the two insertion tests additionally proved invalid Apply and
recent ordering; full repository format check and `git diff --check` passed.
Real in-app-browser inspection verified the empty workspace, insertion dialog,
live placement ghost, concise Inspect shelf, grouped drafting toolbar, viewport
containment, and zero page console errors. The existing large-chunk Vite warning
remains informational.
