# Normative Specifications

Specifications define stable contracts that multiple modules implement
against. They describe required behavior and invariants, not task history.

## Planned Specifications

| Specification | Owning phase | Initial status | Covers |
|---|---:|---|---|
| [`project-file-format.md`](project-file-format.md) | 0 | accepted | Project JSON, source manifest, symbol lock, canonical save/load |
| [`schematic-model.md`](schematic-model.md) | 0 | accepted | Document, instance, net, route, junction, annotation, presentation |
| [`edit-engine.md`](edit-engine.md) | 0/1 | accepted envelope | Typed edits, transactions, revision, undo/redo, atomicity |
| [`circuit-ir.md`](circuit-ir.md) | 0/2 | accepted boundary | Transient dialect-neutral import boundary |
| [`symbol-dsl.md`](symbol-dsl.md) | 0/1 | accepted boundary | Geometry, electrical/visual pins, variants, validation |
| `spice-frontend.md` | 2/4 | proposed | Lossless syntax, dialects, includes, expressions, elaboration |
| `connectivity-and-routing.md` | 3 | proposed | Route graph, junction, crossing, flightline, locks |
| `visual-language.md` | 1/5 | proposed | `textbook-monochrome-v1`, annotations, overlays, golden output |
| `agent-api.md` | 6 | proposed | `capabilities/query/transact/render`, permissions, limits |
| [`persistence-and-recovery.md`](persistence-and-recovery.md) | 0/7 | accepted boundary | Atomic save, AppData cache/session/recovery, migrations |

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
