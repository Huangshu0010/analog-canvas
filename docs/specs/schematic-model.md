# Schematic Model

Status: `accepted`

Version: `1.0`

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
groups, and layout constraints. Coordinates are signed integers in grid units.

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

## Deterministic validation

- schema reference and uniqueness tests
- integer transform round-trip tests
- route/Junction invariant tests
- persisted-field and unknown-field rejection tests

## Open decisions

- Annotation and layout-constraint variants expand in Phase 5 without changing
  the electrical truth boundary.
