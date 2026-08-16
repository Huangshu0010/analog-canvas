---
status: completed
experience: none
---

# Instance value display and property annotations

## Goal

Add an opt-in **Value** display beside an instance. It renders and exports as
Razavi-style RichText, is independently selectable/draggable, and sits beside
the current Reference Label without overlap. Value is hidden by default.

The visual target is MOS numeric `W/L` fractions and one upright engineering
value for passives and independent sources.

## State and Ownership

Start state:

```text
## main...origin/main
?? .worktrees/
```

`.worktrees/` is an unrelated untracked worktree container. It does not
overlap this plan or future product files and must remain untouched. This is a
planning-only target; before implementation, re-check status and create a
review branch.

Expected owned paths:

- `packages/model/src/schema.ts`, migrations, model tests, schema artifacts
- `packages/derived/src/instance-label-placement.ts` plus value-format/placement
  helpers and tests
- `packages/edit-engine/src/transaction.ts` plus property/annotation tests
- `packages/render-svg/src/` formatting and rendering tests
- `apps/editor/src/features/component-insert/`, `apps/editor/src/app/App.tsx`,
  editor styles and focused editor/browser tests
- `packages/agent-adapter/` only if generated schemas enumerate annotation kinds
- affected specifications, this plan, `plan/root-audit.md`, and `plan/log.md`

Read-only until explicitly claimed: Symbol DSL, Razavi visual-reference
fixtures, netlist import/export contract, and existing Reference Label flow.

## Frozen Design

Verification corrections (2026-08-16, after code audit on this branch):

- `RichTextRun.kind: "fraction"` was retired in `32e256c`; the MOS display
  uses inline `<w>/<l>` text instead. The slot distinction keys off
  `annotation.kind` (the object anchor has no `role` field).
- Source electrical key is `dc`, not `value`.
- Schema change means version 9 → 10 plus corpus/fixture regeneration.
- Value refresh lives in the Edit Engine and is canonical-only.

### Reuse one annotation protocol

Do not create a renderer-only property text, a DraftingObject, or a second
dragging system. Add `instance-value` to the existing SchematicAnnotation kind
union and reuse its RichText `content`, object VisualAnchor, `visible` flag,
selection/hit testing, drag, clipboard, undo/redo, Agent edits and SVG export.

```text
Instance
  |- instance-label-<instanceId>  Reference (existing)
  `- instance-value-<instanceId>  Value (new)
```

Both anchor to `objectId = instance.id`. Hiding only sets `visible: false`; it
never discards a user-dragged anchor.

### Value has no second electrical authority

Electrical data remains in typed `instance.netlist.parameters`, with the
existing compatibility fallback to normal `instance.properties` where needed.
The Value annotation persists RichText and placement, but its content refreshes
after a successful parameter edit. Editing/deleting/hiding it never changes
electrical parameters.

Implement one pure formatter, `displayableInstanceValue(instance)`, returning
canonical RichText or a non-displayable reason:

| Symbol class | RichText display | Requirement |
| --- | --- | --- |
| NMOS / PMOS / 3-terminal MOS | upright inline text `<w>/<l>` | both non-empty |
| resistor / capacitor / inductor | upright text `value` | non-empty `value` |
| voltage/current source | upright text `dc` | non-empty `dc` |
| unsupported/incomplete | no annotation | formatter reports reason |

The MOS display joins the raw `w` and `l` parameter strings with `/` (for
example `10u/0.5u`) as one plain text run in the active RichText contract
(`text | line-break | span`). The stacked `fraction` run kind cited by the
original draft does not exist: it was retired with the markup editor in
`32e256c` and is explicitly rejected by `packages/model/src/rich-text.test.ts`.
The Razavi six-panel visual authority contains no W/L annotation at all, so
inline slash notation is the minimal faithful reading; a human may still veto
this correction. `m` stays electrical-only in this release: do not invent a
`xM` notation rule.

### Placement is a second slot in current derived geometry

Extend the current derived instance-label placement authority to accept
`reference` and `value` slots. It must respect active symbol variants, visible
ink bounds, grid, rotation/mirror, upright-text clearance and companion-slot
spacing. No editor or renderer hard-coded value coordinates.

When both are visible, their defaults must not overlap. A manually dragged
Value keeps its local offset when Reference visibility or parameter content
changes. Existing transforms follow both attached roles.

### UI behavior

- Reference retains its current insert default; Value defaults off.
- Insert dialog offers independent compact `Reference` and `Value` toggles.
- Component Properties offers the same compact paired row; replace the current
  large unstyled Reference checkbox with a reusable display-toggle component.
- Group selection offers the same independent toggles, applying each to all
  compatible selected instances. All-visible/not-all-visible is sufficient.
- Value is disabled with concise help if no formatter exists or required input
  is blank. It enables after Apply persists valid parameters.
- Quick-place explicitly uses `showValue: false`.

### Source values

Add source parameter entries to `componentParameters()` under the key `dc` —
the netlist contract (`requiredParameters: ["dc"]`, printers emit `DC <dc>`)
makes `dc` the electrical key; the UI label reads "Value" with correct
unit/help/placeholder. There are no waveform-specific typed fields today;
do not invent any.

## Implementation Sequence

1. **Model and formatter**
   - Add `instance-value` to `AnnotationKindSchema` and bump
     `CURRENT_PROJECT_SCHEMA_VERSION` 9 → 10. No migration reader exists;
     the compatibility corpus and every tracked `.icproj.json` fixture must
     be regenerated to v10, and the agent-api generated schema artifacts
     refreshed. Update `docs/user/project-compatibility.md`.
   - Implement/test the pure formatter: MOS inline `w/l`, passive/source
     values, missing W/L, compatibility fallback and RichText output.

2. **Shared presentation and transactions**
   - Generalize default label placement into reference/value slots.
   - Add shared find/create/show/hide/refresh helpers. A hidden Value is
     never materialized at insert: the annotation is created on first show
     (hidden annotations still extend export bounds, so default-off must not
     persist a placeholder).
   - Refresh Value content inside the Edit Engine
     `set_instance_netlist` / `patch_instance_properties` handlers so editor,
     Agent, and external clients stay in sync; refresh only when the current
     content still equals the formatter's output for the previous parameters
     (hand-edited RichText is preserved, mirroring the clipboard
     `rewriteInstanceLabelText` precedent). Anchor offsets survive.
   - Ensure transforms, undo/redo and clipboard retain both roles.

3. **Renderer and editor**
   - Render `instance-value` through current annotation presentation, text
     metrics, hit surface and export path.
   - Add source value registry entries.
   - Wire insert, quick-place, selected component and group controls through
     shared helpers; use one compact display-toggle CSS component.

4. **Visual closure**
   - Add a Razavi fixture: NMOS/PMOS W/L, passive values, voltage/current
     sources, and Reference/Value combinations.
   - Verify toggle persistence, fraction SVG, dragging, parameter refresh,
     copy/paste, undo/redo, rotation/mirror and export bounds.
   - Inspect all four orientations with both slots visible; text must not
     overlap symbols or each other.

## Validation

During the focused loop, use `pnpm test:local` for affected model, derived,
Edit Engine, renderer and editor value tests, plus `pnpm test:e2e:local
apps/editor/e2e/manual-editor.spec.ts --grep "value display|reference and value|drag value"`.

At branch completion, run `pnpm verify:branch`, `git diff --check`, and
`git status --short --branch`.

Before any merge or push to `main`, run `pnpm install --frozen-lockfile` then
`pnpm ci:check`, push the review branch, and require green GitHub Actions.

## Commit Intent

```text
feat(model): add instance value annotations
feat(presentation): format and place instance values
feat(editor): toggle component value displays
test(editor): cover draggable Razavi value annotations
```

## Outcome

Delivered on branch `zcode/instance-value-display`. The code audit found four
planning errors recorded under Frozen Design: the retired `fraction` run kind
(replaced by inline `<w>/<l>` upright text, flagged for human veto), the
source electrical key `dc`, schema version 9 → 10 with corpus/fixture/agent-api
plus MCP-resource regeneration, and an Edit-Engine canonical-only refresh.

Implemented: `instance-value` annotation kind; pure
`displayableInstanceValue` formatter (MOS `w/l`, passive/source scalar,
properties fallback); reference/value placement slots with a grid-quantized
row offset; engine reflow for both slots and canonical content refresh after
`set_instance_netlist`/`patch_instance_properties` (hand-edited text
preserved, emptied projections hide); renderer font routing; insert-dialog
paired Reference/Value toggles, Properties and group toggles through one
`DisplayToggle` component; source `dc` parameter entries; quick-place
`showValue: false`; hidden values are never materialized at insert.

Validation: 784 unit tests, full e2e suite 143/143, `pnpm ci:static`,
`pnpm verify:branch` (build + production smoke), four-orientation GUI
inspection of the new `instance-value-display` fixture (no text/symbol
overlap in any orientation), `git diff --check` clean. Four-orientation
visual evidence: no stacked-fraction authority exists in the Razavi
six-panel reference; the inline slash reading awaits human confirmation.
