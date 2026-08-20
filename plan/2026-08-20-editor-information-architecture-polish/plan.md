---
status: completed
experience: none
---

# Tighten Cell, Netlist, and Properties Information Architecture

## Goal

Reorganize the Stage 1 schematic GUI so Cell interface authoring lives inside
Cell Manager, netlist-wide commands live in a first-level Netlist menu, and the
Properties dock presents the same editing behavior in a tighter, clearer
hierarchy consistent with the existing editor style.

## State and Ownership

Start state from `git status --short --branch`:

```text
## codex/phase1-schematic-foundation-plan...origin/codex/phase1-schematic-foundation-plan
```

The worktree is clean. This target owns the editor presentation and tests
needed for the reorganization:

- `apps/editor/src/app/App.tsx`
- `apps/editor/src/features/hierarchy/cell-manager-dialog.tsx`
- `apps/editor/src/features/hierarchy/cell-interface-dialog.tsx`
- `apps/editor/src/features/selection/selection-inspector-details.tsx`
- `apps/editor/src/styles.css`
- `apps/editor/src/app/App.test.tsx`
- `apps/editor/src/features/hierarchy/*.test.tsx`
- `apps/editor/src/features/selection/*.test.tsx`
- `apps/editor/e2e/hierarchy.spec.ts`
- `apps/editor/e2e/manual-editor.spec.ts`
- `plan/2026-08-20-editor-information-architecture-polish/plan.md`
- `plan/log.md`
- `plan/root-audit.md`

Shared contracts are the existing typed Cell/interface writers, Properties
commit gestures, selection/focus behavior, and accessible command names. Data
model, persistence, netlist analysis, and edit-engine semantics are read-only.

## Work

1. Replace the separate Cell Interface dialog with a compact master-detail
   Cell Manager whose right pane edits the selected Cell interface and whose
   external-interface area is visually separate.
2. Add a first-level Netlist menu containing Instance Table and Preflight;
   remove Preflight and the redundant interface entry from the Cell row.
3. Re-group component Properties into compact Identity, Parameters, Display,
   Placement, and Advanced areas without changing writer timing, Undo/Redo,
   Discard, or save/reopen semantics.
4. Keep live issues available but visually subordinate so they do not dominate
   ordinary object editing.
5. Update unit/browser contracts and visually verify the revised layouts.

## Validation

- `pnpm test:local apps/editor/src/app/App.test.tsx apps/editor/src/features/hierarchy apps/editor/src/features/selection`
- `pnpm test:e2e:local apps/editor/e2e/hierarchy.spec.ts apps/editor/e2e/manual-editor.spec.ts --grep "Cell|Properties|Netlist|Instance Table"`
- `pnpm test:impact -- --base origin/main`
- `pnpm typecheck`
- `git diff --check`
- `git status --short --branch`

## Test Impact

- Decision: tests-updated
- Contracts: Cell interface edits remain typed and target the selected Cell;
  Netlist commands remain reachable; existing Properties inputs retain their
  commit and recovery behavior; hierarchy actions remain compact at narrow
  widths.
- Primary checks: hierarchy E2E for Cell management/interface authoring,
  manual-editor E2E for menubar/Properties, focused React tests, and browser
  screenshots at desktop width.

## Commit Intent

Commit as:

```text
feat(editor): tighten schematic authoring layout
```

## Outcome

Cell Interface authoring is now embedded in a compact master-detail Cell
Manager, with terminal order and formal parameters adjacent to the selected
Cell and shared external definitions subordinate. Instance Table and Preflight
moved to a first-level Netlist menu; the Cell row now contains only hierarchy
navigation and placement. Component Properties now groups the same writers
into compact Identity, Target, Parameters, Display, Advanced, and Placement
areas, while non-blocking Issues are collapsed until requested.

Typecheck, 37 focused unit/component tests, 14 focused browser contracts,
test-impact against `origin/main`, diff check, and fresh-browser visual/console
inspection passed. Existing typed edits, commit timing, Undo/Redo, Discard,
selection, navigation, and persistence semantics were retained.
