---
status: completed
experience: none
---

# Virtuoso-Style Insert Dialog and Explicit Properties

## Goal

Make manual insertion compact and parameter-first, while restoring an
unambiguous Cadence-like selection flow:

- selecting an object only selects it; `Q` is the standard way to reveal and
  focus Properties;
- `I` opens a stable two-column dialog: a compact picker and device controls
  on the left, an authoritative symbol preview on the right;
- the component list is collapsed by default and expands only inside its own
  bounded picker frame, never consuming the preview pane;
- manual parts can receive the small, symbol-specific parameter set required
  for usable analog schematics before placement.

## State and Ownership

Start state from `git status --short --branch`:

```text
## codex/contextual-properties-net-labels...origin/codex/contextual-properties-net-labels
```

The worktree is clean. This target owns:

- `apps/editor/src/app/App.tsx`
- `apps/editor/src/app/App.test.tsx`
- `apps/editor/src/interaction/interaction-state.ts`
- `apps/editor/src/interaction/interaction-state.test.ts`
- `apps/editor/src/features/component-insert/insert-component-dialog.tsx`
- `apps/editor/src/features/component-insert/insert-component-dialog.test.tsx`
- `apps/editor/src/features/component-insert/component-parameters.ts`
- `apps/editor/src/features/component-insert/component-parameters.test.ts`
- `apps/editor/e2e/component-insert.spec.ts`
- `apps/editor/e2e/manual-editor.spec.ts`
- `apps/editor/src/styles.css`
- `docs/specs/editor-interaction.md`
- `plan/2026-08-11-virtuoso-insert-and-q-properties/plan.md`
- `plan/log.md`

Read-only dependencies are `packages/model/src/schema.ts` and
`packages/edit-engine/`: this target uses the existing primitive
`Instance.properties` record and existing `add_instance` / annotation edits.
It does not add a PDK schema, expression evaluator, or a new Engine endpoint.

## Frozen Decisions

1. **Selection is not inspection.** Direct object selection must never expand
   the Properties dock. Only `Q`, a direct click on its collapsed rail, and a
   successful SPICE import (Import Review exception) can open it. Once the dock
   is explicitly open it may stay open while the user changes selection; this
   is a pinned work surface, not an automatic selection side effect.
2. **Picker layout.** `I` is a two-column dialog. The left column owns one
   compact searchable component picker, parameter cards, orientation, and
   annotation controls. Its result list is initially collapsed and bounded to
   that column. The right column is a stable symbol preview and never shifts
   or disappears when the list is open.
3. **R/L/C values are raw SPICE-style strings.** Resistor, capacitor, and
   inductor expose one `Value` field stored as `properties.value`. The UI gives
   a unit-aware hint only: resistance (Ohm), capacitance (F), inductance (H),
   with examples such as `10k`, `2p`, and `3n`. It neither converts units nor
   evaluates expressions.
4. **Initial MOS parameter set.** NMOS and PMOS expose raw `W`, `L`, and `M`
   fields stored as `properties.w`, `properties.l`, and `properties.m`.
   Imported `spice.param.w/l/m` values are read-only fallbacks in Properties;
   manual entries create only the unprefixed user-authored overrides. PDK model
   choice, threshold options, fingers, body connections, and simulation
   semantics remain out of scope.
5. **Annotation controls.** The insert dialog provides a `Show reference`
   toggle and an optional `Reference text` override. The placement transaction
   still creates the normal instance reference annotation; the override changes
   its visible text only, while the generated stable instance ID remains the
   object identity. Hiding the reference creates the established empty,
   instance-attached label suppressor, because merely omitting an annotation
   would make the renderer draw its implicit default reference. Both choices
   are carried only through the pending placement state.
6. **Orientation.** The dialog provides initial 0/90/180/270 rotation. It is
   carried into the existing placement session, and `R` continues to rotate the
   preview before the placement click. Mirror remains a post-placement `F` /
   `Shift+F` action, avoiding an additional transient mirror contract.
7. **One parameter catalogue.** A frontend-only descriptor catalogue drives
   both Insert fields and V1 Properties fields, including source fallback and
   unit/help text. This prevents a field accepted at insertion from becoming
   invisible or uneditable after placement.

## Work

1. Add the descriptor catalogue and focused tests for R/L/C and MOS defaults,
   property keys, source fallback keys, unit hints, and generic fallback.
2. Replace the permanent insertion list with a collapsed searchable picker in
   the left column. Preserve keyboard filtering, Arrow/Home/End selection,
   Escape, and authoritative preview semantics.
3. Extend the typed insertion request and temporary interaction state with
   parameter values, reference display/text, and initial rotation. Commit these
   only when the canvas placement creates the instance and optional annotation.
4. Render the shared parameter controls in `Q` Properties, with Apply/Cancel
   and existing generic property patch behavior. Keep imported source facts
   read-only and do not create a canvas Value label.
5. Make Properties opening explicit and add regressions proving that direct
   selection leaves the dock collapsed, `Q` opens/focuses it, and import review
   remains the one automatic exception.
6. Update interaction documentation and add Playwright coverage for compact
   picker expansion, stable preview geometry, R/C/L and MOS authoring, rotated
   placement, reference configuration, and Q-only Properties behavior.

## Validation

- Focused descriptor/dialog/interaction/App Vitest tests.
- Focused Playwright insertion and manual-editor scenarios, followed by the
  complete editor E2E suite if the shared dialog/selection shell remains green.
- Editor build, workspace typecheck, target-file Prettier check,
  `git diff --check`, and status review.

## Commit Intent

```text
feat(editor): refine Virtuoso-style component insertion
```

## Outcome

Implemented the compact two-column `I` dialog and its single shared component
parameter catalogue. The picker now opens only inside its own left-column frame;
R/L/C retain raw unit-aware `Value` strings, while NMOS/PMOS author `W`, `L`,
and `M` overrides with imported SPICE facts as fallbacks. Initial orientation and
reference choices survive the temporary placement session and commit only with
the placed instance. A hidden reference uses the conventional empty attached
label suppressor so the formal renderer cannot restore an implicit label.

Direct selection leaves the left Properties shelf collapsed; `Q` opens and
focuses the selected object's primary field. Focused unit tests, all 70 editor
E2E scenarios, workspace typecheck, production editor build, and `git diff
--check` passed.
