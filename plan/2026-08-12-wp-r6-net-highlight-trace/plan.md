---
status: completed
experience: none
---

# WP-R6 — Net Highlight and Cross-Cell Trace (core)

## Goal

Deliver the testable core of WP-R6 (roadmap §8 R6): compute, from the
`ProjectConnectivityIndex` (R2), the full highlight set for a Net (visible
terminals/ports, routes, junctions, virtual edges, flightlines) and a
cross-cell trace that follows `HierarchyEdge`s into child Documents. Pure
computation; the overlay rendering is deferred to R9 (e2e-gated UI).

This consumes the R2 index end-to-end, which is also a useful integration check
on that module.

## State and Ownership

```text
## roadmap/connectivity-routing-debugging
(clean — R0..R5 committed)
```

Owned paths:

- `packages/derived/src/net-highlight.ts` (NEW)
- `packages/derived/src/net-highlight.test.ts` (NEW)
- `packages/derived/src/index.ts` (re-export)
- `plan/2026-08-12-wp-r6-net-highlight-trace/plan.md` (this file)
- `plan/log.md` (entry)

Read-only: `packages/derived/src/connectivity-index.ts` (consumed). No editor
code is modified; the overlay/UI is R9.

## Work

1. `net-highlight.ts`:
   - `NetHighlight`: `{ documentId, netId, terminals, ports, junctions, routes,
     virtualEdges, flightlines }` (ids/refs aggregated from the net record).
   - `CrossCellTraceFrame`: `{ parentDocumentId, instanceId, parentPinName,
     childDocumentId, childPortId, childNetId }`.
   - `NetTrace`: `{ primary: NetHighlight; crossCell: readonly
     CrossCellTraceFrame[] }`.
   - `computeNetHighlight(index, documentId, netId): NetHighlight | undefined`.
   - `traceNet(index, documentId, netId): NetTrace | undefined` — follows each
     hierarchy edge whose parent pin endpoint belongs to this net into the
     child Document, resolving the child port's net via the child's
     `endpointToNet`.
2. `index.ts` re-export.
3. `net-highlight.test.ts`: local highlight aggregates all net members; cross-
   cell trace follows a parent instance pin on the net to the child port and
   resolves the child net; a net with no hierarchy edge yields an empty
   crossCell list.

## Validation

- `pnpm typecheck`
- `pnpm exec vitest run packages/derived/src/`
- `pnpm exec prettier --check` on new `.ts` files
- `git diff --check`

## Commit Intent

```text
feat(derived): compute net highlight and cross-cell trace from the index (WP-R6)
```

## Outcome

Delivered the testable core of WP-R6: net highlight and cross-cell trace
computed purely from the `ProjectConnectivityIndex` (R2). The editor overlay
that paints the highlight is deferred to R9 (e2e-gated). This also exercises the
R2 index and hierarchy edges end-to-end.

- `packages/derived/src/net-highlight.ts`: `NetHighlight`, `CrossCellTraceFrame`,
  `NetTrace`, `computeNetHighlight`, and `traceNet` (follows each hierarchy edge
  whose parent pin endpoint is on the net into the child Document, resolving the
  child port's net via the child `endpointToNet`).
- `packages/derived/src/index.ts`: re-export.
- `packages/derived/src/net-highlight.test.ts` (4 tests): local highlight
  aggregation; unknown document/net → undefined; cross-cell trace through a
  parent instance into child ports (resolving child net where present);
  no-hierarchy net yields empty cross-cell.

Validation: workspace `pnpm typecheck` passed; `vitest run packages/derived/src/`
passed (103 tests, was 99); `prettier --check` on the new `.ts` files passed;
`git diff --check` clean.

`status: completed`, `experience: none`.
