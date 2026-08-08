# Schematic Model

Status: `accepted`

Version: `1.2`

Owning phase: `Phase 0`

Primary owner: `packages/model`

## Purpose

Define the persisted electrical and presentation truth shared by human edits,
Agent edits, import, derived state, and rendering.

## Consumers

- `packages/edit-engine`
- SPICE importer
- symbol and renderer packages
- editor tools and Agent adapter

## Terminology

| Term | Meaning |
|---|---|
| Logical connectivity | Net membership expressed by terminals and ports |
| Visible connectivity | Route branches and junctions that visibly express part of a logical net |
| Derived state | Pin coordinates, indexes, flightlines, diagnostics, and render scenes |

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

| Layer            | Contents                                                       | Changes SPICE/connectivity | Enters formal SVG/PNG/PDF |
| ---------------- | -------------------------------------------------------------- | :------------------------: | :-----------------------: |
| SchematicAnnotation | instance-label, net-label, power-label, route-marker         | only defined net-name action |          yes             |
| DraftingObject   | text, arrow, leader, callout, construction-line, floating-symbol |            no             |          yes             |
| Guide            | horizontal/vertical editor reference line                      |            no             |           no             |

`annotations` narrows to `instance-label | net-label | power-label |
route-marker`, where `route-marker.markerKind` is `current | voltage`. The old
`plain-text` and `figure-caption` move to `drafting.objects`.

```typescript
interface DraftingLayer {
  objects: DraftingObject[]; // persistent, exported
  guides: Guide[];           // persistent, always export: false
}
```

RichText is a structured document, not an executable formula. V1 supports
exactly six nodes:

```typescript
type RichTextRun =
  | { kind: "text"; value: string }
  | { kind: "line-break" }
  | { kind: "span"; style: "italic" | "bold" | "subscript" | "superscript";
      children: RichTextRun[] }
  | { kind: "fraction"; numerator: RichTextDocument; denominator: RichTextDocument };
```

A restricted import shorthand (`M_{1}`, `V_{DD}`, `\it{...}`, `\frac{a}{b}`) is
parsed to the AST on submit and is never persisted; unparseable shorthand is
stored as plain text with a visible prompt and never dropped. Old single-string
annotations migrate to a single `text` run.

Every attachable drafting object and route marker shares one `VisualAnchor`:

```typescript
type VisualAnchor =
  | { kind: "free"; position: Point }
  | { kind: "object"; objectId: StableId; localOffset: Point }
  | { kind: "route"; routeId: StableId; segmentIndex: number; t: number;
      normalOffset: number; direction: "forward" | "reverse";
      orientation: "follow" | "horizontal" };
```

This generalizes the existing `RouteAnnotationAttachment`. Anchor resolution
reads derived Route geometry only and never mutates a Route or Net. An
unresolved anchor (deleted Route/object, removed segment, non-orthogonal
segment) preserves a last-known `fallbackPosition`, renders as a visible
warning, and offers re-attach / convert-to-free / delete. It never silently
re-attaches to another conductor.

```typescript
type DraftingObject =
  | DraftText | DraftArrow | DraftLeader | DraftCallout
  | DraftConstructionLine | DraftFloatingSymbol;

interface Guide {
  id: StableId;
  axis: "horizontal" | "vertical";
  coordinate: number;
  locked: boolean;
  visible: boolean;
}
```

All drafting members share `id`, `locked`, `zIndex`, optional `styleOverride`,
and a bounded `VisualAnchor`. A `DraftFloatingSymbol.symbolId` may reference
only Symbol Catalog entries marked `decorative: true`, whose definitions
contain no terminal; a floating symbol never creates a Pin, Net, flightline,
Junction, or SPICE instance. Style overrides are limited to `sizeScale`,
`weight`, `italic`, `lineStyle`, `arrowHead`; no per-object arbitrary SVG/CSS.

Visual stacking is fixed: Guide (editor only) -> electrical Route/Junction ->
Symbol -> SchematicAnnotation -> draft line/arrow -> draft text/callout ->
selection handles. `zIndex` orders only within one DraftingObject kind.

An Instance placement is either `null` or a position plus rotation
`0|90|180|270` and mirror `none|x`. Mirror `x` negates the local x-coordinate
before rotation. Route waypoints exclude endpoints; endpoint coordinates are
derived from terminals, ports, or Junction objects.

## Invariants

- IDs are immutable after creation and unique within a Document object graph.
- Imported IDs may be deterministically derived; new IDs use a prefixed UUID.
- Net terminals reference existing instances and preserve pin names.
- Net ports reference existing ports.
- Routes and their Junction endpoints belong to the same explicit net.
- Route segment mode count equals waypoint count plus one.
- A geometric crossing creates no connectivity.
- A connected branch requires an explicit endpoint or Junction object.
- `placement: null` preserves an unplaced logical instance.
- Layout intent and annotation placement never modify logical connectivity.
- Annotation attachments reference an existing visual/electrical object.
- Layout groups and constraints contain unique existing object IDs.
- A layout constraint targets at least two objects.
- Drafting objects, guides, and non-`route-marker` annotations never create or
  modify a Net, Route, Junction, flightline, Pin, or SPICE instance.
- A `route-marker` or drafting `VisualAnchor` of kind `route`/`object` references
  an existing Route/object; an unresolved anchor keeps `fallbackPosition` and a
  warning state rather than silently re-attaching.
- A `DraftFloatingSymbol.symbolId` references only a `decorative: true` catalog
  entry whose definition has no terminal.
- A Guide is always `export: false`; it never appears in formal SVG/PNG/PDF.

## Operations and state transitions

Only the Edit Engine may commit a new Document revision. GUI preview, viewport,
selection, hover, and wire draft state do not mutate this model.

## Persistence boundary

Every field in `SchematicDocumentSchema` is persisted. Pin page coordinates,
spatial indexes, routed components, flightlines, diagnostics, and SVG scenes
are derived and absent from the schema.

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
migrates to `route-marker/current` with its Route attachment preserved;
`voltage` becomes `route-marker/voltage` when a reliable Route/object
attachment exists, otherwise free `DraftText` with a review prompt. The
migration does not change Net/Route/Junction/instance and does not rewrite
original SPICE; the electrical topology hash is unchanged. Write-back never
regenerates the old `plain-text` shape.

## Deterministic validation

- schema reference and uniqueness tests
- integer transform round-trip tests
- route/Junction invariant tests
- persisted-field and unknown-field rejection tests

## Open decisions

- Additional constraint parameters may extend a later schema version without
  changing the electrical truth boundary.
