# Schematic Model

Status: `accepted`

Version: `1.3`

Owning phase: `Phase 0`

Primary owner: `packages/model`

Related netlist contract:
[`netlist-export.md`](netlist-export.md) and
[`ADR 0017`](../adr/0017-deterministic-design-netlist-boundary.md).

## Purpose

Define the persisted electrical and presentation truth shared by human edits,
Agent edits, import, derived state, and rendering.

## Consumers

- `packages/edit-engine`
- SPICE importer
- symbol and renderer packages
- editor tools and Agent adapter

## Terminology

| Term                 | Meaning                                                                 |
| -------------------- | ----------------------------------------------------------------------- |
| Logical connectivity | Net membership expressed by terminals and ports                         |
| Visible connectivity | Route branches and junctions that visibly express part of a logical net |
| Derived state        | Pin coordinates, indexes, flightlines, diagnostics, and render scenes   |

## Data model or interface

`SchematicDocument` contains stable identity, revision, source status, ports,
instances, nets, routes, junctions, annotations, presentation intent, layout
groups, layout constraints, and a `drafting` layer. Coordinates are signed
integers in grid units.

## Text, annotation, and drafting layer

This section is `proposed` and is implemented by the Text & Peripheral Editing
System (ADR 0010). It freezes the V1 object and syntax scope; runtime code
lands in WP-A1.

The model separates three non-electrical concerns from electrical truth:

| Layer               | Contents                                                         |  Changes SPICE/connectivity  | Enters formal SVG/PNG/PDF |
| ------------------- | ---------------------------------------------------------------- | :--------------------------: | :-----------------------: |
| SchematicAnnotation | instance-label, net-label, power-label, route-marker             | only defined net-name action |            yes            |
| DraftingObject      | text, arrow, leader, callout, construction-line, floating-symbol |              no              |            yes            |

`annotations` narrows to `instance-label | net-label | power-label |
route-marker`, where `route-marker.markerKind` is `current | voltage`. The old
`plain-text` and `figure-caption` move to `drafting.objects`.

```typescript
interface DraftingLayer {
  objects: DraftingObject[]; // persistent, exported
}
```

RichText is a structured document, not an executable formula. The active
contract supports exactly three `RichTextRun` node kinds; `span` has four
styles:

```typescript
type RichTextRun =
  | { kind: "text"; value: string }
  | { kind: "line-break" }
  | {
      kind: "span";
      style: "italic" | "bold" | "subscript" | "superscript";
      children: RichTextRun[];
    };
```

Resource bounds are part of the contract: maximum nesting depth 4, maximum 64
runs per document, and maximum 256 characters per `text` run. Formatting is
authored through the canvas floating toolbar and persisted directly as the
canonical AST. Command-like text such as `M_{1}`, `\it{...}`, or
`\frac{a}{b}` remains literal when entered in the current editor; no markup
input language is interpreted on submit. Schema-v7 migration converts every
old single-string annotation once into an AST. A current persisted annotation
always has `content`; renderer, hit-testing, connectivity, and export have no
string or markup fallback.

Every attachable drafting object and route marker shares one `VisualAnchor`.
The `object` and `route` variants persist a `fallbackPosition` (last-known
resolved point):

```typescript
type VisualAnchor =
  | { kind: "free"; position: Point }
  | {
      kind: "object";
      objectId: StableId;
      localOffset: Point;
      fallbackPosition: Point;
    }
  | {
      kind: "route";
      routeId: StableId;
      segmentIndex: number;
      t: number;
      normalOffset: number;
      direction: "forward" | "reverse";
      orientation: "follow" | "horizontal";
      fallbackPosition: Point;
    };
```

A SchematicAnnotation has exactly one visual anchor. Net and power labels use
`netId` for electrical identity and `anchor` only for placement; an object or
Route id is never overloaded to mean both.

Anchor resolution reads derived Route/object geometry only and never mutates a
Route or Net. An
unresolved anchor (deleted Route/object, removed segment, non-orthogonal
segment) renders at `fallbackPosition` as a visible warning, and offers
re-attach / convert-to-free / delete. "Warning state" is a **derived
diagnostic** computed by the resolver, not a persisted boolean. It never
silently re-attaches to another conductor.

In V1, an `object` anchor may target only an Instance, Port, or Junction. A
DraftingObject may not anchor to another DraftingObject (no drafting-to-drafting
attachment, no cycles); a Route target uses the `route` variant.

Anchor-target deletion is non-cascading and non-rejecting: deleting a Route or
an Instance/Port/Junction that an anchor targets does not delete the attached
DraftingObject/route-marker and does not reject the delete. The same
transaction writes the object's last resolved position into `fallbackPosition`,
then the anchor becomes unresolved. Content locks do not block this fallback
maintenance (`locked: true` objects still receive `fallbackPosition` updates
and unresolved diagnostics); deleting the target itself remains governed by the
target's own lock.

```typescript
type DraftingObject =
  | DraftText
  | DraftArrow
  | DraftLeader
  | DraftCallout
  | DraftConstructionLine
  | DraftFloatingSymbol;
```

All drafting members share `id`, `locked`, `zIndex`, optional `styleOverride`,
and a bounded `VisualAnchor`. A `DraftFloatingSymbol.symbolId` may reference
only Symbol Catalog entries marked `decorative: true`, whose definitions
contain no terminal; a floating symbol never creates a Pin, Net, flightline,
Junction, or SPICE instance. Style overrides are limited to `sizeScale`,
`weight`, `italic`, `lineStyle`, `arrowHead`; no per-object arbitrary SVG/CSS.

Visual stacking is fixed: electrical Route/Junction -> Symbol ->
SchematicAnnotation -> draft line/arrow -> draft text/callout -> selection
handles. `zIndex` orders only within one DraftingObject kind.

An Instance placement is either `null` or a position plus rotation
`0|90|180|270` and mirror `none|x`. Mirror `x` negates the local x-coordinate
before rotation. Route waypoints exclude endpoints; endpoint coordinates are
derived from terminals, ports, or Junction objects.

## NoConnect, typed netlist facts, and import provenance

This section is owned by `packages/model` and implemented incrementally by
WP-R7/WP-R8 of the connectivity-routing-debugging roadmap. It does not change
the accepted v1.2 Net/Route/Junction contract.

Two new persisted electrical record kinds are added so ERC and model binding can
rely on facts that cannot be re-derived from `spice.target` strings or from
ordinary annotations.

```typescript
interface NoConnect {
  id: StableId;
  endpoint: TerminalEndpoint | PortEndpoint; // the Pin/Port intentionally left open
  reason?: string;
}

interface InstanceNetlistData {
  reference: string;
  binding?:
    | PrimitiveBinding
    | ModelBinding
    | SubcircuitBinding
    | ExternalSubcircuitBinding;
  parameters: Record<string, string>;
  terminals?: Array<{ sourcePosition: number; pinName: string }>;
}

interface InstanceImportProvenance {
  kind: "primitive" | "model" | "subcircuit" | "opaque";
  name: string;
  sourceTarget: string;
  status?: "resolved" | "missing" | "unsupported";
  modelType?: string;
  attributes?: Record<string, string | number | boolean>;
}
```

Invariants (frozen):

- A `NoConnect.endpoint` must not simultaneously belong to a Net, a Route, or
  another `NoConnect`. The Edit Engine rejects the conflicting combination
  atomically; it is not a derived warning.
- A hidden or implicit Pin is never auto-promoted to a `NoConnect` because it is
  not visible. SPICE Nets named `NC`, `N/C`, or `0` are never auto-interpreted
  as `NoConnect`.
- `NoConnect` is a first-class electrical record: it has typed edits,
  undo/redo, clipboard, delete, save/reopen, a fixed formal marker in the Razavi
  visual language, and participates in formal export. It is not an annotation.
- `InstanceNetlistData` owns every editable netlist fact: reference, binding,
  parameters, and imported terminal order. A linked subcircuit binding owns its
  `childDocumentId`; hierarchy never resolves a Cell by source name.
- `InstanceImportProvenance` is bounded, immutable source evidence. It explains
  import status (when known) and target spelling but cannot create connectivity,
  hierarchy, parameter, or model semantics. Normal property edits cannot patch
  it. Migration may preserve an exact target with no status rather than guess.
- Schema-v8 migration consumes `spice.name`, `spice.target`, `spice.pin.*`,
  `spice.param.*`, and `spice.childDocumentId` once. Current Projects reject
  all `spice.*` properties; no runtime consumer reads or writes them.

These records are the input the unified connectivity index (ADR 0013) and the
ERC engine consume; they are not derived state.

## Invariants

- IDs are immutable after creation and unique within a Document object graph.
- Imported IDs may be deterministically derived; new IDs use a prefixed UUID.
- Net terminals reference existing instances and preserve pin names.
- Net ports reference existing ports.
- Routes and their Junction endpoints belong to the same explicit net.
- Route segment mode count equals waypoint count plus one.
- A geometric crossing creates no connectivity.
- A connected branch requires an explicit endpoint or Junction object.
- Netlist export reads logical Net membership only. It never derives a Net,
  pin order, reference, model, or Cell interface from drawing geometry or
  annotation text.
- Persisted Cell interfaces and Instance netlist data are the sole netlist and
  hierarchy authority. Import provenance is explanatory only; ordinary
  properties, drawing geometry, and annotation text cannot substitute for
  typed facts.
- `placement: null` preserves an unplaced logical instance.
- Layout intent and annotation placement never modify logical connectivity.
- Annotation attachments reference an existing visual/electrical object.
- Layout groups and constraints contain unique existing object IDs.
- A layout constraint targets at least two objects.
- Drafting objects and non-`route-marker` annotations never create or
  modify a Net, Route, Junction, flightline, Pin, or SPICE instance.
- A `route-marker` or drafting `VisualAnchor` of kind `route`/`object` references
  an existing Route/object; an unresolved anchor keeps `fallbackPosition` and a
  resolver-emitted warning diagnostic rather than silently re-attaching. An
  `object` anchor targets only an Instance, Port, or Junction; never another
  DraftingObject.
- Deleting an anchor target neither cascades to the attached object nor rejects
  the delete; the same transaction updates `fallbackPosition` and the anchor
  becomes unresolved. Content locks do not block fallback maintenance.
- A `DraftFloatingSymbol.symbolId` references only a `decorative: true` catalog
  entry whose definition has no terminal; this is enforced by the Edit Engine
  via the Symbol Resolver, not by the model Zod schema.

## Operations and state transitions

Only the Edit Engine may commit a new Document revision. GUI preview, viewport,
selection, hover, and wire draft state do not mutate this model.

## Persistence boundary

Every field in `SchematicDocumentSchema` is persisted. Pin page coordinates,
spatial indexes, routed components, flightlines, diagnostics, and SVG scenes
are derived and absent from the schema.

Manual drawing Guides are not part of the persisted model. Automatic Smart
Snap alignment feedback is transient editor state and is never saved or
exposed through the Edit Engine.

## Valid example

An unplaced resistor may belong to a net through `{instanceId: "R1",
pinName: "1"}` while its `placement` remains `null`.

## Rejected example

A Route that references an absent Junction or a Junction on another net is
rejected. Two crossing polylines without an explicit Junction remain valid and
electrically separate.

## Compatibility and migration

New optional presentation concepts may extend a future schema version. Any
change to connectivity meaning, coordinate units, mirror order, or the
Project/Document hierarchy requires compatibility analysis and an ADR.

The Text & Peripheral Editing System (ADR 0010) bumps the persisted schema
major version `1` -> `2`. The migration is idempotent, applied on read, narrows
`annotations` to SchematicAnnotation, and moves `plain-text`/`figure-caption`
into `drafting.objects` as `DraftText` (string becomes a single `text`
RichText run; caption typography token and alignment are preserved). `current`
migrates to `route-marker/current` with its Route attachment preserved.
`voltage` migration is a deterministic rule: if it has a resolvable
`attachedObjectId` it becomes `route-marker/voltage` with an `object` anchor;
otherwise it becomes free `DraftText` preserving position/offset/rotation/
alignment plus a migration diagnostic. The migration never guesses a Route,
`segmentIndex`, or `t` from proximity. The migration does not change
Net/Route/Junction/instance and does not rewrite original SPICE. Migration
identity is measured with `electricalTopologyHash` (instances/ports/Nets/
hierarchy only; excludes placement, Route geometry, Junction placement,
annotations and drafting), which is unchanged across migration. Write-back
never regenerates the old `plain-text` shape.

## Deterministic validation

- schema reference and uniqueness tests
- integer transform round-trip tests
- route/Junction invariant tests
- persisted-field and unknown-field rejection tests

## Open decisions

- Additional constraint parameters may extend a later schema version without
  changing the electrical truth boundary.
