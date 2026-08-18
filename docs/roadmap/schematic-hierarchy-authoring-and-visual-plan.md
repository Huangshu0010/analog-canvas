# Schematic hierarchy authoring and adaptive symbol plan

Status: `proposed`

Baseline: Project schema 12 and [ADR 0025](../adr/0025-schematic-hierarchy-and-formal-ports.md)

## Objective

Complete the first hierarchy release as an efficient schematic-authoring
workflow and give every hierarchical Cell a readable, adjustable,
Razavi-compatible block presentation. Keep the current schematic-only model:
a Document is a reusable Cell definition, a subcircuit Instance is a caller,
and an ordinary Port Instance bound by a formal terminal is the child-side
interface marker.

This plan deliberately does not add generic Cell/View/Layout containers, an
arbitrary symbol drawing editor, instance-local pin geometry, or a second edit
or rendering protocol.

## Current gaps on main

The schema-12 electrical and lifecycle foundation is sound, but the first UI
and generated block are still scaffolding:

- **Place Cell** prompts for a name and immediately inserts at view center. It
  bypasses the existing cursor preview, snap, rotate, mirror, cancel, default
  reference annotation, and value annotation workflow.
- Creating a formal port requires three separate concepts: place an ordinary
  Port, connect it, then expose it. That is useful as an advanced conversion
  path, but too indirect as the primary workflow.
- Cell lifecycle actions are distributed across a toolbar. A referenced delete
  reports rejection but does not first show callers or provide a jump path.
- A hierarchy body has a fixed width, height reacts only to pin count, and
  terminals are split mechanically between west and east. Direction, label
  length, and user intent do not affect layout.
- Pin names use the shared text renderer and the body uses the active style
  profile, but the generated spacing and label organization are not calibrated
  to that visual grammar. A placed Cell also lacks the ordinary `Xn` and value
  annotations created by the component placement path.
- Rectangle conversion correctly commits an Instance rather than a drafting
  object, but its existence can make the rectangle tool appear to be the Cell
  creation mechanism. It must remain only an optional drafting shortcut.

## Decisions

### 1. Preserve one hierarchy model

No hierarchy object is added. The authoritative relationships remain:

```text
child Document
  ├─ netlist.terminals[]: stable electrical interface
  ├─ ordinary Port Instances: visible child-side markers
  └─ presentation.cellSymbol: optional definition-level visual intent

parent Document
  └─ ordinary Instance with subcircuit binding: one Cell use
```

Deleting a caller Instance uses normal selection deletion and never deletes
the child definition. Deleting a Cell definition remains a separate Project
structural action and is allowed only when it is non-top and unreferenced.
The first completion does not add cascade delete.

### 2. Add one bounded definition-level presentation intent

Schema 12 is already merged, so persisted pin placement requires Project
schema 13. Add this optional member to `Document.presentation`:

```ts
cellSymbol?: {
  minimumBodySize?: {
    width: number;
    height: number;
  };
  pinPlacements?: Array<{
    terminalId: StableId;
    side: "north" | "east" | "south" | "west";
    offset: number;
  }>;
}
```

Rules:

- This intent belongs to the child Cell definition and therefore affects all
  caller Instances. A caller may still rotate or mirror the whole Instance.
- `terminalId`, not a mutable terminal name, is the presentation identity.
- `minimumBodySize` and `offset` use symbol-local units and the existing
  `SYMBOL_CONNECTION_GRID` of 10. Width and height are positive grid multiples;
  offset is a signed grid multiple measured from the body center along its
  selected edge.
- Each terminal appears at most once. Unknown/deleted terminal IDs and two
  explicit pins occupying the same side/offset slot are invalid.
- Omitted entries are auto-placed. An explicit entry overrides only that
  terminal; it does not copy geometry into parent Instances.
- The body may grow beyond the requested minimum to fit pins and labels. The
  setting is a minimum, never a clipping command.
- Child-canvas Port marker position does not determine parent-block pin
  position. The former organizes the implementation schematic; the latter is
  symbol presentation.

Do not put side/offset on the electrical formal-terminal record. Direction is
electrical intent; side is visual intent. Keeping them separate allows an
input to be drawn at the north edge without falsifying ERC semantics.

The schema-13 reader supports schema 12 directly and replaces the current
schema-11 adapter, preserving the rolling N-1 rule. The v12-to-v13 adapter
advances the version and leaves `cellSymbol` absent, which selects deterministic
auto layout. Schema 11 then becomes unsupported; there is no migration chain.

### 3. Derive adaptive geometry; do not persist artwork

`@icm/symbols` continues to generate one `SymbolDefinition` from the child
Document. The Project file stores intent, not polylines, text, or parent-local
pin coordinates.

The initial deterministic layout policy is:

1. Reserve explicit side/offset slots.
2. Put unspecified `input` terminals west and unspecified `output` terminals
   east, preserving formal-terminal order within each side.
3. Balance unspecified `inout` and `passive` terminals across west/east, also
   preserving interface order and filling unused slots first.
4. Do not infer power, clock, or hidden pins from terminal names. North and
   south placement is explicit presentation intent.
5. Use a 20-unit row pitch, one row of body padding at each end, and the
   existing 10-unit lead length. Grow height for occupied west/east offsets and
   width for occupied north/south offsets.
6. Grow width conservatively for the longest inward-facing pin labels. Use a
   deterministic symbol-layout estimate and round to the connection grid;
   geometry must not depend on a caller Document's style profile.

The default body remains rectangular because rectangular hierarchical blocks
are the intended symbol vocabulary. It is emitted as ordinary Symbol
primitives and is unrelated to `DraftRectangle`. Selection, hit testing,
terminal resolution, SVG/PNG/PDF export, and route endpoints continue through
the shared Symbol resolver.

### 4. Reuse the visual system

No hierarchy-specific font, stroke width, raw SVG text, or alternate renderer
is introduced.

- Body and pin leads use normal Symbol primitives with the active profile's
  symbol stroke, cap, join, and miter settings.
- Pin names continue through the shared `pin-name` RichText rendering path and
  schematic typography.
- A placed caller receives the ordinary object-anchored `instance-label`
  annotation for `Xn` and an `instance-value` annotation containing the Cell
  name. Both use the existing semantic RichText, default label placement,
  drag, hit, export, clipboard, and deletion behavior.
- Auto-size spacing and annotation placement are tested under
  `razavi-textbook-v1`. The Razavi reference manifest remains the sole visual
  authority. If it has no hierarchical-block witness, this work is described
  as Razavi-compatible visual grammar, not pixel-verified Razavi artwork.

### 5. Keep one mutation language

Add one narrow `SchematicEdit` member for the new persisted fact:

```ts
{
  kind: "set_cell_symbol_presentation";
  presentation: CellSymbolPresentation | null;
}
```

`null` restores automatic layout. GUI and Agent use this same edit through the
existing Project transaction wrapper. Add, rename, direction change, reorder,
and remove formal terminal continue to use the existing terminal edits and
hierarchy planners.

High-level planners compose user intent from existing edits:

| User intent | Shared planner result |
|---|---|
| Create Cell | `add_document` |
| Rename Cell | child metadata edits plus caller binding/symbol reconciliation in one Project transaction |
| Place Cell | `transact_document` containing `add_instance` and annotation upserts |
| Add Cell Port on an existing Net | ordinary Port `add_instance`, connect pin `P`, then `add_cell_terminal` |
| Add Cell Port in empty space | ordinary Port `add_instance`, create/connect one local Net, then `add_cell_terminal` |
| Adopt selected Port | existing expose planner |
| Rename/change direction/reorder port | existing terminal edits and caller reconciliation where required |
| Move a block pin | `set_cell_symbol_presentation` through a Project planner |
| Delete Cell port | existing reference-aware remove planner |
| Delete Cell | `remove_document` after caller check |

Geometry changes move resolved terminal points but do not add a Route endpoint
kind. Generalize the existing instance route-follow calculation so the Project
planner can compare the old and new resolvers and emit ordinary
`set_route_points` edits for affected callers. Logical Net membership and
terminal endpoints remain unchanged; only the adjacent route geometry follows
the moved pin. The complete definition and caller reconciliation is one undo
item.

## User interaction

### Cell navigation and management

Keep the navigation row focused on location:

- breadcrumb from top to the current concrete caller path;
- **Up** and **Top**;
- current Cell selector;
- **Cells…** entry to the Cell Manager.

The Cell Manager lists Cell name, formal port count, and caller count. It owns
New, Rename, Open, and Delete. A referenced Cell's delete action is disabled
with its caller count; expanding the row lists caller Instances and **Jump to
caller**. Shared Cells opened without a caller retain the existing explicit
caller-choice rule for upward navigation.

Do not add recursive/cascade deletion in this phase. The safe workflow is:
inspect callers, delete the intended caller Instances through normal selection,
then delete the now-unreferenced definition.

### Placing a Cell

Existing project Cells appear as a dynamic section in the normal Insert
dialog. Selecting one enters the same pending-placement controller used for
built-in components:

```text
choose Cell
→ cursor-following symbol preview
→ grid snap; R rotates; mirror shortcuts work; Esc cancels
→ click commits one subcircuit Instance plus Xn and Cell-name annotations
```

The interaction controller is shared; only the commit factory differs because
a hierarchy Instance needs a subcircuit binding and ordered formal-terminal
metadata. Remove the prompt-and-view-center `Place Cell` path after parity is
covered. Rectangle-to-Cell remains an optional shortcut and should route its
new caller through the same instance/annotation construction helper.

### Creating and editing formal ports

Make **Add Cell Port** the primary action while a non-top or reusable Cell is
open:

1. Enter name, electrical direction, and hollow/filled marker choice.
2. Click an existing Net/route to expose it, or click empty grid space to
   create a new local Net and placed marker.
3. Commit the ordinary Port Instance, pin-`P` connection, and formal terminal
   atomically.

Keep **Adopt selected Port as Cell Port** as the advanced path for an already
drawn and connected marker. The Cell Interface inspector presents one ordered
table of name, direction, side, and position. Electrical edits and visual edits
remain distinct underneath even though they are edited in one panel.

When a selected Port Instance is a formal interface marker, Delete routes to
the formal-port removal planner and explains any caller or attached-route
blocker. An ordinary, unexposed Port still uses normal Instance deletion.

### Adjusting external pins

Selecting a hierarchical block offers **Edit Cell Symbol**. This is a bounded
definition-edit mode, not a free-form symbol editor:

- show one handle per formal pin on the generated body;
- drag along an edge to change offset, or across an edge to change side;
- snap to the 10-unit symbol grid and preview collision/auto-growth;
- commit once on pointer release; Esc restores the prior intent;
- state visibly that the edit affects all instances of the Cell and show the
  caller count.

The same side/offset values are editable in the Cell Interface inspector for
keyboard-accessible exact control. There are no per-instance pin overrides.

## Work packages

### H1 — Schema 13 and adaptive derived symbol

- **Goal:** persist the minimum presentation intent and derive stable geometry.
- **Main modules:** `packages/model`, `packages/project-protocol`,
  `packages/symbols`, `packages/edit-engine`, Agent schema/generated artifacts,
  current protocol docs.
- **Deliverables:** v13 schemas and direct v12 migration; symbol presentation
  edit; direction-aware auto layout; explicit side/offset; adaptive body;
  old/new-resolver route-follow reuse.
- **Focused validation:** strict schema and migration tests; layout golden
  facts for zero/one/many/long-name/mixed-direction pins; invalid slot tests;
  resolver terminal coordinates; connected caller route-follow; save/reopen;
  Agent edit parity and generated-artifact checks.

### H2 — Unified Cell placement and annotations

- **Goal:** make Cell placement behave like ordinary component placement.
- **Main modules:** editor insert dialog, pending placement controller,
  hierarchy instance factory, rectangle conversion.
- **Deliverables:** searchable Cell entries; cursor preview; rotate/mirror/snap/
  cancel; atomic caller commit; default `Xn` and Cell-name annotations; removal
  of the center-placement prompt.
- **Focused validation:** placement helper unit tests and Playwright coverage
  for preview, transform, cancel, commit, labels, undo/redo, save/reopen, and
  rectangle-conversion parity.

### H3 — One-step port authoring and interface inspector

- **Goal:** reduce the normal formal-port workflow to declaration plus canvas
  placement while retaining the existing advanced adoption path.
- **Main modules:** hierarchy planners, editor port placement mode, Cell
  Interface inspector.
- **Deliverables:** existing-Net and new-Net port planners; ordered interface
  table; rename, direction, reorder, side, offset, and reference-aware delete.
- **Focused validation:** planner atomicity; Port/Net/formal-interface closure;
  shared-caller rename; direction versus side independence; deletion blockers;
  pointer and keyboard browser workflows; netlist terminal order.

### H4 — Cell Manager and caller-aware lifecycle

- **Goal:** make reusable Cell creation, rename, navigation, and deletion
  discoverable without weakening lifecycle rules.
- **Main modules:** editor hierarchy navigation, Project connectivity index,
  structural planners.
- **Deliverables:** Cell Manager; breadcrumb; caller list/jump; atomic rename;
  explicit unreferenced delete; simplified navigation toolbar.
- **Focused validation:** top/referenced/unreferenced delete cases; shared Cell
  caller paths; rename across multiple parents; undo/redo; save/reopen; cycle
  rejection remains intact.

### H5 — Visual and workflow acceptance

- **Goal:** close the complete interaction and presentation contract.
- **Main modules:** SVG renderer/derived hit geometry only where shared behavior
  needs adjustment, editor E2E, formal exporters, user/spec documentation.
- **Deliverables:** reviewed hierarchy examples at 0°, 90°, mirror, dense pins,
  long names, and shared callers; user guide; compatibility notice.
- **Focused validation:** editor/render/export agreement; no hard-coded
  hierarchy font or stroke; visual snapshots under the Razavi profile;
  affected unit/E2E tests, `test:impact`, and branch verification.

Each work package is a separate implementation target and commit boundary.
H1 precedes H2–H4. H2 and H3 may proceed independently after H1; H5 closes
only after all three user-facing slices are complete.

## Acceptance scenarios

```text
Open a parent Cell and insert a reusable child
→ choose it from the normal Insert dialog
→ preview follows the cursor and supports rotate/mirror/cancel
→ click creates one valid subcircuit Instance with Xn and Cell-name labels
```

```text
Open a child Cell and choose Add Cell Port
→ declare IN as input and click an existing signal Net
→ one visible ordinary Port is connected to that Net
→ one stable formal terminal appears and every caller derives an IN pin
```

```text
Edit the child symbol and drag IN from west to north
→ all callers preview the same definition-level change
→ commit keeps their logical connections and orthogonally follows adjacent
  route geometry in one undoable Project transaction
```

```text
Add long pin names and many outputs
→ body width and height grow on the symbol grid
→ pin names do not overlap each other or cross the body boundary
→ renderer, hit geometry, export bounds, and terminal snapping agree
```

```text
Attempt to delete a shared child Cell
→ Cell Manager shows each caller and disables definition deletion
→ jump to and delete the intended caller Instances normally
→ delete becomes available only when the definition is unreferenced
```

## Explicit non-goals

- generic library, Cell/View, layout, behavioral, extracted, or multi-page
  containers;
- arbitrary line/arc/text drawing inside a hierarchy symbol;
- multiple symbol views or per-instance pin layouts;
- buses, bundled ports, parameters, or automatic power-pin inference;
- cascade deletion or garbage collection of unreferenced Cells;
- persisting generated Symbol primitives or a flattened editable copy;
- claiming pixel-level Razavi fidelity without manifest evidence.

## Exit gate

The hierarchy completion is done when all acceptance scenarios pass through
the normal GUI and Project save/reopen path; GUI and Agent mutations share the
same typed edits; connected caller routes remain valid after definition-level
pin movement; formal exports use the same resolved symbols; and no hierarchy
code introduces a second placement, annotation, endpoint, or drawing model.
