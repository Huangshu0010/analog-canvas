# 0034 - Top-Cell Formal Ports and Free-Port Export

Status: `accepted`

Date: `2026-08-21`

Owners: `packages/netlist`, `apps/editor`

Supersedes the top-Document Port-role restriction in
[ADR 0033](0033-port-semantic-name-and-richtext-presentation.md) and the
top-level ordinary-Port clause in the editor interaction contract.

## Context

Schema 18 separated a Port's semantic role into `Free Net Port` and `Formal
Cell Pin`, but exposed the formal role only in child Documents. The top
Document is also emitted as a structural `.subckt`, so that restriction made a
normal top interface impossible to author. A Free Net Port correctly owned a
`Net.name`, yet deterministic netlist extraction still sent its Port symbol
through device lookup and blocked on `MISSING_DEVICE_DEFINITION`.

Formal terminal names already own exported Cell-header tokens. Anonymous-Net
allocation nevertheless ran before that projection and could warn that a
formal-terminal Net would export under an `N####` name that was never actually
emitted.

## Decision

Every Document, including `topDocumentId`, offers both explicit Port roles:

- **Formal Cell Pin** creates one Port Instance, pin-`P` Net membership,
  ordered `CellTerminal`, and terminal-name annotation in one Project
  transaction. It contributes a `.subckt` interface token and emits no
  instance line.
- **Free Net Port** creates one Port Instance, pin-`P` Net membership, and
  Net-name annotation. It names or joins a Net but does not create a formal
  interface and emits no instance line.

Netlist extraction validates that a reachable Free Net Port is attached to an
exportable Net, then omits the marker. Formal terminal names are assigned
before anonymous local-Net generation, so their Nets produce neither a
generated name nor a `GENERATED_NET_NAME` warning.

The two roles remain explicit. The editor does not infer formal-interface
intent from hierarchy position, symbol artwork, or a matching string. Plain
text remains non-electrical.

## Consequences

- A user can author and round-trip `.subckt Main INP INN OUT` directly in the
  top Document.
- Free Net Ports behave like electrical wire-name markers instead of
  unsupported devices.
- Port marker geometry never creates a SPICE/Spectre instance.
- A free Net name and a formal terminal name may still differ intentionally;
  only the terminal owns the Cell-header token.

## Validation

- netlist contract tests cover unnamed formal-terminal Nets, connected Free
  Net Port omission, and unconnected Free Net Port rejection;
- browser tests cover top Formal Cell Pin authoring/preflight and Free Net Port
  preflight without device-definition errors.

## Related documents

- [ADR 0033](0033-port-semantic-name-and-richtext-presentation.md)
- [Editor interaction](../specs/editor-interaction.md)
- [Deterministic netlist export](../specs/netlist-export.md)
