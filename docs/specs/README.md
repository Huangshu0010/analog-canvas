# Normative Specifications

Specifications define stable contracts that multiple modules implement
against. They describe required behavior and invariants, not task history.

## Planned Specifications

| Specification                                                |  Owning phase | Initial status           | Covers                                                                                   |
| ------------------------------------------------------------ | ------------: | ------------------------ | ---------------------------------------------------------------------------------------- |
| [`project-file-format.md`](project-file-format.md)           |             0 | accepted                 | Project JSON, source manifest, symbol lock, canonical save/load                          |
| [`schematic-model.md`](schematic-model.md)                   |             0 | accepted                 | Document, instance, net, route, junction, annotation, presentation                       |
| [`edit-engine.md`](edit-engine.md)                           |           0/1 | accepted envelope        | Typed edits, transactions, revision, undo/redo, atomicity                                |
| [`circuit-ir.md`](circuit-ir.md)                             |           0/2 | accepted boundary        | Transient dialect-neutral import boundary                                                |
| [`symbol-dsl.md`](symbol-dsl.md)                             |           0/1 | accepted boundary        | Geometry, electrical/visual pins, variants, validation                                   |
| [`spice-frontend.md`](spice-frontend.md)                     |           2/4 | accepted current profile | Lossless syntax, dialects, includes, expressions, elaboration                            |
| [`connectivity-and-routing.md`](connectivity-and-routing.md) |             3 | accepted                 | Route graph, junction, crossing, flightline, locks                                       |
| [`visual-language.md`](visual-language.md)                   |           1/5 | accepted initial         | `textbook-monochrome-v1`, annotations, overlays, golden output                           |
| [`razavi-visual-contract.md`](razavi-visual-contract.md)     |        RV-1/8 | accepted                 | Razavi authority, construction, interface-symbol semantics, exposure, and pixel fidelity |
| [`agent-api.md`](agent-api.md)                               |           6/9 | accepted                 | v1 query compatibility; v2 Snapshot, typed edits, render, permissions                    |
| [`persistence-and-recovery.md`](persistence-and-recovery.md) |           0/7 | accepted boundary        | Atomic save, AppData cache/session/recovery, migrations                                  |
| [`export.md`](export.md)                                     |             7 | accepted                 | Formal SVG source and derived PNG/PDF contracts                                          |
| [`netlist-export.md`](netlist-export.md)                     | Netlist WP0/6 | accepted                 | Deterministic structural SPICE/Spectre export and diagnostics                            |
| [`performance.md`](performance.md)                           |             7 | accepted                 | Representative workloads and release budgets                                             |
| [`editor-interaction.md`](editor-interaction.md)             |             8 | accepted                 | Direct manipulation, manual authoring, gestures, and automation boundary                 |
| [`web-agent-session.md`](web-agent-session.md)               |     Web Agent | accepted                 | Browser-authoritative relay: scopes, transport, events, errors, threat                   |
| [`community-gallery.md`](community-gallery.md)               | Gallery G1–G2 | accepted                 | Public feed, publishing gate, accounts/sessions, admin bin, re-serialization             |

Create a specification when its owning phase begins; do not create empty files
only to mirror this table. Start from [`spec.template.md`](spec.template.md).

## Specification Rules

- State status, version, owners, consumers, and related ADRs.
- Define invariants and failure behavior, not only successful examples.
- Include at least one valid example and one rejected example.
- Distinguish persisted data, transient data, and derived data.
- Name deterministic validation that demonstrates the contract.
- Changes after acceptance require compatibility analysis and, when
  architectural, an ADR.
