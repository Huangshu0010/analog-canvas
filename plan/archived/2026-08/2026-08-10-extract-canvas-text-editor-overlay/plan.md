---
status: completed
experience: none
---

# Extract Canvas Text Editor Overlay

## Goal

Move the canvas text editor's viewport-aware frame calculation and
`RichTextEditor` wrapper out of `App.tsx` into one focused component while
preserving the existing annotation/drafting editing, closing, and commit
contracts.

## State and Ownership

Start state from `git status --short --branch`:

```text
## agent/fix-ci-baseline
```

The worktree is clean. This target owns only the canvas overlay boundary and
its direct tests/documentation:

- `apps/editor/src/App.tsx` (text-editor overlay import and render block only)
- `apps/editor/src/canvas-text-editor-overlay.tsx`
- `apps/editor/src/canvas-text-editor-overlay.test.ts`
- `plan/2026-08-10-extract-canvas-text-editor-overlay/plan.md`
- `plan/log.md` (close-out entry only)

Read-only dependencies are `apps/editor/src/rich-text-editor.tsx`,
`apps/editor/src/text-editing.ts`, editor styles, and existing editor E2E
specifications. The shared contracts are `TextEditingSession`, the SVG
`viewBox`, and the existing callback behavior owned by `App.tsx`.

## Work

1. Extract a pure frame resolver that retains the current minimum size,
   content-size response, and four-edge viewport clamping rules.
2. Add a canvas overlay component that adapts a text-editing session to
   `RichTextEditor` without owning persistence or selection state.
3. Replace the inline `App.tsx` closure with the component and add focused
   layout tests for ordinary, scaled, and boundary-constrained frames.

## Validation

- Focused Vitest for the new frame contract and editor application tests
- Focused Playwright text-editing scenarios covering shortcut creation,
  Escape/outside closing, unchanged Apply, persistence, and annotation/free
  text editing
- `pnpm typecheck`
- `pnpm --filter @icm/editor build`
- `git diff --check`
- `git status --short --branch`

Focused interaction checks plus the deterministic frame tests cover the
extracted boundary; the edit model and persistence implementations remain
unchanged.

## Commit Intent

Commit as:

```text
refactor(editor): extract canvas text editor overlay
```

## Outcome

Added a dedicated canvas text-editor overlay and a pure frame resolver. The
resolver preserves the former sizing formulas and viewport-edge clamping, now
covered by four deterministic tests. `App.tsx` retains target resolution,
interaction state, route-arrow eligibility, and all mutation callbacks while
delegating only layout and `RichTextEditor` adaptation.

Validation passed: 15 focused Vitest tests, six focused Playwright interaction
flows, repository typecheck, editor production build, changed-file Prettier,
and `git diff --check`. The production build retains the existing large-chunk
warning; this target does not change bundle composition policy.
