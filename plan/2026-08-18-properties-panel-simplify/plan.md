---
status: completed
experience: none
---

# Simplify the Properties panel

## Goal

Make the editor Properties panel a focused, immediately-applied editor: retain
the compact identity line, keep the Reference/Value canvas-label toggles and
position/rotation visible, replace explicit Apply actions with dirty-only
Discard, expose component low-frequency actions in a labelled section, and
simplify current diagnostics to severity filtering.

## State and Ownership

Start state from `git status --short --branch`:

```text
## codex/properties-panel-simplify...origin/main
?? .worktrees/
```

The untracked `.worktrees/` directory is unrelated workspace infrastructure;
this target will not read, modify, stage, or remove it.

Owned paths:

- `apps/editor/src/app/App.tsx`
- `apps/editor/src/styles.css`
- `apps/editor/src/features/selection/selection-inspector-details.tsx`
- focused editor tests affected by the changed property and diagnostic controls
- `plan/2026-08-18-properties-panel-simplify/plan.md`
- `plan/log.md`

Read-only shared dependencies:

- `docs/specs/editor-interaction.md` — label-display and direct-manipulation
  contract.
- `packages/edit-engine/` and the Project model — immediate presentation edits
  must continue to use the established transaction boundary.

## Work

1. Refactor component and route property editing so inputs apply through the
   existing mutation boundary as their value changes, retaining a
   selection-scoped baseline for a dirty-only Discard action.
2. Recompose the Properties hierarchy: compact identity, one-row canvas-label
   toggles, persistent position/rotation, labelled component More actions, and
   direct route actions without an ellipsis menu.
3. Remove domain diagnostics filters, retain severity filtering without
   zero-count controls, and align the panel CSS with established editor tokens.
4. Update focused unit/browser contracts and visually inspect the local editor
   at desktop width.

## Validation

- `pnpm test:local apps/editor/src/features/selection/selection-inspector-details.test.tsx apps/editor/src/app/App.test.tsx`
- `pnpm test:e2e:local apps/editor/e2e/component-insert.spec.ts apps/editor/e2e/manual-editor.spec.ts --grep "Properties|Net label|diagnostics"`
- `pnpm test:impact -- --base origin/main`
- `git diff --check`
- `git status --short --branch`

## Test Impact

- Decision: tests-updated
- Contracts: component and route property changes apply without an Apply
  command; Discard restores the selection baseline while dirty; diagnostics
  expose useful severity-only filters; Reference and Value remain paired
  canvas-label controls.
- Primary checks: `apps/editor/src/features/selection/selection-inspector-details.test.tsx`, `apps/editor/e2e/component-insert.spec.ts`, and `apps/editor/e2e/manual-editor.spec.ts`.

## Commit Intent

Commit as:

```text
refactor(editor): simplify properties panel
```

## Outcome

Reworked Properties into a compact, immediate editor. The shelf header now
carries the object identity; component and drawing summary cards are removed.
Reference and Value are visually paired canvas-label toggles, position and
rotation remain visible, and mirror controls have a labelled More actions
section. Component and route property input applies through the established
transaction boundary as it changes; component Discard restores the selection
baseline only while the session is dirty. Current diagnostics now use
severity-only filters and omit empty severities and domain chips.

Validation passed: focused Vitest (2 files / 18 tests), focused Playwright (10
scenarios), TypeScript typecheck, test-impact against `origin/main`, diff
check, and desktop visual inspection at `localhost:5173`.
