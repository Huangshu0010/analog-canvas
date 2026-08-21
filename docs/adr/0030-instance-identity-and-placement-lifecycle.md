# 0030 - Instance identity and placement lifecycle

Status: `accepted`

Date: `2026-08-21`

Owners: `packages/model`, `packages/project-protocol`,
`packages/edit-engine`, `packages/derived`, `apps/editor`

## Context

The structural netlist loop made imported Instances electrically complete, but
the editor still used one ambiguous `instance-reference` label binding. It
rendered a schematic alias when present, otherwise a netlist reference, and
finally an internal object ID. Formal Ports have no netlist reference, so that
fallback exposed generated IDs. Imported Instances also begin with
`placement: null`, yet the mutation protocol described only placement and
deletion rather than an explicit return-to-tray lifecycle.

These ambiguities make Reference editing, imported external calls, default
labels, bulk placement, and delete behavior unsafe to extend independently.

## Decision

Project schema 16 separates persisted semantic label bindings. The sole
**schema-16 in-memory Project shape** has:

- `instance-designator` projects only `Instance.netlist.reference`;
- `instance-schematic-name` projects only `Instance.schematicName`;
- `instance-master-name` projects the binding's authoritative master/Cell/model
  name;
- `instance-value` and `cell-terminal-name` retain their existing distinct
  authorities.

`Instance.id` remains an opaque stable object identity. It is never a default
visible label or a fallback netlist reference. Formal Cell Ports display their
formal terminal name and never receive a fabricated reference.

The lifecycle has exactly three persisted states:

```text
instance exists + placement: null       = retained in the Placement Tray
instance exists + placement: Placement  = placed on the canvas
instance absent                         = deleted from the design
```

The Edit Engine gains `unplace_instance` alongside existing placement and
removal operations. Returning an Instance retains its binding, reference,
parameters, terminal membership, NoConnect records, and display annotations;
visible Route endpoints are safely detached to Junctions. Deletion composes
that route reconciliation with explicit removal of memberships, NoConnects,
and annotations before `remove_instance`.

Placement, movement, returning to the tray, and automatic initial positioning
are presentation actions: they must not change DesignNetlistIR or structural
SPICE/Spectre output. Reference, parameter, connectivity, and deletion edits
remain electrical changes.

## Alternatives considered

### Keep `instance-reference` and improve the fallback

- Benefits: avoids a schema change.
- Costs: one label still has three contradictory meanings and formal Ports
  remain vulnerable to internal-ID display.
- Reason not selected: no fallback can make an ambiguous source authoritative.

### Add a persisted trash collection and separate bulk edit kinds

- Benefits: richer lifecycle history and direct UI-to-edit mapping.
- Costs: duplicates existing undo history and expands the Project mutation
  surface without electrical benefit.
- Reason not selected: `placement: null` and atomic compositions already model
  the required states.

### Add full analog-recognition auto-layout and automatic routing

- Benefits: could produce more polished diagrams.
- Costs: guesses circuit intent and confuses imported electrical topology with
  drawing geometry.
- Reason not selected: this decision requires only deterministic initial
  placement and explicit unrouted-connection guidance.

## Consequences

### Positive

- Netlist designators, schematic aliases, master names, and formal port names
  can be edited and displayed independently.
- Imported external calls become legible without fabricating PDK or simulator
  semantics.
- The Placement Tray and delete UI can share one explicit lifecycle boundary.
- Presentation-only operations obtain a testable netlist-invariance contract.

### Negative or limiting

- Schema 16 consumes the rolling migration slot and replaces the old v14-to-v15
  reader.
- Existing reference labels migrate according to their prior rendered value;
  projects older than schema 15 are no longer supported at this boundary.
- Persistent trash, auto-routing, PDK setup, simulation and layout remain out
  of scope.

## Compatibility and migration

The reader accepts schema 15 and schema 16 only. A direct v15-to-v16 adapter
maps every `instance-reference` binding to `instance-schematic-name` when its
target Instance has a schematic alias, otherwise to `instance-designator`.
That rule preserves the actual schema-15 projection while yielding one strict
schema-16 runtime model. Serialization emits schema 16 only.

## Validation

- schema parse/save and direct migration tests;
- designator/alias/port text-projection tests;
- lifecycle transaction tests including Route, Net, NoConnect and annotation
  reconciliation;
- editor browser tests for tray, bulk placement, reference editing, deletion,
  undo, and structural netlist invariance.

## Related documents

- [Project file format](../specs/project-file-format.md)
- [Schematic model](../specs/schematic-model.md)
- [Schematic Edit Engine](../specs/edit-engine.md)
- [ADR 0023](0023-rolling-previous-project-compatibility.md)
- [ADR 0027](0027-stage-1-netlist-authoring-protocol.md)
- [ADR 0029](0029-external-subcircuit-definition-protocol.md)
