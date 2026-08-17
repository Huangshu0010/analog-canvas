---
status: active
experience: none
---

# Editor interaction controller migration

## Goal

Move the five remaining editor interaction domains out of `App.tsx` into one
flat React Hook per domain while preserving behavior, keeping
`useInteractionState` as the sole transient-mode state machine, and keeping
`App.tsx` as the composition and layout root.

The five domains are:

1. wiring;
2. selection and movement;
3. component insertion and placement;
4. property editing;
5. panels and dialogs.

## Progress

| Step | Domain                            | State                                         | Commit                                                 |
| ---: | --------------------------------- | --------------------------------------------- | ------------------------------------------------------ |
|    1 | Wiring                            | completed                                     | `refactor(editor): extract wire interaction hook`      |
|    2 | Selection and movement            | completed: commands, pointer drags, and keyboard Move session have one Hook owner | `refactor(editor): complete selection interaction hook` |
|    3 | Component insertion and placement | completed: dialog, recents, component/VDD placement, and transactions have one Hook owner | `refactor(editor): complete component placement hook`   |
|    4 | Property editing                  | in progress: draft state extracted; commit/text lifecycle pending | `refactor(editor): extract properties editor hook`     |
|    5 | Panels and dialogs                | in progress: generic shell state extracted; focus/persistence cleanup pending | `refactor(editor): extract editor panel state hook`    |

## State and Ownership

Start state from `git status --short --branch`:

```text
## codex/app-transaction-module-layers...origin/codex/app-transaction-module-layers
?? .worktrees/
```

The untracked `.worktrees/` directory is pre-existing workspace
infrastructure, does not overlap this target, and remains untouched. The
protocol and helper-layer migrations are committed and pushed on this branch.

Expected implementation ownership:

- `apps/editor/src/app/App.tsx`
- `apps/editor/src/app/App.test.tsx`
- `apps/editor/src/features/wiring/use-wire-interaction.ts`
- `apps/editor/src/features/wiring/use-wire-interaction.test.ts` when a
  controller transition lacks existing coverage
- `apps/editor/src/features/selection/use-selection-interaction.ts`
- `apps/editor/src/features/selection/use-selection-interaction.test.ts`
  when a controller transition lacks existing coverage
- `apps/editor/src/features/component-insert/use-component-placement.ts`
- `apps/editor/src/features/component-insert/use-component-placement.test.ts`
  when a controller transition lacks existing coverage
- `apps/editor/src/features/properties/use-properties-editor.ts`
- `apps/editor/src/features/properties/use-properties-editor.test.ts` when a
  controller transition lacks existing coverage
- `apps/editor/src/features/editor-shell/use-editor-panels.ts`
- `apps/editor/src/features/editor-shell/use-editor-panels.test.ts` when a
  controller transition lacks existing coverage
- existing focused domain tests named in each step below
- `plan/2026-08-17-editor-interaction-controller-migration/plan.md`
- `plan/root-audit.md`
- `plan/log.md`

Shared dependencies:

- `apps/editor/src/interaction/interaction-state.ts` remains the canonical
  mutually-exclusive interaction-mode owner.
- `apps/editor/src/features/selection/selection-controller.ts` remains the
  canonical visual-selection owner.
- `apps/editor/src/document/document-controller.ts` and
  `transactDocument` remain the only Editor-to-Edit-Engine mutation path.
- Existing pure helpers under `features/wiring/`, `features/selection/`,
  `features/component-insert/`, `features/text-editing/`, and
  `canvas/` remain the calculation layer.
- `packages/edit-engine/` and persisted model protocols are read-only unless
  a migration exposes an actual contract defect; any such expansion requires
  updating this plan before editing.

## Flat Design Rules

- Add exactly one Hook module for each of the five domains. Do not add a
  controller class, provider, context, event bus, service locator, or generic
  interaction framework.
- Keep `useInteractionState` in `App.tsx`. Each domain Hook receives only
  the state fields and actions it uses; it must not create a second copy of
  transient interaction state.
- Keep document changes behind the injected `transactDocument` callback.
  Hooks may prepare actions and status text but may not mutate the Project or
  Document directly.
- Use one options object per Hook and return one flat object of named state and
  actions. Do not add nested controller hierarchies.
- Keep existing pure functions in their current feature modules. Move only
  state, effects, refs, and event orchestration that belong to the domain.
- Keep page-level JSX and cross-domain shortcut arbitration in `App.tsx`.
  Existing leaf components may continue receiving props; this target does not
  redesign the UI.
- Migrate one domain at a time. After each step, remove the old App declarations
  in the same commit so there is never more than one behavior owner.

## Step 1 - Wiring

Create `useWireInteraction` under `features/wiring/`.

Move ownership of:

- selected wire endpoint and selected route segment state;
- wire source selection, flightline activation, free/terminal/route-tap
  continuation, waypoint handling, and wire commit orchestration;
- route selection, connection deletion, segment stretch preview and commit;
- wire-specific status messages and cleanup on revision/cancel.

Keep in place:

- wire mode/source/preview/waypoints in `useInteractionState`;
- pure path, hit, attachment, contact, and transaction-planning helpers;
- canvas pointer arbitration in `App.tsx`.

Hook inputs are the current Document, Symbol Resolver, transaction callback,
status callback, narrow wire fields/actions from `useInteractionState`, and
selection callbacks. It returns the selected endpoint/segment, route-stretch
preview, wire/route handlers, and a single wiring reset action.

Primary validation:

- `pnpm test:local apps/editor/src/app/App.test.tsx apps/editor/src/features/wiring/route-interaction-geometry.test.ts packages/edit-engine/src/wire-editing.test.ts packages/edit-engine/src/routing.test.ts`
- `pnpm test:e2e:local apps/editor/e2e/manual-editor.spec.ts --grep "Wire|wire|route tap|flightline|segment"`
- `pnpm --filter @icm/editor build`
- `pnpm typecheck`

Exit condition: `App.tsx` contains no wire-creation or route-stretch state
machine; it only delegates canvas events to `useWireInteraction`.

Commit:

```text
refactor(editor): extract wire interaction hook
```

Checkpoint delivered before the remaining route-selection/stretch migration:

```text
refactor(editor): extract wire session hook
```

## Step 2 - Selection and movement

Create `useSelectionInteraction` under `features/selection/`.

Move ownership of:

- instance, visual-object, marquee, additive, and endpoint selection
  orchestration not already owned by `useSelectionController`;
- pointer-drag, threshold, group/visual movement, keyboard command-move,
  preview and commit lifecycles;
- selection deletion, selected-junction deletion, No Connect toggling, and
  copy-placement initiation/commit because each operates on the active
  selection;
- move-session refs and selection-specific transient cleanup.

Keep in place:

- the visual selection reducer in `useSelectionController`;
- pure move/delete plans in existing selection modules;
- pan, zoom, drafting manipulation, and top-level pointer arbitration in
  `App.tsx`.

The Hook receives the current Document, resolver, transaction/status
callbacks, the existing selection controller API, and the narrow
`useInteractionState` movement/copy actions. It returns selection handlers,
move previews, copy preview/commit actions, and one reset action.

Primary validation:

- `pnpm test:local apps/editor/src/app/App.test.tsx apps/editor/src/features/selection/selection-controller.test.ts apps/editor/src/features/selection/selection-move-plan.test.ts apps/editor/src/features/selection/delete-selection.test.ts apps/editor/src/features/clipboard/clipboard.test.ts`
- `pnpm test:e2e:local apps/editor/e2e/manual-editor.spec.ts --grep "move|select|copy|No Connect|junction"`
- `pnpm --filter @icm/editor build`
- `pnpm typecheck`

Exit condition: move/copy/delete sessions have one owner in the selection
feature and `App.tsx` only routes pointer/shortcut intents to it.

Commit:

```text
refactor(editor): extract selection interaction hook
```

## Step 3 - Component insertion and placement

Create `useComponentPlacement` under `features/component-insert/`.

Move ownership of:

- Insert dialog open/close state and recent-component persistence;
- catalog and quick-place requests;
- component placement begin/cancel/preview/rotate/mirror/commit;
- designator allocation, initial netlist data, placement connectivity, label
  generation, and repeated-placement lifecycle;
- VDD rail placement begin/preview/commit/cancel.

Keep in place:

- placement mode, orientation, and preview points in
  `useInteractionState`;
- existing symbol catalog, parameter, connectivity, VDD, and preview helpers;
- dialog and preview JSX in their current leaf components.

The Hook receives the current Document, resolver, transaction/status
callbacks, ID allocation callback, and the narrow placement fields/actions
from `useInteractionState`. It returns dialog state, recent symbols,
placement actions, and derived preview inputs.

Primary validation:

- `pnpm test:local apps/editor/src/app/App.test.tsx apps/editor/src/features/component-insert/insert-component-dialog.test.tsx apps/editor/src/features/component-insert/placement-connectivity.test.ts apps/editor/src/features/component-insert/component-parameters.test.ts apps/editor/src/features/component-insert/vdd-rail.test.ts apps/editor/src/features/component-insert/vdd-power-label.test.ts`
- `pnpm test:e2e:local apps/editor/e2e/component-insert.spec.ts`
- `pnpm test:e2e:local apps/editor/e2e/manual-editor.spec.ts --grep "VDD rail|component placement|placed device"`
- `pnpm --filter @icm/editor build`
- `pnpm typecheck`

Exit condition: `App.tsx` owns neither Insert-dialog/recents state nor
component/VDD placement orchestration.

Commit:

```text
refactor(editor): extract component placement hook
```

## Step 4 - Property editing

Create `usePropertiesEditor` under a new flat
`features/properties/` directory.

Move ownership of:

- selected-instance parameter/position/rotation draft initialization,
  validation, preview, commit, and cancellation;
- instance reference/value visibility and label projection actions;
- selected-route Net Label draft, editor-open state, apply/delete lifecycle;
- annotation and drafting text-edit session begin/update/commit/delete by
  composing the existing text-editing helpers.

Keep in place:

- pure parameter metadata in `component-parameters.ts`;
- rich-text parsing and mutation in `features/text-editing/`;
- properties panel JSX and selection identity in `App.tsx`;
- all committed changes through the transaction callback.

The Hook receives the current Document, current selection summary,
transaction/status callbacks, and required focus refs. It returns flat draft
values, setters, validation flags, and commit/cancel actions.

Primary validation:

- `pnpm test:local apps/editor/src/app/App.test.tsx apps/editor/src/features/component-insert/component-parameters.test.ts apps/editor/src/features/text-editing/text-editing.test.ts apps/editor/src/features/text-editing/canvas-text-editor-overlay.test.tsx`
- `pnpm test:e2e:local apps/editor/e2e/manual-editor.spec.ts --grep "Properties|property|Net Label|text editor|reference and value"`
- `pnpm --filter @icm/editor build`
- `pnpm typecheck`

Exit condition: App renders property controls from Hook state/actions but
contains no property-draft or text-edit lifecycle implementation.

Commit:

```text
refactor(editor): extract properties editor hook
```

## Step 5 - Panels and dialogs

Create `useEditorPanels` under `features/editor-shell/`.

Move ownership of:

- Library visibility, compact Library visibility, left-panel mode, compact
  media-query synchronization, and Selection shelf visibility;
- Agent panel/detail/dismissed state;
- Help, About, Search, search query, and their focus/open/close lifecycles;
- import-review visibility where it is only presentation state.

Keep in place:

- Project replacement guard and recovery dialog state, because those are
  persistence workflows rather than generic panel state;
- Insert dialog state in `useComponentPlacement`;
- search index derivation and selected-result navigation in `App.tsx`;
- panel/dialog JSX and layout in `App.tsx` or existing leaf components.

The Hook receives the compact media query, optional storage adapter values,
and focus refs. It returns one flat set of visibility values and open/close
actions. Browser storage failures continue to fall back to the current
defaults.

Primary validation:

- `pnpm test:local apps/editor/src/app/App.test.tsx apps/editor/src/features/editor-shell/examples-panel.test.ts apps/editor/src/features/editor-shell/shapes-panel.test.ts apps/editor/src/features/search/project-search-dialog.test.tsx`
- `pnpm test:e2e:local apps/editor/e2e/component-insert.spec.ts --grep "Library|catalog|narrow breakpoint"`
- `pnpm test:e2e:local apps/editor/e2e/manual-editor.spec.ts --grep "command menu|project search|canvas width"`
- `pnpm --filter @icm/editor build`
- `pnpm typecheck`

Exit condition: generic panel/dialog visibility and focus lifecycle has one
owner, while persistence and placement dialogs remain with their domains.

Commit:

```text
refactor(editor): extract editor panel state hook
```

## Cross-Step Validation and Delivery

After every step:

- run the step's focused unit and browser checks;
- run `pnpm test:impact -- --base origin/main`;
- run `git diff --check` and inspect `git status --short --branch`;
- update this plan's progress and `plan/log.md`;
- commit only that domain.

After all five steps:

- run `pnpm verify:branch`;
- confirm no duplicate state owner or dead App handler remains with targeted
  `rg` searches;
- compare `App.tsx` responsibilities and line count with this plan's start,
  treating removed responsibilities—not an arbitrary line target—as the
  acceptance criterion;
- push the branch and wait for required remote checks before mainline
  delivery.

## Test Impact

- Decision: no-test-change
- Reason: existing unit and browser contracts cover the moved interactions;
  the extraction does not change their protocol or user-visible result.
- Contracts: wire creation/editing, selection/movement/copy, component/VDD
  placement, property/text editing, and panel/dialog behavior remain unchanged
  while their React ownership moves.
- Primary checks: the focused unit and Playwright commands listed in each
  step, followed by `pnpm verify:branch`.
- Test rule: add a new Hook test only for a state transition not already
  protected by a pure-domain, App, or browser contract. Do not duplicate
  existing behavior across test layers.

### Step 1 validation

- `pnpm test:local apps/editor/src/app/App.test.tsx apps/editor/src/features/wiring/route-interaction-geometry.test.ts packages/edit-engine/src/wire-editing.test.ts packages/edit-engine/src/routing.test.ts` — 4 files / 51 tests passed.
- Focused Playwright Wire/route scenarios passed, including route tap,
  repeated Wire, route deletion, flightlines, free-route movement, and
  selected-segment stretch.
- `pnpm --filter @icm/editor build`, `pnpm typecheck`,
  `pnpm test:impact -- --base origin/main`, and `git diff --check` passed.

## Commit Intent

Use the five commits named by the steps. Planning record commit:

```text
plan(editor): define flat interaction hook migration
```

## Outcome

Step 1 moved route-specific Wire creation and drag orchestration into
`useWireInteraction`; `App.tsx` retains only cross-domain pointer arbitration.
Keep `status: active` until all five steps and final branch validation complete.
