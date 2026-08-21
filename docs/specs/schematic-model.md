# Schematic Model

Status: `accepted`

Primary owner: `packages/model`

The Project contains Documents; each Document owns revisioned electrical,
geometric, and presentation facts. The current model is strict schema 19 and has
no compatibility shape.

## Coordinate domains

ADR 0021 separates persisted grid coordinates from transient and derived
geometry. Every persisted page Point in a Document is a finite integer multiple
of that Document's `presentation.grid`: Instance placements, Junctions, Route
waypoints, persisted VisualAnchor point fields, and drafting points/controls/
centers. This is a complete-Document invariant, not merely an editor snap
preference.

Renderer bounds, rich-text layout, route-relative anchor resolution, curves,
rotated corners, diagnostics, pointer/screen positions, and symbol-local
artwork may use finite floats. They are read-only or transient coordinate
domains and must never be persisted as a Document Point. Parametric scalars
such as route-anchor `t` and normal offset are not page Points.

Project parse accepts no legacy non-grid shape and performs no rounding or
migration. Invalid coordinates are rejected with their data path.

## Electrical authority

- `Instance` selects one exact canonical symbol and optional visual variant.
  `Instance.schematicReference` is its canvas-facing Reference when the
  Instance has one, independent of the optional emitted
  `Instance.netlist.reference`. A free Net Port instead projects `Net.name`; a
  formal Cell Pin projects `CellTerminal.name`. Neither Port role has a visible
  schematic reference.
- `Net.terminals` is complete logical membership. A terminal is
  `{instanceId, pinName}` and belongs to at most one Net.
- `Net.origin` records `authored` or `spice-import` membership provenance. It
  is eligibility for derived import routing guidance, not a second electrical
  or visible-connectivity protocol.
- `Route` owns editable geometry for one Net and connects terminal or Junction
  endpoints only.
- `Junction` owns explicit branch/anchor geometry.
- `NoConnect` targets one terminal only and cannot overlap Net membership.
- `Document.netlist.terminals` is the ordered formal Cell interface. Each
  terminal has a stable ID, name, direction, Net ID, and an
  `interfaceInstanceId` that points to its ordinary canvas Port Instance.

Canvas interface markers `port` and `port-filled` are ordinary single-pin
Instances with pin `P`; their electrical membership and Route endpoints are
represented exactly like every other component terminal. The model has no
separate canvas Port collection or Port-specific Net membership.

`Net.powerDomain` is persisted explicitly. VDD consists of a global VDD Net,
editable Route/Junction rail geometry, and a power-label annotation. Ground is
an ordinary `ground` Instance attached through pin `0`. Supply role is never
inferred from a marker, label, or fixed ID; canonical authoring selects an
explicit global Net by normalized name and then verifies its persisted role.

`powerDomain` is role metadata, not Net identity: `AVDD` and `DVDD` may both
have role `vdd` while remaining distinct Nets. Net names are unique within one
Document under trimmed case-folding; a named global Net is an explicit semantic
connection even when its marker geometry is separate. Canonical Ground and VDD
attachment reuses a matching global Net by normalized name (`0` or `VDD`) and
then checks its role; it never chooses the first Net with a matching role.
Changing between non-`none` power roles is rejected atomically. The authored
Net spelling remains persisted; normalized comparison is derived only.

High-level naming starts from an existing candidate Net. An unused name changes
that Net's authored name; a matching folded name emits an explicit compatible
Net merge through the Edit Engine, choosing the stable lowest Net ID. Raw
`set_net_name` remains deliberately strict and rejects an ambiguous rename.

The editor does not silently normalize a loaded Document from `powerDomain`
metadata or coalesce duplicate canonical supply Nets. A duplicate folded name
is invalid input and remains a shared diagnostic for the author to resolve with
an explicit rename or merge.

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
visual references. While an anchor resolves, its resolved position is the one
text baseline used by rendering, editor hit/marquee geometry, export bounds,
and visual diagnostics; `fallbackPosition` is used only for a dangling target.
`instance-schematic-name` resolves RichText `schematicName` and only then the
internal schematic/netlist reference; `instance-designator` resolves an
optional, read-only network ID. `net-name` and `cell-terminal-name` resolve
their semantic source and may use a same-text Annotation RichText
`formatOverride`; `instance-master-name` and `instance-value` resolve their own
source. Renderers never derive visible
instance text from IDs or copied properties. Drafting objects are visual-only
and cannot create connectivity.

A Cell definition may additionally persist optional `presentation.cellSymbol`
intent: a symbol-local minimum body size and unique `terminalId`-keyed visual
side/offset placement. It is not electrical terminal data, parent-instance
geometry, or persisted artwork. The Symbol resolver derives the block and all
pin anchors. Each placement must reference one existing formal terminal and no
two explicit placements may occupy the same side/offset slot.

## Core invariants

- IDs are unique within their object class and every reference resolves.
- A Route's Net agrees with both endpoints and its segment count agrees with
  its waypoints.
- Net membership and NoConnect are mutually exclusive.
- Layout groups and constraints reference existing objects.
- Netlist interfaces reference existing Nets and connected Port Instances with
  unique stable IDs, ordered names, and marker bindings.
- Internal subcircuit bindings reference one child Document; their emitted
  Cell name is derived from that child. External bindings reference one
  project-level external definition, and unresolved imported bindings retain
  only a target name until resolution.
- Netlist references and parameter values live in `Instance.netlist`.
  Parameters are defined only by the matching Device Descriptor: every field
  declares its key, requiredness, editor kind, optional unit/example/help, and
  display role. Insert, Properties, validation, Value projection, and export
  consume that definition; UI adapters do not maintain a second parameter
  registry.
  Imported terminal order and symbol-mapping identity live only in typed
  `Instance.importProvenance`; `Instance.properties` does not persist.
- `electricalTopologyHash` includes Instances, Nets, terminal membership,
  Routes, Junctions, NoConnects, and formal cell terminals, but excludes
  placement, annotation, and drafting presentation.

An Instance has three lifecycle states: retained in the Placement Tray
(`placement: null`), placed (`placement` present), or deleted (absent). Returning
to the Tray retains every electrical, netlist, and object-anchored annotation
fact, but retained-instance annotations are not rendered or hit-testable until
the Instance is re-placed. Any visible Route endpoint is first detached to a
Junction at the resolved pin position. Deletion is a separate atomic composition
that clears membership, NoConnect, owned annotation, and unlocked layout
references before removing the Instance.

Mutation occurs only through atomic Edit Engine transactions against an exact
Document revision. GUI and Agent writes use the same schema and invariants.
Formal-interface edits and add/remove Document operations are composed with
ordinary Schematic edits inside one Project structural transaction. The
Project's `structureRevision` protects this cross-Document boundary and the
editor records it as one undoable structural commit.

Persistence writes only schema 19. `packages/project-protocol` accepts schema
18 through the bounded direct upgrade defined by ADR 0034, then supplies the
current model only; no compatibility shape enters `packages/model`.
