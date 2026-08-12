---
status: completed
experience: none
---

# WP-R10 — Deletion-Gate Parity and Migration Gate Status

## Goal

Close the roadmap's final work package by (a) establishing the **deletion-gate
characterization tests** the roadmap (§10, §13) requires before any old read
model may be removed, and (b) recording the **migration gate status**: which
unified read models are in place (additive), which consumer switches remain,
what blocks them, and the ordered switch plan. Per roadmap §13, the old
production helpers are NOT deleted in this target — deletion is gated, and the
gates cannot all be met in this environment.

## Why deletion is gated (not done here)

Roadmap §13 deletion threshold requires ALL of:
1. `rg` proves no production consumer of the old helper;
2. old/new characterization fixtures agree (or differences explicitly accepted);
3. full routing/editor/Agent/export regression passes;
4. representative large-Project performance baseline;
5. no per-pointer-move full-Project rebuild.

(1) is false today — the editor renderer, flightline overlay, and App wiring
still consume the old `routePolyline` / `deriveFlightlines` / private bridges.
(2) is now established by this target's parity tests. (3) requires Playwright
e2e plus resolution of the 8 pre-existing failures on `main`
(instance-label/golden/Razavi-catalog regeneration owned by
`codex/ci-delivery-gate`), neither of which this session can run/resolve. (4)
needs the R0 performance-baseline measurement on a representative large
circuit. Forcing the switch or deleting old code now would violate §13 and risk
unvalidatable editor regressions. So this target lands the parity gates and the
status record; the switch + deletion stay gated.

## State and Ownership

```text
## roadmap/connectivity-routing-debugging
(clean — R0..R9 committed)
```

Owned paths:

- `packages/derived/src/deletion-gate-parity.test.ts` (NEW — 8 tests)
- `plan/2026-08-12-wp-r10-deletion-gates/plan.md` (this file — gate-status record)
- `plan/log.md` (entry)

Read-only: every production consumer (renderer, editor, Agent, edit-engine).

## Work (done this target)

- `deletion-gate-parity.test.ts`: for four fixtures (phase-1-manual,
  phase-2-imported-rlc, phase-3-routing, phase-5-dense-analog), asserts
  (a) `deriveFlightlines` content equals index flightlines content (canonical),
  and (b) `routePolyline` points equal `resolveRouteGeometry.centerline` for
  every route. These are the §13 parity gates, runnable in CI.

## Migration gate status (R0–R10)

| Capability | New additive module | Old production path | Switch gate |
|---|---|---|---|
| Connectivity index + flightlines | `connectivity-index.ts` (R2) | `deriveFlightlines`/`deriveVisibleConnectivity` | parity ✓ (R2 + R10); switch = e2e |
| Resolved route geometry | `resolved-route-geometry.ts` (R3) | `routePolyline` + renderer bridges | centerline parity ✓ (R10); switch = e2e + seam-golden |
| Route-tap resolver | `features/wiring/route-tap.ts` (R4) | (was inline in App.tsx) | done (App imports it) |
| Search index | `project-search.ts` (R5) | none (new) | UI wiring = e2e |
| Net highlight/trace | `net-highlight.ts` (R6) | none (new) | overlay wiring = e2e |
| NoConnect schema | model v3 (R7) | none (new field) | schema live; edits/importer/visual = follow-on |
| ERC engine | `diagnostics/erc.ts` (R8) | none (new) | UI = e2e; more rules = follow-on |
| Diagnostic envelope | `diagnostics/diagnostic.ts` (R9) | `VisualDiagnostic`/`SpiceDiagnostic` | UI = e2e |

Ordered switch plan (each its own e2e-gated target, one consumer at a time):
1. Flightline overlay → index (after e2e green + pre-existing failures resolved).
2. Renderer bridges → `endpointJoins` (after SVG/PNG seam-golden parity).
3. Editor hit/marker/drag → `resolveRouteGeometry`.
4. App planners → shared planner module (stretch/group-move wrappers).
5. Search/highlight/ERC UI → respective modules.
6. Delete old helpers + renderer bridges only after each row's gate is met.

## Validation

- `pnpm typecheck`
- `pnpm exec vitest run packages/derived/src/`
- `pnpm exec prettier --check` on the new `.ts`
- `git diff --check`

## Commit Intent

```text
test(derived): add old/new deletion-gate parity tests (WP-R10)
```

## Outcome

Established the roadmap's deletion-gate characterization tests and recorded the
migration gate status. The old production read models are NOT deleted — per
roadmap §13, deletion is gated, and the gates (e2e + pre-existing-failure
resolution + performance baseline) cannot all be met in this environment.

- `packages/derived/src/deletion-gate-parity.test.ts` (8 tests): across four
  fixtures, asserts `deriveFlightlines` content === index flightlines content
  (canonical), and `routePolyline` points === `resolveRouteGeometry.centerline`
  for every route. These are the §13 "old/new characterization fixtures agree"
  gates, runnable in CI.
- This plan records the per-capability switch-gate status and the ordered switch
  plan (one consumer at a time, each e2e-gated).

Validation: workspace `pnpm typecheck` passed; `vitest run packages/derived/src/`
passed (120 tests, was 112); `prettier --check` on the new `.ts`; `git diff
--check` clean.

`status: completed`, `experience: candidate` (the strangler pattern here — every
new read model landed additively with an old/new parity test before any switch,
and deletion stayed gated until e2e + perf baselines exist — is a reusable
large-refactor lesson worth extracting if a later switch confirms it).
