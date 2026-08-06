# Phase 3 - Connectivity and Routing

Status: `proposed`

## Objective

Complete the central connectivity-aware editing loop: derived flightlines,
orthogonal Wire, explicit Junction, unconnected crossing, local stretch,
trunks, locks, and detach-to-flightline behavior.

## User-visible outcome

A user imports or opens a circuit, places devices, sees remaining logical
connections, draws explicit routes, creates visible branch dots, crosses lines
without connecting them, moves devices while preserving topology, and removes
routes without deleting nets.

## In scope

- visible connectivity graph and routed components;
- deterministic multi-terminal flightline MST;
- Wire Tool state machine and orthogonal preview;
- RouteBranch endpoints and waypoints;
- segment splitting and explicit Junction creation;
- crossing semantics and ambiguity diagnostics;
- Move `stretch-local`, Stretch, Detach/make-flightline;
- segment modes: auto, escape, manual, locked, trunk;
- route normalization and topology validation;
- GUI and Edit Engine operations for the complete flow.

## Out of scope

- global automatic placement or routing;
- curved wires or crossing bridges;
- buses and multi-page connectors;
- Agent-facing HTTP API;
- final VSS-derived visual polish.

## Dependencies

- Phase 1 and Phase 2 exit gates;
- accepted `connectivity-and-routing.md`, `edit-engine.md`, and
  `schematic-model.md`;
- imported and hand-authored routing fixtures.

## Work packages

### WP-3.1 - Visible connectivity graph

- Goal: derive routed components without inferring connectivity from geometry.
- Main modules: `core/connectivity`, `core/derived`.
- Required specs: `connectivity-and-routing.md`.
- Validation surface: graph component and endpoint tests.

### WP-3.2 - Flightlines

- Goal: compute deterministic MST edges between visible components.
- Main modules: `core/derived/flightlines`, renderer overlay.
- Required specs: flightline section of routing spec.
- Validation surface: stable tie-breaker and multi-terminal golden tests.

### WP-3.3 - Wire, Junction, and crossing

- Goal: implement preview, commit, split, junction dot, and crossing rules.
- Main modules: Wire Tool, `core/edit`, route renderer.
- Required specs: route/Junction invariants.
- Validation surface: T, X-connected, X-crossing, pin, and port scenarios.

### WP-3.4 - Move, Stretch, Detach, and locks

- Goal: preserve manual trunks and topology under local geometric edits.
- Main modules: Move/Stretch Tools, Edit Engine, geometry helpers.
- Required specs: edit and routing specs.
- Validation surface: locked-object rejection and local-stretch golden tests.

## Deliverables

- connectivity graph and flightline derivation;
- Wire, Stretch, Junction, and Detach GUI tools;
- routing typed edits and transaction validation;
- deterministic route and junction renderer;
- topology and visual-ambiguity diagnostics;
- routing integration and Playwright fixtures.

## Acceptance scenarios

```text
Import and place a multi-terminal net
→ see deterministic flightlines
→ route two terminals
→ see remaining component flightlines update
→ route all terminals
→ see flightlines disappear
```

```text
Draw across an existing wire
→ no dot appears
→ nets remain separate
→ explicitly target the segment
→ preview and commit a junction dot
→ route graph updates atomically
```

```text
Detach a routed branch
→ remove visible Route geometry
→ retain logical net membership
→ restore a flightline
```

## Deterministic validation

- graph and MST unit/property tests;
- Route/Junction schema and invariant tests;
- crossing-does-not-connect regression tests;
- locked segment and atomic split transaction tests;
- route SVG golden tests;
- Playwright Wire, Junction, crossing, Move, Stretch, and Detach scenarios.

## Risks and decisions

| Risk or decision | Handling |
|---|---|
| Geometry accidentally becomes connectivity truth | Only explicit endpoints and Junction objects affect the graph |
| Independent branches duplicate segments | Add deterministic per-net route normalization |
| Local move rewrites manual work | Preserve trunk/manual/locked modes and limit stretch scope |
| Flightline order flickers | Stable IDs are mandatory MST tie-breakers |

## Exit gate

- Manual import/place/flightline/wire/junction/crossing/detach closure passes;
- topology does not change from pure geometry crossings or route deletion;
- all derived results are deterministic and absent from saved Project JSON.
