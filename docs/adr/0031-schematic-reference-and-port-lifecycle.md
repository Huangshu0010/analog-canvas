# 0031 - Schematic reference and unified Port lifecycle

Status: `accepted`

Date: `2026-08-21`

Owners: `packages/model`, `packages/project-protocol`,
`packages/edit-engine`, `packages/derived`, `apps/editor`

Supersedes the identity and formal-Port display clauses of
[ADR 0030](0030-instance-identity-and-placement-lifecycle.md).

## Context

Schema 16 correctly separated netlist designators from aliases, but its visible
`instance-designator` still resolved only from `Instance.netlist.reference`.
Ports do not emit SPICE/Spectre instance lines, so they had no Reference label.
Formal Cell Ports were additionally excluded from the editor's return-to-tray
controls even though their stable interface mapping does not depend on canvas
placement.

## Decision

Project schema 17 adds optional `Instance.schematicReference`. Current writers
populate it for every new Instance. `instance-designator` projects this field,
falling back to the existing netlist reference only for incomplete in-memory
authoring objects. It never projects an internal object ID.

The authorities are distinct:

- `Instance.schematicReference`: editable canvas Reference for every Instance,
  including `P1`/`P2` Ports;
- `Instance.netlist.reference`: emitted SPICE/Spectre instance designator for
  emitting devices and subcircuit calls only;
- `Document.netlist.terminals[].name`: Cell interface name such as `VIN`;
- `Instance.schematicName`: optional presentation alias;
- `Instance.id`: opaque object identity.

A formal Cell Port shows both its schematic Reference and its Cell terminal
name. Returning any Port to the Placement Tray changes only `placement`; it
retains terminal mapping, Net membership, and the exported Cell interface.
Deleting a formal Port remains a Project structural operation.

`place_instance` and `unplace_instance` both reject layout-locked instances.

## Compatibility and migration

The reader accepts schema 16 and schema 17. The direct v16-to-v17 migration
copies an emitting netlist reference into `schematicReference`; it assigns
deterministic prefix-based references to non-emitting instances, including
`P#` for Ports. Serialization emits schema 17 only.

## Consequences

- A Port is no longer special-cased as a nameless canvas object.
- Canvas Reference edits cannot accidentally rename netlist output.
- Formal Port placement has the same retained/placed lifecycle as every other
  Instance, while formal interface edits remain structural.
- Schema 15 is outside the rolling read window.

## Related documents

- [Project file format](../specs/project-file-format.md)
- [Schematic model](../specs/schematic-model.md)
- [Schematic Edit Engine](../specs/edit-engine.md)
- [ADR 0023](0023-rolling-previous-project-compatibility.md)
- [ADR 0030](0030-instance-identity-and-placement-lifecycle.md)
