---
status: completed
experience: none
---

# Contextual Properties and Net Labels

## Goal

Make the editor's object-editing flow coherent and compact:

- `L` edits or creates an electrical Net Label on a selected wire;
- `P` starts a non-electrical Construction line;
- `Q` opens and focuses the fixed left-dock Properties surface for the current
  selection;
- V1 component Properties provides a durable, undoable **Value** plus
  placement coordinates and orientation.

The goal is not a general PDK parameter editor. It establishes the smallest
end-to-end property path—persistence, typed transaction, GUI, Agent contract,
history, and tests—without creating a second editing model.

## State and Ownership

Start state from `git status --short --branch`:

```text
## main...origin/main
```

The worktree is clean. This target owns the following files and any narrowly
related focused tests it creates:

- `apps/editor/src/app/App.tsx`
- `apps/editor/src/interaction/editor-shortcuts.ts`
- `apps/editor/src/interaction/editor-shortcuts.test.ts`
- `apps/editor/src/components/editor-help-dialog.tsx`
- `apps/editor/src/features/component-insert/insert-component-dialog.tsx`
- `apps/editor/src/features/component-insert/insert-component-dialog.test.tsx`
- `apps/editor/src/features/selection/selection-inspector-details.tsx`
- `apps/editor/src/features/selection/selection-inspector-details.test.tsx`
- `apps/editor/src/features/selection/instance-properties*.ts*`
- `apps/editor/src/features/wiring/net-label-editor*.ts*`
- `apps/editor/src/styles.css`
- `apps/editor/e2e/manual-editor.spec.ts`
- `apps/editor/e2e/component-insert.spec.ts`
- `packages/edit-engine/src/transaction.ts`
- `packages/edit-engine/src/transaction.test.ts`
- `packages/edit-engine/src/history.test.ts`
- `packages/agent-adapter/src/service.ts`
- `packages/agent-adapter/src/schema.ts`
- `packages/agent-adapter/src/service.test.ts`
- `fixtures/agent-api/agent-circuit-request.schema.json`
- `fixtures/agent-api/agent-circuit.openapi.json`
- `docs/specs/editor-interaction.md`
- `docs/specs/agent-api.md`
- `plan/2026-08-11-contextual-properties-and-net-labels/plan.md`
- `plan/log.md`

Read-only shared dependencies:

- `packages/model/src/schema.ts`: `Instance.properties` is the persisted
  primitive-value record. This target must not change its shape or project
  version unless implementation demonstrates a real incompatibility.
- `packages/spice/src/importer.ts`: imported source facts live under
  `spice.*`, including `spice.target` and `spice.param.*`.
- `packages/symbols/`: visual symbol definitions and labels are not modified.
- `packages/edit-engine` history and the Agent API artifact process are shared
  contracts; their capability/schema artifacts must be regenerated if the new
  edit becomes externally visible.

## Product Decisions Frozen for This Target

### Property model: V1

1. `Instance.properties.value` is the sole user-authored schematic Value. It
   is a raw string such as `10k`, `2p`, or `RUNIT*2`; V1 does not parse,
   evaluate, type-check, simulate, or export that expression as SPICE.
2. Imported source properties remain immutable source facts for this UI:
   `spice.target`, `spice.name`, `spice.param.*`, and `spice.pin.*` are shown
   read-only where useful. The effective Value shown to a user is
   `properties.value`, falling back to `spice.param.value` when no explicit
   authoring override exists. Writing Value creates/updates only `value`; it
   never silently rewrites the imported source record.
3. Manual insertion carries an optional Value through the placement session:
   the Insert Component dialog offers one `Value (optional)` string field,
   which resets whenever the dialog opens or the chosen symbol changes. The
   dialog returns a placement request, not a Project mutation; canvas placement
   creates the instance once with `properties.value` only when the trimmed
   input is non-empty. A manually placed component may also receive or change
   Value later through `Q`.
4. V1 Value is durable schematic metadata, immediately visible in Properties
   and the Agent snapshot, but it does **not** create a second canvas label.
   The existing visible reference label remains the only instance annotation.
   Displaying/hiding a separately positioned value label needs a semantic
   annotation/placement policy and is deferred with the general
   display/visibility work; this prevents the persisted Value and a duplicated
   text annotation from drifting apart.
5. Position `x`/`y` and rotation `0/90/180/270` are editable V1 placement
   fields. They reuse `move_instance` and `rotate_instance`; coordinates snap
   to the Document grid before committing. The existing `F` / `Shift+F`
   actions remain the mirror UI.
6. Every V1 property Apply is one transaction. The existing Document history
   therefore provides undo/redo with no separate property-history mechanism.
   On an imported in-sync Document, the existing non-connectivity convention
   records a property override as `geometry-only-changed`: source text remains
   preserved, but the editable Project is no longer a byte-for-byte source view.
7. The Engine gains one generic, typed edit—`patch_instance_properties`—with
   explicit `set` and `unset` records. It validates primitive values and makes
   no semantic guess about a key. V1 GUI emits only `value`; the generic edit
   avoids a future `set_value`, `set_model`, `set_w`, `set_l`, ... endpoint
   family. The Agent capability list exposes this one edit kind after its
   schema/artifacts and service tests are updated.

### Explicit V1 non-goals

- Editing Model, W/L, M, nf, arbitrary SPICE parameters, or parameter
  expressions as electrical/simulation semantics.
- Renaming an instance, hiding a symbol/label, user layout locks, or bulk
  property editing. These need their own data semantics and Engine-wide
  enforcement; a UI checkbox or a `properties` convention would be misleading.
- Writing modified project connectivity or parameter text back to a `.spi`
  source file.
- A permanent canvas-floating property panel.

These are deliberate V1.1 follow-ups. `patch_instance_properties` is the
single extension point that will support a future typed property catalogue;
the catalogue must be designed before any Model/W/L/M controls are exposed.

### Q, L, and P interaction contract

1. Rename the current left `Inspect` shelf to `Properties`. It remains in the
   stable left dock and is collapsed by default, so neither selection nor
   inspection changes canvas width or overlays the schematic.
2. `Q` is idempotent: with an inspectable selection it opens Properties and
   focuses the first meaningful editable control; it never toggles closed.
   With no selection it reports a concise selection requirement and does not
   open an empty form. Clicking the shelf header remains the explicit close/
   open control. Global shortcuts remain inactive in typing fields.
3. A selected wire plus `L` opens a small, route-anchored Net Label editor.
   It pre-fills the effective Net name; `Enter` commits the current
   `set_net_name` / merge-and-annotation transaction, and `Escape` cancels.
   Empty input removes only the display annotation. `L` does nothing while an
   active wire session is in progress and reports a requirement if no route is
   selected.
4. `P` replaces `L` for Construction line. All menu text, help, specs, and
   tests must change together. `W`, `T`, `A`, `G`, `R`, `F`, `U`, and `Home`
   keep their existing meanings.
5. The selected Arrow / Construction line / Rectangle's permanent inline
   inspector is removed. Its value/style/lock actions move into Properties;
   canvas handles and small gesture-only readouts remain direct manipulation,
   not a second property surface.
6. Successful SPICE import is the sole automatic-open exception: Properties
   opens in a clearly labelled **Import Review** section, containing import
   diagnostics, unresolved/unplaced items, and source-display facts. Closing
   it restores normal Q-controlled behavior; ordinary later selections never
   auto-open Properties.

## Work

1. **Transaction and protocol foundation.** Add and implement
   `patch_instance_properties` in the Edit Engine, including atomic rejection,
   changed-object reporting, source-status behavior, undo/redo, and focused
   transaction/history tests. Add the bounded Agent adapter schema, capability,
   service validation, and regenerated artifacts. Prove save/load preserves a
   Value override without modifying `spice.param.value`.
2. **Manual insertion with Value.** Extend the insert dialog's apply result to
   a typed placement request containing the selected symbol and optional Value.
   Carry that request through the temporary component-placement state and make
   the eventual `add_instance` transaction the only persistence boundary.
   Clearing/cancelling placement must discard the pending Value. Add focused
   dialog and editor regressions for blank, entered, changed-symbol, cancelled,
   and post-placement-Q-edit cases.
3. **Property presentation.** Extract an object-specific Properties component
   from the current mixed debug/selection shelf. Implement a V1 component card
   with reference/symbol and source model read-only facts, Value, grid-snapped
   X/Y, rotation, mirror actions, Apply/Cancel drafts, and clear per-field
   validation. Move existing route, annotation, drafting, and endpoint actions
   under the same surface; migrate free-drawing style controls out of the
   canvas inline inspector. Keep diagnostic telemetry out of normal Properties
   and make it Import Review/development-only.
4. **Context shortcuts and direct label editor.** Extend the pure shortcut
   resolver and tests for `Q`, route-context `L`, and `P`. Add an autofocus,
   route-anchored Net Label editor using the existing electrical label/merge
   transaction semantics. Ensure active drawing/typing/cancel precedence is
   deterministic.
5. **Import review and shell refinement.** Open the dock after successful
   import only, expose source facts/diagnostics/unplaced objects there, and
   preserve the stable library and canvas geometry. Update the help dialog,
   menu labels, shortcut hint, and interaction specification from the same
   source-of-truth mapping to prevent shortcut documentation drift.
6. **End-to-end regression.** Add tests for: manual insertion with Value,
   cancelled insertion discarding Value, and manual NMOS Value persistence via
   Q; imported resistor/capacitor fallback Value then override; Value and
   coordinate/rotation undo/redo; Q focus and no-selection behavior; L label
   create/rename/remove/cancel; P construction-line activation; no persistent
   drafting inspector; import-review-only auto-open; and no canvas reflow.

## Validation

- Focused model/edit-engine transaction and history Vitest tests for property
  patch atomicity and undo/redo.
- Focused Agent adapter schema/service tests plus generated agent API artifact
  check if the edit kind is public.
- Focused editor shortcut, property-component, and route-label unit tests.
- Focused Playwright component/manual-editor flows covering the V1 scenarios
  above, including text-input shortcut guards and import review.
- Editor dependency build and workspace typecheck if the shared Engine/Agent
  contract compiles cleanly; otherwise record the pre-existing failure with its
  exact owner.
- Target-file formatting, `git diff --check`, and
  `git status --short --branch`.

The contract-level tests are necessary because the existing generic JSON map
otherwise makes a superficially working property form easy to implement while
skipping persistence, history, or Agent parity.

## Commit Intent

Commit as:

```text
feat(editor): add contextual properties and net labels
```

## Outcome

Completed on `codex/contextual-properties-net-labels`.

- Added the atomic, undoable `patch_instance_properties` edit and exposed it in
  the Agent capability/schema artifacts. The V1 editor writes only `value`;
  imported `spice.*` facts remain source data and `spice.param.value` is the
  read-only fallback.
- Manual component insertion now carries an optional Value through the pending
  placement session. `Q` opens a fixed Properties dock with Value, snapped
  X/Y, rotation, mirror actions, and Apply/Cancel; drawing styles/lock actions
  now use that same dock rather than a canvas-floating inspector.
- `L` opens a route-anchored Net Label editor, `P` starts Construction line,
  and help/specs/tests use the same shortcut contract. Successful SPICE import
  is the sole automatic Properties open, into Import Review.
- Validation passed: focused Vitest (50 tests), `pnpm typecheck`, regenerated
  Agent API artifacts, editor production build, and the 69-test full E2E suite
  (the final target-specific three-spec run passed 67 tests).
- `pnpm test` remains red outside this target: eight pre-existing failures in
  `packages/render-svg` default-label/render goldens and
  `packages/symbols` catalog expectations. `pnpm format:check` likewise finds
  three unrelated existing files under `packages/derived` and `packages/symbols`.
  None overlap this target's owned paths.
