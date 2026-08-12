---
status: completed
experience: none
---

# WP-R2 — Additive Project Connectivity Index

## Goal

Implement the unified read-only `ProjectConnectivityIndex` (ADR 0013) additively
in `packages/derived`, with an adapter that proves flightline/component parity
against the existing `deriveFlightlines` / `deriveVisibleConnectivity`, modulo
the one accepted normalization (partition-invariant flightline id/direction,
which resolves the WP-R0 finding). No production consumer switches this target
— the index coexists with the old helpers; the switch is later (R10).

This is the strangler step: the index is initially a unified facade over the
existing tested `derive*` primitives, plus the normalization, typed virtual
edges, hierarchy edges, and a project object index. It is the single future
entry point for flightline, net highlight, trace, search, and ERC.

## State and Ownership

```text
## roadmap/connectivity-routing-debugging
(clean — R0 40f5d3e, R1 2d81062 committed)
```

Owned paths:

- `packages/derived/src/connectivity-index.ts` (NEW)
- `packages/derived/src/connectivity-index.test.ts` (NEW)
- `packages/derived/src/index.ts` (re-export the new module)
- `plan/2026-08-12-wp-r2-connectivity-index/plan.md` (this file)
- `plan/log.md` (entry)

Read-only: `packages/derived/src/connectivity.ts`, `endpoint.ts`, `routes.ts`
(consumed, not modified). No consumer (`render-svg`, `edit-engine`, editor,
`agent-routing`) is modified — the index is additive and unused in production
until R10.

Shared/contract: the new types match ADR 0013/0015 exactly; the flightline
normalization is the ADR 0013-accepted change.

## Work

1. `connectivity-index.ts`:
   - Frozen types: `ProjectConnectivityIndex`, `DocumentConnectivityIndex`,
     `NetConnectivityRecord`, `VirtualConnectivityEdge`, `HierarchyEdge`,
     `HierarchyConnectivityIndex`, `ObjectLocator`, `ProjectObjectIndex`,
     `EndpointRef`.
   - `buildProjectConnectivityIndex(project, resolver)`:
     - per document: `endpointToNet`, and per net a `NetConnectivityRecord`
       (`logicalEndpoints` = terminals+ports; `visibleEndpoints` =
       `netEndpoints` filtered by `isVisibleEndpoint`; `routedComponents` from
       `deriveNetConnectivity`; `routes`/`junctions` ids; `virtualEdges` from
       net-label/power-label annotation groups; `flightlines` = existing
       `deriveFlightlines` with normalized direction/id).
     - `hierarchy.edges` from `properties["spice.childDocumentId"]` bindings,
       mapping each parent hierarchical-symbol pin (by name) to the matching
       child Document port.
     - `objectIndex.resolve(documentId, objectId)` → `ObjectLocator` for
       document/instance/net/route/junction/port/terminal/annotation.
   - Flightline normalization: order `from`/`to` by `endpointKey` and recompute
     `id = deriveStableId("flightline", netId, fromKey, toKey)`, so the id is
     symmetric and partition-invariant (the R0 case now yields one stable id).
2. `index.ts`: re-export the new module.
3. `connectivity-index.test.ts`:
   - Parity: for each repo project fixture, the index flightlines match
     `deriveFlightlines` on endpoint-set + distance + points (content equal).
   - Normalization: the R0 partition case yields a single partition-invariant
     flightline id for both single-Route and split-Route storage.
   - Virtual edges: a same-net label pair produces typed `VirtualConnectivityEdge`
     records and merges components (parity with `deriveNetConnectivity`).
   - Hierarchy: a parent instance with `spice.childDocumentId` produces a
     `HierarchyEdge` per parent pin → child port.
   - objectIndex: resolves a known instance/net/route/junction to a locator;
     unknown returns undefined.
   - Persistence negative: the index is not part of serialized Project JSON
     (it is not persisted; verified by shape, not serialization).

## Validation

- `pnpm typecheck`
- `pnpm exec vitest run packages/derived/src/` (existing 76 + new tests pass)
- `pnpm format:check` (the new `.ts` files are in the gate glob)
- `git diff --check`

Scope rationale: additive module in one package; the derived vitest suite plus
workspace typecheck and the format gate cover behavior, types, and contract
integrity.

## Commit Intent

```text
feat(derived): add ProjectConnectivityIndex with flightline normalization (WP-R2)
```

## Outcome

Implemented the additive `ProjectConnectivityIndex` (ADR 0013) as a unified
facade over the existing tested `derive*` primitives, plus the partition-
invariant flightline normalization, typed virtual edges, hierarchy edges, and a
project object index. No production consumer switched — the index coexists with
the old helpers; the switch is R10.

- `packages/derived/src/connectivity-index.ts`: `buildProjectConnectivityIndex`
  producing per-document `DocumentConnectivityIndex`
  (`endpointToNet`, per-net `NetConnectivityRecord` with `logicalEndpoints`/
  `visibleEndpoints`/`routedComponents`/`routes`/`junctions`/`virtualEdges`/
  `flightlines`), `hierarchy.edges` from `spice.childDocumentId` bindings
  (parent pin → same-named child port), and `objectIndex.resolve`.
  `normalizeFlightline` orders `from`/`to` by `endpointKey` and recomputes the
  id, so the flightline id is partition-invariant.
- `packages/derived/src/index.ts`: re-exports the new module.
- `packages/derived/src/connectivity-index.test.ts` (9 tests): flightline
  content parity with `deriveFlightlines` across four fixtures
  (phase-1-manual, phase-2-imported-rlc, phase-3-routing, phase-5-dense-analog);
  partition-invariant id for single vs split storage (resolves the WP-R0
  finding); typed net-label virtual edges; `endpointToNet` across terminals/
  ports/junctions; object-index resolve/reject; hierarchy edges per parent pin.

Validation: workspace `pnpm typecheck` passed; `vitest run packages/derived/src/`
passed (85 tests, was 76); `prettier --check` on the new `.ts` files passed;
`git diff --check` clean. Production consumers are untouched (additive only);
the old `deriveVisibleConnectivity`/`deriveFlightlines`/`deriveCrossings` remain
the production path until R10.

`status: completed`, `experience: none`.
