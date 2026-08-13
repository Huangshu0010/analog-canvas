---
status: completed
experience: none
---

# Read-only routing-quality metrics

## Goal

Target #4 of the routing-quality sequence. Add read-only, evidence-only
routing-quality metrics to `diagnoseVisualQuality` so an Agent gets measurable
feedback on routing beyond the existing structural codes. Per the agreed
position: detour ratio is evidence only, never a pass/fail judge; metrics never
move objects.

New codes:

- `VISUAL_WIRE_THROUGH_SYMBOL` (warning): a Route segment passes through an
  instance silhouette that is not one of its terminal endpoints.
- `VISUAL_ROUTE_OVERLAP` (warning): two Routes on the same Net share a
  collinear overlapping segment.
- `VISUAL_TERMINAL_DEPARTURE` (info): a terminal-anchored Route's first
  segment does not leave along the pin outward direction. Evidence only.

These close the "Agent draws a wire and gets no feedback on whether it is good"
loop identified in the routing-quality review, while staying inside the
"derived diagnostics report measurable problems without moving objects"
enforcement boundary from the Agent integration guide.

## Dirty-State Note

Owned paths are `packages/derived/src/visual.ts`, `visual.test.ts`, and
`docs/agent/knowledge/routing-and-diagnostics.md`. They do not overlap the
existing dirty set. No contract change to the Agent API or model (the
VisualDiagnostic type already had objectIds/bounds/point/parameters).

## Owned Files

- `packages/derived/src/visual.ts`
- `packages/derived/src/visual.test.ts`
- `docs/agent/knowledge/routing-and-diagnostics.md`
- `plan/2026-08-07-routing-quality-metrics/plan.md`, `plan/log.md`

## Read-Only Files

- `packages/derived/src/endpoint.ts` (resolveEndpointOutwardDirection)
- `packages/derived/src/routes.ts` (routePolyline)
- `docs/agent/README.md` — enforcement boundary ("derived diagnostics report
  measurable visual problems without moving objects").

## Shared Dependencies

- `VisualDiagnostic` already supports rich fields; metrics flow into the Agent
  Snapshot unchanged via the existing `visualDiagnostics` mapping in
  `packages/agent-adapter/src/service.ts`.
- Existing visual tests had no Routes, so the new metrics are additive and do
  not change existing assertions.

## Expected Work

Done:

1. Added `pushRoutingQualityMetrics` with the three checks.
2. Added `segmentIntersectsRect` and `firstCollinearOverlap` helpers.
3. Added a focused test covering wire-through-symbol and same-Net overlap.
4. Documented the three codes in `routing-and-diagnostics.md` as evidence.

## Validation

- `pnpm typecheck` passed.
- `prettier --check` passed.
- `vitest run packages/derived` (17 tests) passed.
- `git diff --check`.

## Commit Intent

```text
feat(derived): add read-only routing-quality metrics
```
