# ADR 0043: Cell Pin Contract Convergence

Status: accepted

Date: 2026-08-25

Owners: `packages/model`, `packages/edit-engine`, `apps/editor`,
`packages/netlist`, `packages/project-protocol`

## Context

The same Port artwork had accumulated three meanings: a free Net marker, a
formal Cell interface, and one of several repeated views of a formal terminal.
That split duplicated naming, placement, deletion, clipboard, export, and
Agent behavior. It also made a visible Port ambiguous: its appearance did not
say whether it changed the `.subckt` interface.

## Decision

`port` and `port-filled` are hollow and filled visual variants of one electrical
object: **Cell Pin**. Every such Instance owns exactly one ordered
`CellNetlistTerminal`, and every terminal owns exactly one marker through
`interfaceInstanceId`. Its `CellTerminal.name` is the only interface name and
the only name emitted in the `.subckt` terminal list.

Net Label remains the sole local Net-naming marker. VDD and Ground remain
global Net markers. Power Rail remains a drawing gesture over the same power
marker semantics. None of these objects is a Cell Pin unless the user places a
Cell Pin and explicitly names it `VDD`, `0`, or another interface name.

The `P` shortcut, Library, full Insert, snap/contact placement, label editing,
direction editing, copy, move, and delete all use the Cell-Pin planner. Copying
a standalone Pin creates a uniquely named Pin and Base Net. Deleting a Pin is a
Project transaction: child and caller wire endpoints are first detached to
Junctions, the interface is removed, caller symbols are reconciled, and the
whole operation remains undoable.

Schema 24 removes the free-Port Evidence owner and repeated-marker array.
Schema 23 is the only accepted previous version; it migrates only an
unambiguous one-marker formal terminal. Retired free Ports are rejected rather
than retained behind an adapter.

## Consequences

- A Port glyph has one visible and electrical meaning.
- Net naming and Cell interfaces no longer share an editing protocol.
- SPICE import/export, hierarchy, GUI, clipboard, and Agent structure edits
  consume the same ordered interface contract.
- Repeated visual names on an internal Net use Net Labels; repeated formal
  interface names are invalid.
- Existing schema-22 and older Projects require an external conversion.

## Supersedes

- [ADR 0033](0033-port-semantic-name-and-richtext-presentation.md)
- [ADR 0034](0034-top-cell-formal-port-and-free-port-export.md)
- [ADR 0037](0037-repeated-formal-port-markers.md)
- The Free-Port portions of [ADR 0040](0040-connectivity-evidence.md)

## Validation

- strict schema tests cover the one-to-one marker invariant;
- hierarchy tests cover automatic caller detachment and reconciliation;
- clipboard tests cover independent Cell-Pin identity and preview validity;
- netlist tests cover ordered interface emission and non-emitting artwork;
- browser tests cover `P`, placement, rename, direction, delete, and export.
