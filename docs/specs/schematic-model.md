# Schematic Model

Status: `accepted`

Primary owner: `packages/model`

The Project contains Documents; each Document owns revisioned electrical,
geometric, and presentation facts. The current model is strict schema 9 and has
no compatibility shape.

## Electrical authority

- `Instance` selects one exact canonical symbol and optional visual variant.
- `Net.terminals` is complete logical membership. A terminal is
  `{instanceId, pinName}` and belongs to at most one Net.
- `Route` owns editable geometry for one Net and connects terminal or Junction
  endpoints only.
- `Junction` owns explicit branch/anchor geometry.
- `NoConnect` targets one terminal only and cannot overlap Net membership.
- `Document.netlist.terminals` is a private ordered mapping from formal
  cell-terminal names to Net IDs for structural export.

There is no first-class Port collection or Port endpoint. `port` and
`port-filled` are ordinary single-pin Instances with pin `P`; their electrical
membership is represented exactly like any other component terminal.

`Net.powerDomain` is persisted explicitly. VDD consists of a global VDD Net,
editable Route/Junction rail geometry, and a power-label annotation. Ground is
an ordinary `ground` Instance attached through pin `0`. No runtime path infers
supply identity from names, IDs, labels, or retired assets.

Canonical MOS Instances use `nmos`/`pmos` with D/G/S/B electrical pins. The
default `textbook-3terminal` variant is presentation-only. B membership is
explicit first, then materialized from a configured cell-default Net, then
from the current supply default. The supply default reuses a matching global
ground/VDD Net or creates canonical `net-global-0`/`net-global-vdd`; its
persisted `mosBulkBinding` records `supply-default`. Imported/source-bound MOS
instances with missing fourth-node evidence remain unresolved.

A visible `bulk-dashed` route is an explicit override. The override atomically
removes the implicit cell/supply binding before connecting B to the selected
body-bias Net, so the default never remains as a hidden parallel connection.

## Presentation authority

Every visible editable label is a `SchematicAnnotation` with bounded RichText
`content` and one `VisualAnchor`. Anchors are free, object-relative, or
route-relative and include a deterministic fallback position for dangling
visual references. Renderers never derive visible instance text from IDs or
properties. Drafting objects are visual-only and cannot create connectivity.

## Core invariants

- IDs are unique within their object class and every reference resolves.
- A Route's Net agrees with both endpoints and its segment count agrees with
  its waypoints.
- Net membership and NoConnect are mutually exclusive.
- Layout groups and constraints reference existing objects.
- Netlist interfaces reference existing Nets with unique ordered names.
- Imported netlist facts and provenance are typed; retired `spice.*`
  properties are invalid.
- `electricalTopologyHash` includes Instances, Nets, terminal membership,
  Routes, Junctions, NoConnects, and formal cell terminals, but excludes
  placement, annotation, and drafting presentation.

Mutation occurs only through atomic Edit Engine transactions against an exact
Document revision. GUI and Agent writes use the same schema and invariants.
Persistence accepts and writes only schema 9; no migration is performed.
