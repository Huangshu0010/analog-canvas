# Phase 8 - Direct Manipulation and Manual Authoring

Status: `complete`

> Historical completion record. References below to Visio/VSS-faithful
> components or VSS review are superseded by
> [ADR 0011](../../adr/0011-retire-visio-vss-as-visual-authority.md). They remain
> only as evidence of the completed interaction work, not current style rules.

## Objective

Replace the Phase 0-7 validation-oriented editor controls with a compact,
production interaction model in which users can author a schematic from an
empty Document, manipulate it directly, and obtain predictable connectivity
without Junction, Crossing, Stretch, Select, Zoom, or Pan tool modes.

## User-visible outcome

A user can open an empty Document, add Visio-faithful components, box-select
and move them, navigate the canvas with standard gestures, and wire pins and
existing conductors. Passing across a conductor remains a crossing; ending on
it creates a visible junction. The same edits are available to an Agent through
the existing non-MCP API boundary.

## In scope

- A frozen pointer/keyboard/viewport/wiring interaction contract.
- Typed, atomic instance and topology authoring operations in the Edit Engine.
- Agent capability and transaction parity for all new semantic operations.
- Searchable, categorized component palette and empty-Document placement.
- Direct selection, rectangle multi-selection, atomic group movement, direct
  two-point-route dogleg manipulation, and contextual actions. General elbow
  handles remain a compatible follow-up.
- Cursor-centered zoom, middle-button pan, Fit, and transient viewport state.
- Automatic crossing derivation and explicit start/end-on-segment junctions.
- A reduced, grouped production command surface with examples in development
  or File/Open Example flows.
- Retention of the reviewed VSS-derived analog set plus project-native VDD and
  VSS power-port symbols; no runtime Visio dependency.
- Keyboard focus safety, previews, cancel behavior, undo, diagnostics, and
  visible rejection reasons.

## Out of scope

- Automatic schematic layout or a general-purpose autorouter.
- Electrical simulation, model characterization, or correctness claims.
- Writing connectivity changes back into SPICE source text.
- Runtime Visio integration or runtime `.vss` import.
- Arbitrary third-party symbol-library import at runtime.
- Silent Net merges, inferred endpoint disconnection, or other ambiguous
  destructive edits.
- A complete keyboard-only spatial editing model; Phase 8 establishes the
  default shortcuts and focus rules.

## Dependencies

- Completed [`Phase 7`](phase-7-export-and-hardening.md) release baseline.
- Accepted [`Editor Interaction Contract`](../../specs/editor-interaction.md).
- Accepted [`Edit Engine`](../../specs/edit-engine.md),
  [`Connectivity and Routing`](../../specs/connectivity-and-routing.md),
  [`Symbol DSL`](../../specs/symbol-dsl.md),
  the archived
  [`VSS Development Import`](../visio-vss/vss-development-import.md), and
  [`Agent API`](../../specs/agent-api.md) contracts, each revised compatibly when
  its Phase 8 surface changes.
- Immutable `lib/circuit.vss` evidence and existing visual/contact-sheet tools.

## Work packages

### WP-8.1 - Freeze interaction and topology contracts

- Goal: accept the gesture state machine, keymap, snapping preview, selection,
  automatic junction, crossing, source-status, and destructive-action rules.
- Main modules: specifications, ADRs if compatibility analysis finds an
  architectural change, JSON Schemas, and acceptance fixtures.
- Required specs: editor interaction, Edit Engine, connectivity/routing,
  Schematic Document/source status, and Agent API.
- Validation surface: spec examples, schema compatibility, state-transition
  tables, and reviewed ambiguous-intersection cases.

### WP-8.2 - Add semantic authoring primitives

- Goal: add atomic instance creation/removal, endpoint connection,
  disconnection, and Net merge operations before UI controls depend on them.
- Main modules: model, Edit Engine, history, derived data, Agent adapter, and
  capability/schema generators.
- Required specs: accepted revisions produced by WP-8.1.
- Validation surface: invariants, rollback, undo/redo, locked-object rejection,
  source-status changes, and direct-engine/Agent parity.

### WP-8.3 - Establish faithful component placement

- Goal: allow searchable manual placement in an empty Document and upgrade the
  initial analog symbols using reviewed VSS geometry.
- Main modules: Symbol DSL library, VSS build tools, symbol registry, component
  palette, placement controller, and preview renderer.
- Required specs: Symbol DSL, VSS development import, editor interaction.
- Validation surface: pin-map review, geometry/contact-sheet comparisons,
  stable preview goldens, palette search/category tests, and placement undo.

### WP-8.4 - Replace tool modes with direct canvas manipulation

- Goal: implement automatic selection, box selection, multi-object movement,
  contextual geometry handles, focus-safe shortcuts, zoom, and pan.
- Main modules: editor interaction controller, canvas hit testing, selection,
  viewport, Edit Engine transaction bridge, and contextual UI.
- Required specs: editor interaction and Edit Engine.
- Validation surface: state-machine unit tests and Playwright pointer/keyboard
  gestures, including atomic rejection when one selected object is locked.

### WP-8.5 - Implement direct wiring and automatic junctions

- Goal: start wires from pins or conductors, derive crossings, and commit
  route splits, junction creation/reuse, and Net changes from explicit wire
  completion.
- Main modules: connectivity, routing, hit testing, snap preview, Edit Engine,
  renderer, diagnostics, and Agent adapter.
- Required specs: connectivity/routing, editor interaction, and Agent API.
- Validation surface: endpoint-state matrix, crossing/junction fixtures,
  cancellation, ambiguity preview, complete undo, and GUI/Agent parity.

### WP-8.6 - Consolidate the production shell and accept the workflow

- Goal: remove obsolete permanent buttons only after their gestures and
  contextual replacements work, then validate the complete authoring flow.
- Main modules: header menus, context menus, shortcut help, development flags,
  diagnostics, release build, user guide, and E2E suite.
- Required specs: editor interaction and export.
- Validation surface: production/dev command inventory, keyboard focus safety,
  responsive layout, release smoke, and human visual review.

## Deliverables

- Accepted interaction and compatible cross-module specification revisions.
- Versioned Edit Engine and Agent schemas for new semantic edits.
- Searchable component palette and reviewed initial analog symbol set.
- Direct-manipulation canvas controller and transient interaction-state model.
- Automatic junction/crossing implementation with topology fixtures.
- Reduced production header, contextual actions, and shortcut reference.
- Unit, integration, Playwright, parity, golden, and release-smoke evidence.
- Updated user guide documenting manual creation and gestures.

## Acceptance scenarios

```text
Empty Document
-> add an NMOS and resistor from the palette
-> position them and drag one pin to the other
-> one new Net and visible route are committed
-> Undo restores the exact empty-connection state
```

```text
Two unrelated existing routes
-> draw a wire across the first without stopping
-> release the wire on the interior of the second
-> the first intersection has no dot and no connectivity
-> the second has a dot and a persisted Junction
```

```text
Several instances, annotations, and attached routes
-> rectangle-select them and drag one selected instance
-> all movable members commit in one revision with local route stretch
-> when one member is locked, the entire move is rejected and nothing changes
```

```text
Imported SPICE-backed Project
-> manually add and connect a component
-> source status becomes connectivity-modified
-> original source text and source manifest remain intact
```

```text
Production editor
-> use click, box selection, R, W, Ctrl+wheel, and middle-button drag
-> complete the same core workflow without Select, Junction, Crossing,
   Stretch, Zoom, or Pan buttons
-> open Export once and choose SVG, PNG, or PDF
```

## Deterministic validation

- Schema and compatibility checks for Edit Engine and Agent API revisions.
- Typed-operation atomicity, topology invariant, undo/redo, and parity tests.
- State-machine, hit-test, selection, viewport-math, and shortcut-focus tests.
- Canonical crossing/junction/source-status Project fixtures.
- Playwright flows covering every acceptance scenario and cancel/error paths.
- Stable Symbol DSL previews plus reviewed VSS inventory/contact-sheet evidence.
- Production artifact inspection for hidden demo controls and zero runtime
  Visio/`.vss` dependency.
- Existing import, render, export, recovery, and performance gates to catch
  regressions across the Phase 7 release surface.

## Risks and decisions

| Risk or decision                                              | Handling                                                                                                        |
| ------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| A simplified UI hides important operations                    | Keep infrequent operations in grouped menus or contextual controls and provide a searchable shortcut reference. |
| Automatic snapping changes logical topology unexpectedly      | Require a dot/set preview before commit, `Alt` snap suppression, cancel, and atomic undo.                       |
| A UI-first implementation bypasses topology invariants        | Complete WP-8.2 semantic operations and parity tests before manual authoring and direct wiring depend on them.  |
| Multi-selection creates partial invalid movement              | Treat the whole move and route stretch as one transaction; reject all when any member fails.                    |
| VSS appearance and electrical pins diverge                    | Separate extracted geometry evidence from human-reviewed pin semantics and maintain preview goldens.            |
| Imported source appears round-trippable after manual rewiring | Mark `connectivity-modified`, preserve original source, and keep source writeback out of scope.                 |
| More-than-two-conductor intersections are ambiguous           | Freeze a preview and connected-set rule in WP-8.1 before implementation.                                        |
| Removing controls breaks discoverability                      | Keep `+ Component` and Wire visible, add context affordances, and remove old buttons only in WP-8.6.            |

## Exit gate

- All Phase 8 contract revisions are accepted and versioned.
- A clean production build passes all five acceptance scenarios without the
  obsolete permanent tool modes.
- GUI and Agent authoring produce identical validated Documents for the same
  semantic transaction sequence.
- Crossing and junction topology fixtures, cancel paths, and undo/redo pass
  deterministically.
- The initial analog symbol set has recorded human geometry and pin-map review.
- Existing Phase 7 import, export, recovery, and performance gates remain green.
- The phase log records test artifacts, visual review, known limitations, and
  the final command inventory before status changes from `proposed`.

## Completion evidence

- The editor now launches into an empty `New Circuit`, offers searchable
  palette placement, direct/box selection, atomic group movement, `R`/`W`/`F`
  and history shortcuts, cursor-centered zoom, middle-button pan, direct
  wiring, automatic end-on-route Junctions, derived Crossings, and distinct
  route/endpoint context actions.
- The production header exposes only **+ Component** and **Wire** as permanent
  action buttons; File, Edit, View, Export, and More are mutually exclusive
  grouped menus. Select, Junction, Crossing, Stretch, Detach, Zoom, and Pan
  buttons are absent.
- The Edit Engine and Agent API share typed `add_instance`, `remove_instance`,
  `connect_endpoints`, `merge_nets`, and `disconnect_endpoint` operations.
  Locked group movement rejects atomically, connectivity edits mark the source
  modified, and route/group/constraint references participate in transaction
  diffs.
- The 12-family VSS review manifest and its visual golden remain unchanged;
  project-native VDD/VSS power-port symbols extend the runtime library without
  claiming new Visio pin-review evidence or creating a runtime `.vss`
  dependency.
- Frozen install, formatting, four-reference validation, TypeScript, 96 tests
  in 28 files, workspace build, Agent API artifacts, symbol review, Phase 5
  visual golden, Phase 7 export goldens, PWA icons, performance budgets,
  release packaging/smoke, and seven Playwright workflows passed. The empty
  production workspace also passed a 1440x900 browser screenshot review.
- Compatible follow-ups remain explicit: persisted shortcut remapping,
  free-standing wire endpoints, and general multi-elbow route handles.
