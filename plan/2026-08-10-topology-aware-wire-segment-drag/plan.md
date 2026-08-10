# Topology-aware wire segment drag

## Goal

Make direct wire-segment dragging invariant to persisted Route boundaries. A
dotless degree-one/two `route-anchor` behaves like editable wire geometry,
while terminals, ports, and real branch Junctions remain connectivity anchors.

## Dirty-State Note

Start state from `git status --short --branch`:

```text
## codex/modernize-editor-chrome...origin/codex/modernize-editor-chrome
 M apps/editor/e2e/drafting.spec.ts
 M apps/editor/e2e/manual-editor.spec.ts
 M apps/editor/src/App.tsx
 M apps/editor/src/selection-geometry.test.ts
 M apps/editor/src/selection-geometry.ts
 M docs/specs/editor-interaction.md
?? apps/editor/src/canvas-drag-session.test.ts
?? apps/editor/src/canvas-drag-session.ts
?? plan/2026-08-10-unified-canvas-drag-session/
```

Those paths belong to the concurrent unified canvas-drag-session target. This
target initially owns only clean Derived files and its plan. It will not edit
or stage the concurrent paths. GUI integration may be claimed only after that
target finishes and this plan is updated with a fresh ownership audit.

## Owned Files

- `packages/derived/src/stretch.ts`
- `packages/derived/src/stretch.test.ts`
- `plan/2026-08-10-topology-aware-wire-segment-drag/plan.md`

## Read-Only Files

- `apps/editor/src/App.tsx` and its concurrent drag-session files/tests
- `docs/specs/editor-interaction.md`
- persisted model schema and Edit Engine transaction contract
- renderer and Razavi visual assets

## Shared Dependencies

- `RouteBranch` remains the persisted path between endpoints.
- `route-anchor` Junctions remain reusable persisted endpoints; the solver
  classifies degree-one/two anchors as soft geometry at edit time.
- Segment movement preserves Net topology and emits existing typed
  `move_junction`/`set_route_points` inputs rather than adding a file-format or
  Agent API operation.
- Locked/trunk segments remain protected.

## Expected Work

1. Add a topology-aware segment-drag proposal that can move a soft Junction and
   reshape every incident Route atomically.
2. Prove Route-partition invariance with equivalent single-Route and split-
   Route closed-loop fixtures.
3. Cover loose ends, hard branch anchors, and protected geometry.
4. After the concurrent editor target completes, integrate the proposal into
   the existing route drag commit and add a focused browser regression.

## Validation

- Focused Derived Vitest for segment-drag proposals.
- Derived build, followed by the editor-focused test/build once integrated.
- `git diff --check` and `git status --short --branch`.

The focused matrix covers the affected topology classifications and the exact
closed-loop regression without running unrelated visual-fidelity suites.

## Experience Signal (for human review)

The current bug is a storage-partition leak: visually identical conductors
behave differently depending on where a prior wire commit split Route records.

## Commit Intent

Commit as:

```text
fix(editor): make wire segment drag topology aware
```
