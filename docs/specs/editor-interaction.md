# Editor Interaction Contract

Status: `accepted`

Version: `1.3`

Owning phase: `Phase 8`

Primary owner: `apps/editor`

## Purpose

Define the target human interaction model for a compact schematic editor. The
canvas uses direct manipulation and context instead of exposing every internal
Edit Engine operation as a permanent toolbar button. Human UI operations and
Agent API transactions must still resolve to the same typed, atomic edits.

Phase 8 implements this contract as a compatible extension of the Phase 7
Project and Document baseline.

## Consumers

- The editor shell, canvas controller, component palette, and context menus.
- The Edit Engine and history implementation.
- Connectivity, routing, derived-overlay, and SVG-rendering modules.
- The built-in Symbol DSL library and VSS development-import workflow.
- The Agent adapter and its capability/schema artifacts.
- Keyboard, pointer, integration, and visual-regression tests.

## Terminology

| Term              | Meaning                                                                                                                |
| ----------------- | ---------------------------------------------------------------------------------------------------------------------- |
| Pointer mode      | Default canvas state in which click, drag, selection, and contextual handles infer the immediate interaction.          |
| Wire session      | A cancellable interaction from a pin, route segment, junction, or explicit Wire command to a valid endpoint.           |
| Snap candidate    | Transient preview of the exact pin, segment, junction, or grid point that would receive the next action.               |
| Crossing          | A geometric route intersection with no electrical connectivity and no persisted junction.                              |
| Junction          | A persisted electrical connection displayed as a dot where a wire explicitly starts, ends, or branches on a conductor. |
| Atomic move       | One transaction that moves all selected objects and applies all required local route stretch, or changes nothing.      |
| Contextual action | An action shown only when the current selection can use it, such as alignment for multiple selected instances.         |

## Command surface

The production header exposes document/navigation and high-frequency document
commands. Component placement and drawing tools live in the left Library dock,
not in a modal palette or a permanent toolbar row:

```text
File | Edit | View | Export | More
```

The exact visual treatment may use icons, labels, or responsive grouping, but
the information architecture is normative:

| Group   | Commands                                                                            |
| ------- | ----------------------------------------------------------------------------------- |
| File    | Open, Save, Import, recent/example documents                                        |
| Edit    | Undo, Redo, Copy, Paste, Delete, and contextual Align                               |
| Library | searchable/collapsible component families; Wire, Text, Arrow, and Construction line |
| View    | Fit, Diagnostics, Grid, and presentation overlays                                   |
| Export  | SVG, PNG, and PDF from one menu                                                     |
| More    | route-attached current arrow, Guides, help, and shortcut reference                  |

The following are not permanent production toolbar modes:

- Select, Junction, Crossing, Stretch, Detach, Rotate, Mirror, Zoom, and Pan.
- Save snapshot and Reopen snapshot; recovery is automatic infrastructure.
- Phase/demo actions; examples belong in File/Open Example or development mode.

The left dock is collapsible. Choosing a component starts single-shot
placement; choosing a drawing tool starts the named canvas gesture. Demo and
diagnostic actions do not appear on the production command surface.

## Text, markup, and peripheral editing

This section is `proposed` (ADR 0010); interaction lands in WP-A3/A4. It
freezes the V1 tool surface and command mapping.

The left Library owns Text and free drawing tools. `More` retains only
route-attached annotation and Guide commands:

| Group   | Contents                                                                          | Shortcut           |
| ------- | --------------------------------------------------------------------------------- | ------------------ |
| Text    | text, caption, format tools                                                       | `T` text placement |
| Markup  | free arrow and construction line from the Library; route arrow remains contextual | `A` arrow          |
| Guides  | add horizontal/vertical guide, show/hide, lock, clear unlocked                    | `G` guide tool     |
| Palette | search all low-frequency commands                                                 | `Ctrl+K`           |

`R`, `W`, undo/redo, and the existing keyboard contract are unchanged. Canvas
shortcuts must not fire while a rich-text editor, input, or search field has
focus.

Rich text is edited in place: selecting `Text` and clicking canvas/Route/object
shows a free/route/object anchor preview, then an inline editor. `Enter` breaks
the line, `Ctrl+Enter` commits, `Escape` cancels or exits. A floating format
bar acts on the selection: italic `Ctrl+I`, bold `Ctrl+B`, subscript
`Ctrl+=`, superscript `Ctrl+Shift+=`, and a fraction button. Font size uses a
token dropdown (caption/body/label) plus +/- levels, never an unbounded numeric
field. The import shorthand (`M_{1}`, `\it{...}`, `\frac{a}{b}`) is parse-on-
submit input convenience only; the persisted truth is the canonical RichText
AST.

Route markers, arrows, leaders, and callouts use the shared `VisualAnchor`: a
current marker dragged along a Route updates `segmentIndex/t`, a normal drag
updates `normalOffset`, and a reverse button toggles `direction`. A leader/
callout is first pointed at the explained object/node, then dragged to the
explanation; its text and leader select, move, copy, and delete as one object.
A construction line is visually distinct from Wire (dashed/lighter preview) and
never shows an electrical snap/junction preview.

Guides are dragged from a ruler (or `G` then click for touch). Drag moves the
guide, double-click locks it, `Delete` removes an unlocked guide. Snap priority
for object editing is Grid, Guide, object bounds/anchor, and selected
DraftingObject endpoints only; Pin/Junction/Route snap belongs to Wire
sessions. Copy/paste uses fresh IDs and remaps internal object/route anchors in
the same Document; external target anchors become free anchors with a prompt.

Hit testing uses a screen-pixel tolerance, not a large document-coordinate
circle: text box/handle first, then DraftingObject, then Symbol/Route. `Alt`
cycles candidates at the same point, so text hidden behind a device remains
selectable without enlarging pin selection circles.

## Keyboard contract

| Input                      | Action                                                                             |
| -------------------------- | ---------------------------------------------------------------------------------- |
| `R`                        | Rotate the selected placeable objects by 90 degrees.                               |
| `W`                        | Enter or continue Wire mode.                                                       |
| `Escape`                   | Cancel the active gesture, then return to Pointer mode.                            |
| `Delete` / `Backspace`     | Delete the selected object after applying the selection-specific semantic command. |
| `Ctrl+Z`                   | Undo one committed transaction.                                                    |
| `Ctrl+Y` or `Ctrl+Shift+Z` | Redo one transaction.                                                              |
| `Ctrl+S`                   | Save the current Project.                                                          |
| `Ctrl+O`                   | Open a Project.                                                                    |
| `Ctrl+A`                   | Select all selectable objects in the active Document.                              |
| `Ctrl+C`                   | Copy selected instances plus their wholly internal routed subgraph.                |
| `Ctrl+V`                   | Paste the internal clipboard with fresh IDs and a deterministic grid offset.       |
| `F`                        | Fit the active Document in the viewport.                                           |

Letter and editing shortcuts must not fire while focus is in a text input,
text editor, searchable palette field, or another control that consumes the
key. Browser-reserved shortcuts must not be intercepted unless the application
can complete the named operation safely.

## Pointer and viewport contract

### Default selection

- Clicking a selectable object selects it; clicking blank canvas clears the
  selection.
- `Shift`-click or `Ctrl`-click adds or removes an object from the selection.
- Dragging blank canvas creates a rectangular selection preview. Releasing
  commits the selection; `Escape` restores the prior selection.
- Dragging any selected movable object moves the whole movable selection in
  one atomic transaction.
- An atomic multi-object move includes Junctions, Routes, and annotations whose
  complete electrical subgraph is internal to the selected instances. Internal
  geometry translates by the common delta; only connections crossing the
  selection boundary receive deterministic local stretch. If any member is
  locked or violates a constraint, the whole move is rejected with a visible
  reason.

### Viewport

- An unmodified mouse wheel over the canvas zooms around the cursor position.
- `Ctrl`/`Command` plus mouse wheel remains a browser-reserved page-zoom
  gesture and must not be intercepted by the editor.
- Middle-button drag pans the viewport.
- Viewport changes never modify the Document revision or enter undo history.
- Normal wheel behavior remains available to the host page when the canvas
  does not own focus or the zoom modifier is absent.

### Contextual manipulation

- A selected direct route segment exposes a drag handle that creates an
  orthogonal dogleg; selecting any segment exposes the same handle. Dragging
  moves that segment perpendicular to itself while its neighboring vertices
  rubber-band orthogonally. There is no separate Stretch tool.
- Rotate and Mirror are available from shortcuts or a contextual selection
  control.
- Alignment appears only for a compatible multi-selection.
- Selecting an instance exposes its displayed-name field. Selecting a Route
  exposes its electrical Net-label field. Selecting an annotation exposes its
  text field and delete action.
- Instance labels remain draggable only within a bounded neighborhood of the
  owning symbol. Net labels remain draggable only near their attached Route;
  plain text may move freely.
- Route or endpoint removal uses distinct context commands: `Remove route
geometry`, `Disconnect endpoint`, and `Delete connection`. These operations
  must not be represented by one ambiguous Detach command.

## Manual component authoring

The Add Component entry opens a searchable palette grouped by device family.
Every entry includes a deterministic preview rendered from the same Symbol DSL
definition used by the canvas. Choosing a symbol starts single-shot placement
and the next canvas click places an instance. Placement is possible in a new
empty Document without importing SPICE first.

Copy captures selected instances and only Nets, Routes, Junctions, and attached
annotations wholly internal to that selection. Paste creates fresh stable IDs
and commits the duplicated subgraph atomically. A copied named Net reconnects
to the existing same-name Net; unnamed Nets are duplicated.

Phase 8 requires typed Edit Engine operations equivalent to:

```ts
add_instance;
remove_instance;
connect_endpoints;
merge_nets;
disconnect_endpoint;
```

The accepted Edit Engine revision defines these names and payloads. GUI
operations and Agent transactions call those same semantic operations; neither
surface patches Project JSON directly.

For an imported source, any manual edit that changes electrical connectivity
sets the active Document's `sourceStatus` to `connectivity-modified`. The
original source and source manifest remain preserved. Phase 8 does not write
modified connectivity back to SPICE text.

## Wire, junction, and crossing behavior

The core rule is:

> Passing across a conductor is a Crossing; ending or starting on a conductor
> is a Junction.

### Starting and ending

- Starting from a pin, existing Junction, Route segment, or blank grid point
  opens a wire session. A blank-grid source creates no Document records until
  the session commits.
- A blank-canvas click fixes an orthogonal bend. Double-click or `Enter`
  terminates at the current grid point as a dangling Junction. `Backspace`
  removes the latest uncommitted bend.
- Starting from the interior of an existing route segment previews and, on
  commit, creates or reuses a junction atomically.
- Releasing on a pin or existing junction connects to it.
- Releasing on the interior of a route segment previews a dot and, on commit,
  splits the route as needed and creates or reuses a junction atomically.
- Passing over or crossing a route without ending there creates no junction,
  no dot, and no connectivity.
- A wire end that geometrically hits more than one route segment is rejected as
  ambiguous. The user must choose one conductor away from the crossing.
- Deleting a connected instance converts each routed pin endpoint into a
  Junction at the former pin coordinate, removes that terminal from its Net,
  and removes the instance atomically. Remaining Route geometry and Net
  identity are preserved as dangling wiring.

### Net semantics

| Endpoint state                 | Committed result                                                    |
| ------------------------------ | ------------------------------------------------------------------- |
| Both endpoints unconnected     | Create one new Net and route.                                       |
| One endpoint connected         | Attach the other endpoint to that Net.                              |
| Endpoints on different Nets    | Explicit wire completion merges the Nets atomically after preview.  |
| Both endpoints on the same Net | Add or adjust route geometry without changing logical connectivity. |

### Text and Net-label semantics

- An instance's stable ID remains its connectivity identity. Its editable
  displayed name is an `instance-label` annotation.
- A Route label names its logical Net and is not decorative text. Applying a
  name uses `set_net_name`; applying an already-used name explicitly merges
  the two Nets in the same transaction.
- Removing the visible Net-label annotation does not disconnect endpoints or
  erase the logical Net name. Connectivity changes require their own explicit
  commands.
- `plain-text` annotations carry no electrical meaning.

`Alt` temporarily suppresses snapping. `Escape` or secondary-click cancels the
uncommitted wire session. Undo restores the complete pre-transaction topology,
route geometry, source status, and revision-visible state.

## Automation boundary

The editor may automate low-risk geometry and interaction consequences:

- snap preview, grid quantization, junction reuse, route splitting, local
  stretch, contextual handles, selection inference, and derived crossings;
- viewport navigation and visual overlays that do not change the Document.

The editor must keep ambiguous or destructive logical intent explicit:

- disconnecting endpoints, deleting connections, merging Nets other than by
  an explicitly completed wire, source writeback, and resolving an ambiguous
  multi-conductor connection.

All inferred edits require a deterministic preview when they would change
connectivity.

## Symbol fidelity boundary

The component palette uses runtime-independent Symbol DSL definitions. The 12
review-manifest families retain their VSS evidence and human-reviewed pin
mappings. A separate migration-candidate catalog exposes additional VSS-derived
geometry with provisional pin mappings explicitly marked for review. VDD is
geometry-migrated from VSS; VSS remains a project-native power-port definition.

The runtime library includes NMOS/PMOS three- and four-terminal forms, NPN/PNP,
resistor, capacitor, inductor, diode variants, voltage/current source variants,
op-amp, switches, crystal, transformer, VDD/VSS/GND, and ports. VSS remains
immutable build-time evidence; the runtime must not require Visio or parse
`.vss` files.

## Interaction state transitions

```mermaid
stateDiagram-v2
    [*] --> Pointer
    Pointer --> BoxSelect: drag blank canvas
    Pointer --> MoveSelection: drag selected object
    Pointer --> PlaceComponent: choose component
    Pointer --> Wire: W or drag from endpoint/segment
    BoxSelect --> Pointer: release or cancel
    MoveSelection --> Pointer: commit or cancel
    PlaceComponent --> Pointer: place or cancel
    Wire --> Wire: add orthogonal point
    Wire --> Pointer: commit endpoint or cancel
```

Only a completed placement, move, semantic edit, or wire session increments the
Document revision. Previews and cancelled gestures are transient.

## Persistence boundary

- Persisted: committed instances, annotations, logical Nets, endpoints,
  junctions, route geometry, source status, user-facing presentation state, and
  the `drafting` layer (objects and guides) already covered by the Project and
  Document specifications.
- Session-local: current selection, open menu, palette query, active gesture,
  snap candidate, drag rectangle, context handles, in-progress rich-text draft,
  and viewport transform.
- Derived: crossings, flightlines, diagnostics, hover affordances, snap
  overlays, and resolved drafting anchors/bounds.
- Never exported: Guides are persisted for collaboration but are always
  `export: false`; they never appear in formal SVG/PNG/PDF.
- External build-time evidence: VSS inventories, reviewed pin mapping, and
  geometry comparison artifacts.

## Valid example

```text
Empty Document
-> add an NMOS and resistor from the component palette
-> drag from the NMOS drain to the resistor pin
-> pass over one unrelated route and release on a second route
-> the passed route remains an unconnected Crossing
-> the release route displays a Junction dot and joins the resulting Net
-> one Undo restores the exact topology and geometry before the wire commit
```

## Rejected example

```text
The pointer merely moves across two intersecting route segments
-> the editor silently creates a Junction and merges their Nets
```

Required result: reject this behavior. A geometric crossing is derived and
non-electrical unless an explicit wire start/end gesture commits connectivity.

## Compatibility and migration

- Existing Phase 7 Projects remain valid; no file-format migration is required
  merely to adopt the new interaction controller.
- New topology operations are additive revisions of the Edit Engine, Agent
  capability schema, and connectivity specification.
- The Phase 7 explicit Junction command is absent from the production toolbar.
- Shortcut mappings must be discoverable and configurable in a later version;
  Phase 8 freezes only the default mapping.

## Deterministic validation

- Unit tests for the interaction state machine, shortcut focus guards, cursor-
  centered zoom math, rectangle selection, and atomic multi-object movement.
- Edit Engine parity tests proving GUI and Agent operations produce identical
  Documents for instance and topology edits.
- Connectivity tests for every endpoint-state row, route splitting, junction
  reuse, crossing non-connectivity, multi-conductor previews, cancel, and undo.
- Playwright pointer and keyboard flows for empty-Document authoring, routed
  multi-selection movement, copy/paste, text and electrical label editing,
  middle-button pan, zoom, direct wiring, and contextual deletion.
- Reviewed VSS-to-Symbol-DSL comparison artifacts and stable symbol preview
  goldens for the 12-family review-manifest set, plus a separately labeled
  contact sheet for migration candidates whose pins still require review.
- Production-build inspection proving demo controls are hidden and runtime code
  does not depend on Visio or `.vss` parsing.

## Open decisions

- User-remappable shortcut persistence remains a compatible post-Phase-8
  extension.
- Diagonal/any-angle drawing modes and whole-Net selection remain deferred;
  the accepted editor is orthogonal and segment-selective.
