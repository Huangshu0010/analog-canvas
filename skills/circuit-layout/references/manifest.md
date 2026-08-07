# Circuit-layout knowledge manifest

Compatibility: Agent API `2.0`; Snapshot `1.0`.

Canonical knowledge lives in `docs/agent/knowledge/` so product documentation
and the Agent use one source. Resolve the paths below from this repository.

| Signal in the task or Snapshot                                    | Read                                                                                     |
| ----------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| Unfamiliar circuit, uncertain topology, or 100+ devices           | [`circuit-reading.md`](../../../docs/agent/knowledge/circuit-reading.md)                 |
| Placement, hierarchy presentation, labels, or visual organization | [`schematic-expression.md`](../../../docs/agent/knowledge/schematic-expression.md)       |
| Routes, crossings, Junctions, flightlines, or visual diagnostics  | [`routing-and-diagnostics.md`](../../../docs/agent/knowledge/routing-and-diagnostics.md) |
| Placement grid, pin-anchor alignment, label math, or fixed-style tokens | [`razavi-style-canon.md`](../../../docs/agent/knowledge/razavi-style-canon.md) |
| Hierarchy, shared children, or roughly 100+ devices               | [`hierarchy-and-large-circuits.md`](../../../docs/agent/knowledge/hierarchy-and-large-circuits.md) |
| Generic/model-backed symbols or PDK pin uncertainty               | [`pdk-and-symbols.md`](../../../docs/agent/knowledge/pdk-and-symbols.md)                 |
| Existing human work, locks, stale revisions, or handoff           | [`human-collaboration.md`](../../../docs/agent/knowledge/human-collaboration.md)         |
| Shared source/emitter and paired input evidence                   | [`differential-pair.md`](../../../docs/agent/knowledge/patterns/differential-pair.md)    |
| Shared control and reference/output branch evidence               | [`current-mirror.md`](../../../docs/agent/knowledge/patterns/current-mirror.md)          |
| Repeated weighted or serial passive/switch branches               | [`arrays-and-ladders.md`](../../../docs/agent/knowledge/patterns/arrays-and-ladders.md)  |
| Clocked switches, sampling, alternate references, or bit branches | [`switching-and-sampling.md`](../../../docs/agent/knowledge/patterns/switching-and-sampling.md) |

Do not load every card speculatively. A card may guide interpretation and
expression, but it never changes the electrical facts in the Snapshot.
