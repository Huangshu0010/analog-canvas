---
status: completed
experience: candidate
---

# WP-R0 — Connectivity/Routing Behavioral Baseline

## Goal

Establish a deterministic behavioral baseline for the connectivity/routing
subsystem before any refactor in later work packages (R1–R10 of
`docs/roadmap/connectivity-routing-debugging-plan.md`). Prove what the code
actually does today so later WPs refactor against pinned behavior, not against
comments or stale docs. **No production code changes** this target
("不改变生产入口") — additive characterization tests plus one historical doc
note.

This is the first target on branch `roadmap/connectivity-routing-debugging`,
executed sequentially per the roadmap's own discipline (one WP = one target =
one commit).

## State and Ownership

Start state from `git status --short --branch`:

```text
## roadmap/connectivity-routing-debugging
 M .github/workflows/ci.yml
 M AGENTS.md
 M fixtures/exports/phase-7-dense-analog/manifest.json
 M fixtures/exports/phase-7-dense-analog/schematic.pdf
 M fixtures/exports/phase-7-dense-analog/schematic.png
 M fixtures/visual-golden/phase-1-manual.svg
 M fixtures/visual-golden/phase-3-crossing.svg
 M package.json
 M packages/derived/src/connectivity.ts
 M packages/derived/src/instance-label-placement.ts
 M packages/exporters/src/node.ts
 M packages/render-svg/src/default-instance-label-placement.test.ts
 M packages/symbols/src/builtins.test.ts
 M packages/symbols/src/razavi-catalog.test.ts
?? plan/2026-08-12-ci-delivery-and-archive-governance/
```

**Dirty-state decision (proceed):** the dirty paths belong to a different,
identifiable target — `plan/2026-08-12-ci-delivery-and-archive-governance/`
(untracked plan dir) — which adds a "Mainline Delivery Gate" section to
`AGENTS.md`, `ci:check` scripts to `package.json`, CI workflow edits, and
regenerated export/golden artifacts. They are not this target's work.

The only overlap with this target's package is
`packages/derived/src/connectivity.ts`, and its diff is a pure Prettier line
collapse (`flightlineNodePriority` predicate) with **no logic change** —
verified by reading the diff. This target does not edit any dirty file. All
owned paths below are new files or a doc-only edit on a file that is clean in
the working tree (`docs/roadmap/phase-3-connectivity-and-routing.md`).

At commit time only the owned files below will be staged; the unrelated dirty
set is left untouched for its owner.

Owned paths (this target may edit):

- `packages/derived/src/endpoint.test.ts` (NEW)
- `packages/derived/src/routes.test.ts` (NEW)
- `docs/roadmap/phase-3-connectivity-and-routing.md` (historical note only)
- `plan/2026-08-12-wp-r0-behavior-baseline/plan.md` (this file)
- `plan/log.md` (entry)

Read-only (credible overlap/contract risk):

- Read-only: `packages/derived/src/{endpoint,routes,connectivity,stretch,visual}.ts`
  and all other production source — characterized, not modified.
- Shared: the `endpointKey` string format, `routePolyline`/`deriveCrossings`
  output shapes, and `deriveFlightlines` MST ordering are de-facto contracts
  that later WPs (R2/R3) will diff against; this target pins them, not changes
  them.

## Work

### 1. `packages/derived/src/endpoint.test.ts` (NEW)

`endpoint.ts` primitives currently have **zero direct coverage**; the
`endpointKey` string format is a de-facto contract consumed by connectivity,
routes, stretch, and visual. Pin:

- `endpointKey` formats: `terminal:{instanceId}:{pinName}`, `port:{portId}`,
  `junction:{junctionId}`.
- `endpointsEqual` by key (same/discriminator/id).
- `isVisibleEndpoint`: non-terminal always visible; variant-hidden pin →
  `false`; `pin.presentation.visibility === "implicit"` → `false`; missing
  instance/symbol → `false`. Include a three-terminal MOS bulk case (§7
  hidden-bulk preservation row).
- `resolveEndpointPoint`: port, junction, terminal via placement transform;
  unresolved → `null`.
- `resolveEndpointOutwardDirection`: N/E/S/W mapped through rotation+mirror;
  non-terminal → `null`.
- `endpointBelongsToNet` and `netEndpoints`: membership across the three
  endpoint kinds; `netEndpoints` ordering by `endpointKey.localeCompare(…,"en")`.

### 2. `packages/derived/src/routes.test.ts` (NEW)

Read-side route primitives; distinct from `route-edit.test.ts` (which covers
`moveRouteSegment`/`routeAttachmentPlacement`). Pin:

- `routePolyline` direct characterization: returns
  `{routeId, netId, points:[from,…waypoints,to], segmentModes}`; unresolved
  endpoint → `null`. Today only exercised transitively.
- `deriveCrossings` `overlap` kind (collinear same-line overlap) — only the
  `crossing` kind is tested today (`derived.test.ts:147`).
- `deriveCrossings` shared-explicit-endpoint exclusion: two routes meeting at a
  common junction must NOT emit a crossing at that point.
- **Partition invariance:** the same visible wire stored as (a) one Route and
  (b) two Routes joined at a `route-anchor` junction produce identical
  `deriveFlightlines` and identical `deriveCrossings`. (Today invariance is only
  proven for `proposeWireSegmentDrag` — `stretch.test.ts:306`.)

### 3. Phase-3 doc historical note

Add a concise note at `docs/roadmap/phase-3-connectivity-and-routing.md` near
the "Detach a routed branch" acceptance scenario (lines 105–110) and the
exit-gate "detach" wording: the unconditional "Detach → retain membership +
restore a flightline" is superseded by the current `Delete wire` /
`cut_connection` semantics, which split fully-routed local nets, delete the
empty net of an isolated free wire, and retain membership for partial/SPICE/
global nets. Point to `packages/edit-engine/src/transaction.ts` `cut_connection`
handler and `packages/edit-engine/src/routing.test.ts` cases at lines 1030,
1060, 1104, 1147, 1201, 1235. Do not rewrite history; mark the wording
historical.

### 4. R0 item 6 — parallel comparison harness

Deferred to R2/R3 (human-approved). The characterization tests above are the
diff baseline; the old↔new adapter comparison harness is built when
`ProjectConnectivityIndex` (R2) and `ResolvedRouteGeometry` (R3) exist.

## Validation

- `pnpm typecheck`
- `pnpm test` (vitest; the new characterization tests pass alongside existing.
  Note: an unrelated dirty target is present in the worktree; any failure
  outside `packages/derived` is attributed to it, not this target.)
- `pnpm format:check`
- `git diff --check`
- `git status --short --branch`

Focused scope rationale: this target adds tests and one doc note only; the
derived vitest suite plus workspace typecheck and format gate are the smallest
deterministic set covering changed behavior and type/contract integrity.

## Commit Intent

Commit as:

```text
test(derived): characterize endpoint/route primitives and partition invariance (WP-R0)
```

Stage only the owned paths listed above; leave the unrelated
`ci-delivery-and-archive-governance` dirty set untouched.

## Outcome

Filled the verified characterization gaps with **21 new tests** across two new
files, and marked the outdated Phase-3 Detach wording historical. No production
code changed.

- `packages/derived/src/endpoint.test.ts` (14 tests): `endpointKey` format,
  `endpointsEqual`, `isVisibleEndpoint` (visible / variant-hidden / implicit /
  missing branches), `resolveEndpointPoint` (port/junction/terminal-transform/
  null), `resolveEndpointOutwardDirection` (non-terminal null, all four
  rotations, west, missing), `endpointBelongsToNet`, `netEndpoints` ordering.
- `packages/derived/src/routes.test.ts` (7 tests): `routePolyline` (basic +
  null), `deriveCrossings` `overlap` kind, shared-explicit-endpoint exclusion,
  and storage-partition characterization.
- `docs/roadmap/phase-3-connectivity-and-routing.md`: historical note at the
  Detach acceptance scenario pointing to the current `cut_connection` branches.

**Finding for R2 (partition sensitivity):** the current `deriveFlightlines`
emits the same flightline endpoints and distance whether a visible wire is one
Route or two joined at a `route-anchor`, but its `from`/`to` **direction** — and
therefore the derived flightline `id` — is NOT partition-invariant. Introducing
a route-anchor junction whose key sorts before the port keys flips the
component-pair order and swaps from/to. Pinned explicitly in
`routes.test.ts` ("pins the current from/to direction per partition"). R2's
`ProjectConnectivityIndex` must address this consciously (preserve or
deliberately normalize the id).

Validation: `pnpm typecheck` (workspace) passed; `pnpm exec vitest run
packages/derived/src/` passed (76 tests, was 55); `prettier --check` on the two
owned `.ts` files passed; `git diff --cached --check` clean. Full-repo suite
and e2e intentionally not run — R0 is additive tests plus one doc note, with no
production or contract change; derived suite + workspace typecheck is the
smallest deterministic set.

Two environmental notes (not R0 regressions):
1. `pnpm format:check` (the repo gate) fails on three files —
   `packages/derived/src/connectivity.ts`, `packages/derived/src/instance-label-placement.ts`,
   `packages/symbols/src/razavi-catalog.test.ts` — all at the unmodified `main`
   version (verified `git status` clean for them). This is pre-existing
   prettier dirt on `main`, unrelated to R0; the owned `.ts` test files pass.
   Markdown under `docs/`/`plan/` is outside the gate's glob.
2. Mid-session the working branch was switched out from under this target to
   `codex/ci-delivery-gate` (the concurrent `ci-delivery-and-archive-governance`
   target committed its work and another process checked it out). The R0
   staged changes carried along; I verified `codex` did not touch any of the
   five owned paths (`git diff main..codex/ci-delivery-gate` empty for them),
   switched back to `roadmap/connectivity-routing-debugging`, reset the phase-3
   doc to `main` to drop prettier table-collateral, and re-applied only the
   historical note. Only the five owned paths are staged.

`status: completed`, `experience: candidate` (the partition-sensitive
flightline id is a concrete, evidence-backed signal worth a reusable lesson if
R2 confirms it generalizes).
