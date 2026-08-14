---
status: completed
experience: none
---

# Unify Editor Interaction State

## Goal

Replace the editor's parallel placement flags with one canonical transient
interaction state machine. Copy, symbol placement, VDD-rail placement, Wire,
and drafting must be mutually exclusive; entry, re-entry, cancellation,
document reset, transaction invalidation, and shortcut dispatch must be
deterministic. Preserve the configured shortcut keys while removing the stale
mode combinations behind repeated `C`, `I` re-entry, and VDD-rail failures.

## State and Ownership

Start state from `git status --short --branch`:

```text
## codex/interaction-state-machine...origin/main
```

This worktree was created clean from `origin/main` at `12f0dab`. It is isolated
from the concurrent model/VisualAnchor worktree. This target owns the editor
interaction state, keyboard dispatcher, App integration, interaction contract,
and directly related regressions.

- `apps/editor/src/interaction/interaction-state.ts`
- `apps/editor/src/interaction/interaction-state.test.ts`
- `apps/editor/src/interaction/editor-shortcuts.ts`
- `apps/editor/src/interaction/editor-shortcuts.test.ts`
- `apps/editor/src/app/App.tsx`
- `apps/editor/src/features/component-insert/component-insert-request.ts`
- `apps/editor/src/features/component-insert/insert-component-dialog.tsx`
- `apps/editor/src/features/component-insert/symbol-artwork.tsx`
- `apps/editor/src/features/component-insert/symbol-catalog.ts`
- `apps/editor/src/features/component-insert/vdd-rail.ts`
- `apps/editor/src/features/component-insert/vdd-rail-preview-symbol.ts`
- `apps/editor/src/features/component-insert/vdd-rail.test.ts`
- `apps/editor/src/features/editor-shell/shapes-panel.tsx`
- `apps/editor/src/features/editor-shell/shapes-panel.test.ts`
- `apps/editor/e2e/manual-editor.spec.ts`
- `apps/editor/e2e/drafting.spec.ts`
- `apps/editor/e2e/component-insert.spec.ts`
- `packages/edit-engine/src/routing-planner.ts`
- `packages/edit-engine/src/routing.test.ts`
- `docs/specs/editor-interaction.md`
- `plan/2026-08-14-unify-editor-interaction-state/plan.md`
- `plan/log.md`

Read-only dependencies:

- `apps/editor/src/features/clipboard/clipboard.ts` remains the pure copy/paste
  data proposal owner; the interaction machine holds its payload generically.
- `apps/editor/src/canvas/canvas-drag-session.ts` remains the drag owner.

## Work

1. Define one exclusive union for `idle`, symbol placement, VDD-rail placement,
   copy placement, Wire, and drafting. The union owns every preview coordinate,
   rotation, rail endpoint, clipboard payload, waypoint, and snap point used by
   those modes; remove the corresponding parallel React state.
2. Route every mode entry through reducer transitions. Same-mode re-entry is
   idempotent (`C -> C`, `A -> A`, `K -> K`, `W -> W`, repeated selection of the
   same Library item); a different mode replaces the previous mode atomically
   after canvas drag/snap cleanup.
3. Make VDD rail a virtual Library placement item. Restore the old VDD artwork
   as an editor-local preview definition for I-dialog, Library, and
   pre-first-click preview only; do not register it with the product Symbol
   Resolver and never persist a VDD symbol instance. First click starts the
   horizontal rail preview, second click commits `add_power_rail`, and
   successful placement exits by default.
4. Make cancellation total. Escape, Document switch, Project replacement,
   Clear Canvas, import, recovery restore, and Agent semantic focus reset all
   reach one `cancelAllTransientInteraction()` boundary that also cancels canvas
   drag and clears snap guides.
5. Centralize shortcut arbitration without changing key assignments. Active
   exclusive modes accept Escape, pan, and zoom; same-mode shortcuts are inert;
   explicit tool switches replace the mode; selection-dependent commands such
   as Copy, Delete, Q, L, rotate, and mirror cannot operate on stale selection
   underneath an active placement.
6. Invalidate snapshot-dependent copy placement after any successful mutation
   not produced by that copy session, including Undo/Redo, Delete, Clear,
   import, Agent edits, and document/project changes. A committed copy refreshes
   its clipboard/revision or exits when the continuation cannot be proven safe.
7. Define VDD-rail deletion as one visual closure: remove its route, associated
   power label, and rail-only junctions; preserve the global VDD Net when it is
   still used. Do not preserve the current incorrect orphan objects for
   compatibility.
8. Add reducer, shortcut, edit-engine, and browser matrix regressions covering:
   repeated `C`; `I -> Esc -> I`; `I -> Esc -> same item`; Copy plus every
   competing tool; Document/Project/Clear during placement; repeated W/A/K;
   VDD Library/I preview, two-click commit, Escape before/after first click,
   default exit, selection, and complete deletion.
9. Update the interaction contract to make the state/command matrix and virtual
   VDD placement boundary normative.

## Validation

- `pnpm test:local apps/editor/src/interaction/interaction-state.test.ts apps/editor/src/interaction/editor-shortcuts.test.ts apps/editor/src/features/clipboard/clipboard.test.ts apps/editor/src/features/component-insert/vdd-rail.test.ts packages/edit-engine/src/routing.test.ts`
- `pnpm test:e2e:local apps/editor/e2e/manual-editor.spec.ts apps/editor/e2e/drafting.spec.ts apps/editor/e2e/component-insert.spec.ts --grep "copy|Copy|repeated|creation tools|VDD|component insert"`
- `pnpm --filter @icm/editor build`
- `pnpm verify:branch` because this changes shared editor interaction flow
- `git diff --check`
- `git status --short --branch`

## Commit Intent

Commit as:

```text
refactor(editor): unify transient interaction state
```

## Outcome

Completed the clean interaction-state consolidation without changing shortcut
assignments. Copy, component insertion, virtual VDD-rail placement, Wire, and
drafting now share one exclusive reducer-owned state; same-mode re-entry is
idempotent, mode replacement is atomic, and every project/document/reset path
uses the same total transient-interaction cancellation boundary.

VDD Rail is again presented through the ordinary Library and `I` insertion
flow using an editor-only preview symbol, while committing its existing
electrical rail edit rather than persisting a fake component instance. Its
placement exits after commit, Escape works before or after the first point,
and deletion removes the route, power label, and rail-only junctions as one
visual unit.

Shortcut arbitration now prevents commands from acting on stale selections
under an active mode. Repeated `C`, `W`, `A`, and `K` preserve the active
session, and successful unrelated mutations invalidate snapshot-dependent
placement state. Focused reducer, shortcut, VDD/edit-engine, and browser
regressions cover the previously crashing `I -> Escape -> C -> C -> I` and VDD
placement/deletion paths.

Validation completed:

- Focused interaction, shortcut, clipboard, VDD, and routing unit tests passed.
- Focused browser regressions passed (9/9). The broader affected GUI run first
  passed 97/98; its one stale-selection deletion regression was fixed and the
  failing case then passed on rerun.
- `pnpm verify:branch` passed: formatting and documentation checks, typecheck,
  102 unit-test files / 557 tests, all workspace builds, and production preview
  smoke.
- `git diff --check` passed before completion metadata was recorded and is
  repeated at handoff.
