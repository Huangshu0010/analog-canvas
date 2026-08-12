---
status: completed
experience: none
---

# Persistent authoring tools and input safety

## Goal

Reduce repetitive manual-authoring gestures and accidental canvas/browser
actions: protect the editor from keyboard refresh, strengthen the grid, isolate
rich-text interaction, keep Wire/Insert/Copy active across commits until Escape,
and make Insert-dialog rotation visible in the symbol preview.

## State and Ownership

Start state from `git status --short --branch`:

```text
## main...origin/main
```

The worktree was clean and local main matched `origin/main` at `0e96608`. This
target owns one interaction boundary on the new branch
`codex/persistent-authoring-input-safety`:

- `apps/editor/src/app/App.tsx`
- `apps/editor/src/styles.css`
- `apps/editor/src/interaction/editor-shortcuts.ts`
- `apps/editor/src/interaction/editor-shortcuts.test.ts`
- `apps/editor/src/interaction/interaction-state.ts`
- `apps/editor/src/interaction/interaction-state.test.ts`
- `apps/editor/src/features/component-insert/insert-component-dialog.tsx`
- `apps/editor/src/features/component-insert/symbol-artwork.tsx`
- focused tests under `apps/editor/src/features/component-insert/` and
  `apps/editor/src/features/text-editing/`
- focused browser scenarios under `apps/editor/e2e/`
- `docs/specs/editor-interaction.md`
- this plan and `plan/log.md`

Shared dependencies are the Edit Engine transaction boundary, Symbol DSL
geometry, and Project recovery. They are read-only: every completed Wire,
component, or copy remains an independent transaction, and keyboard refresh
protection supplements rather than replaces recovery.

## Work

1. Add tested refresh-shortcut protection and persistent Wire/placement state
   transitions with Escape as the single exit.
2. Keep Insert and Copy placement active after each successful commit without
   auto-chaining electrical endpoints or double-placing on a double click.
3. Feed Insert rotation into the right-side symbol preview, with R active only
   outside text-entry controls and stable rotated preview bounds.
4. Move the rich-text frame fully above/below its target, make its complete
   surface opaque and event-blocking, and deepen the grid through a style token.
5. Update the accepted interaction contract and protect the combined behavior
   with focused unit and browser regressions.

## Validation

- focused shortcut, interaction-state, component-preview, and text-overlay
  unit tests
- focused browser tests for refresh blocking, repeated Wire/Insert/Copy,
  Insert rotation preview, and rich-text input isolation
- `corepack pnpm typecheck`
- `git diff --check`
- `git status --short --branch`

## Commit Intent

Commit as:

```text
feat(editor): add persistent authoring tools and input safety
```

## Outcome

Browser refresh keys are now captured before controls can consume them; the
canvas uses a stronger grid token; and the rich-text overlay stays outside its
target where space permits while owning all input across an opaque frame.
Wire, Insert/quick-place, and Copy retain their active authoring request after
each successful transaction and exit only through Escape. The Insert dialog
and placement ghost share the selected quarter-turn rotation, including an R
shortcut that does not steal text-entry keystrokes.

Focused state/shortcut/overlay tests passed (20/20), workspace typecheck
passed, the complete component-insert browser spec passed (11/11), the complete
manual-editor browser spec passed (57/57), and `git diff --check` was clean.
