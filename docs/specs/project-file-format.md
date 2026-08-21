# Project File Format

Status: `accepted`

Current Project schema: `18`

Primary owners: `packages/model` (current shape) and
`packages/project-protocol` (file boundary)

An `.icproj.json` file is canonical JSON for one complete `CircuitProject`.
`@icm/project-protocol` exposes `parseProject` and accepts Project schema 18
and schema 17. Schema 17 advances directly to 18 by converting ordinary
default designator projections to RichText schematic-label projections and
removing the redundant schematic Reference/designator projection from formal
Cell Ports. Every reader returns the sole schema-18 in-memory Project shape;
schema 16 and older and all future versions are
rejected. There is no sequential migration registry or second in-memory Project
shape.

## Current authorities

- `Document.netlist.terminals` defines the ordered formal Cell interface with
  stable identity, direction, Net binding, and an ordinary Port Instance.
- `Document.netlist.formalParameters` and project-level
  `externalSubcircuitDefinitions` define exact nonlocal netlist interfaces.
  Each external definition has a stable identity, an ordered list of stable
  terminals, raw formal defaults, interface status and optional block
  presentation. It has no internal Document body.
- `Instance.schematicReference` is the canvas-facing Reference for non-formal
  Instances. A formal Cell Port instead uses its `CellTerminal.name` as its
  sole visible identifier. `Instance.netlist` contains the separate emitted reference,
  binding, and typed parameter values for emitting Instances. Import source
  order and symbol-mapping registry identity live in
  `Instance.importProvenance`; there is no persisted property bag.
- Hierarchy is an acyclic graph of ordinary Instances whose typed subcircuit
  bindings resolve to child Documents; orphan Cell definitions are allowed.
- Canvas `port` and `port-filled` objects are ordinary Instances with terminal
  `P`; their connectivity is stored only in `Net.terminals` and ordinary
  terminal Route endpoints.
- `Net.terminals` is the electrical membership authority.
- Route endpoints are terminal or Junction references only.
- `Net.powerDomain` explicitly records `none`, `vdd`, `ground`, or diagnostic
  `conflict`; canonical authoring verifies this persisted role after matching
  an explicit global Net by normalized name, never by symbol or fixed ID.
- VDD uses an explicit global Net, Route/Junction rail geometry, and RichText
  annotation. There is no VDD symbol Instance.
- Every visible editable label is a RichText annotation. Its binding separates
  `instance-designator`, `instance-schematic-name`, `instance-master-name`,
  `instance-value`, and `cell-terminal-name`. The default ordinary label is
  `instance-schematic-name`: it reads RichText `schematicName`, then falls
  back to the internal `schematicReference` or `netlist.reference`.
  `instance-designator` is optional read-only network-ID display. Renderers
  never synthesize instance text from an internal ID.
- `Document.presentation.cellSymbol` is optional definition-level block intent:
  a minimum body size and stable formal-terminal side/offset placements.
  Symbol geometry remains derived and caller Instances never persist a copy.
- MOS assets are canonical `nmos`/`pmos`; visual variant selection does not
  change persisted terminal connectivity.

## Read and write

```text
read text -> parse JSON -> require Project schema 17 or 18
-> direct v17-to-v18 upgrade when needed -> strict schema-18 validation -> open
save -> strict validation -> canonical key ordering -> atomic write
```

An invalid candidate never replaces the current browser Project. File Resource
staging is non-mutating; a staged Project can replace the live Project only
after explicit human approval in the editor.

A migrated formal file is marked as needing save. The editor does not silently
overwrite the source selected through the browser file input. Browser recovery
records may be canonicalized to v18 only after a successful validated write.

Project entry does not repair duplicate canonical supply Nets (`0` or `VDD`).
Duplicate folded Net names are invalid input and remain a blocking diagnostic
until the author explicitly renames or merges the Nets.

Canonical serialization ends with one newline and is byte-stable across
save/load/save. The current corpus is listed in
`fixtures/projects/compatibility-corpus.json`; its accepted entries must all be
already canonical Project schema 18. The rejected corpus names expected
validation failures.

Viewport, selection, undo history, canvas overlays, Agent credentials,
recovery envelopes, generated renders, and derived diagnostics are not part of
the Project file.
