---
status: completed
experience: none
---

# Octilinear Route Protocol

## Goal

Replace the production-wide orthogonal-only Route geometry assumptions with one
generic segment-geometry and route-planning protocol. Preserve the existing
orthogonal experience as the default constraint, add interactive 45-degree
(`octilinear`) Wire authoring, and keep topology, Junction, Net, bulk-route,
selection, movement, rendering, export, and Agent mutation on the same Route
and transaction boundary.

## State and Ownership

Start state from `git status --short --branch`:

```text
## codex/octilinear-route-protocol
?? .pnpm-store/
?? .worktrees/
```

The two untracked directories are local dependency/worktree infrastructure,
are outside this target, and will not be touched. The branch was created from
the locally fast-forwarded `origin/main` at `81985dca`.

Owned paths include:

- `packages/derived/src/segment-geometry.ts` and derived route/query/contact
  consumers and tests
- `packages/edit-engine/src/*route*`, transaction routing/planning, edit
  schemas, public exports, and focused tests
- `packages/agent-routing/` transient RouteGraph expansion and tests, because
  it produces the same typed Route edits as the public Agent API
- `apps/editor/src/interaction/*`, `apps/editor/src/features/wiring/*`, canvas
  geometry consumers, App wiring, help text, and focused/e2e tests
- `packages/agent-adapter/` and Agent client/schema fixtures only if the
  unified high-level Wire capability requires the additive mode option
- `packages/model/` and `packages/project-protocol/` are read-only unless the
  implementation proves a Project schema boundary is required; fixtures and
  docs record that compatibility decision
- `fixtures/exports/phase-7-dense-analog/` is now owned only to reconcile the
  release golden after verifying the formal renderer change is intentional
- `docs/adr/`, `docs/specs/`, `docs/user/`, `plan/log.md`, and this plan

Read-only shared dependencies:

- `docs/adr/0009-move-stretches-connected-routes.md`, ADR 0013/0014/0021, and
  ADR 0022-0027
- `packages/render-svg/`, exporters, symbols, SPICE, and existing routing
  fixture contracts
- the current Stage 1 netlist-authoring work on `main`

## Work

1. Record the new Route geometry decision: one persisted Route model, one
   derived segment-geometry model, and transient routing constraints rather
   than orthogonal/diagonal Route variants.
2. Add a shared generic segment-geometry kernel and migrate resolved geometry,
   route queries, contact evidence, visual diagnostics, editor hit/snap, and
   renderer joins away from local axis-only implementations.
3. Replace orthogonal-only edit validation, normalization, route planning,
   endpoint stretch, Junction movement, and segment drag with the unified
   constraint-aware planner. Keep existing orthogonal output stable under the
   default policy; constrain power rails horizontally.
4. Replace the Wire interaction's loose waypoint list with deterministic draft
   steps. Add Virtuoso-aligned MMB click / F3 mode switching between
   orthogonal and octilinear while retaining MMB drag pan, shared preview and
   commit compilation, undo of authored steps, and clear in-canvas status.
5. Extend the high-level Agent Wire route mode and transient Agent RouteGraph
   expansion through the same constraint vocabulary; retain cardinal terminal
   escapes while allowing ordinary Agent links/trunks to be octilinear.
6. Decide the Project compatibility boundary deliberately. The current Route
   shape already persists arbitrary points, so retain schema 14 when command
   capability advertisement prevents an older client from exposing octilinear
   authoring; otherwise advance it with explicit migration fixtures.
7. Add focused unit, integration, and browser regressions for orthogonal
   parity, 45-degree draw/tap/Junction/crossing, bulk behavior, route labels
   and markers, move/stretch, delete/undo, and Project/Agent round trips.

## Validation

- Focused `pnpm test:local` suites for derived geometry, edit-engine routing,
  editor interaction/wiring, model/project protocol, and Agent wire contracts
- Relevant `pnpm test:e2e:local` Wire and manual-editor flows
- `pnpm test:impact -- --base origin/main`
- `pnpm verify:branch`
- `git diff --check`
- `git status --short --branch`

Before any merge or push to `main`, run `pnpm install --frozen-lockfile`,
`pnpm ci:check`, then push the review branch and wait for required GitHub
checks, as required by `AGENTS.md`.

## Test Impact

- Decision: tests-updated
- Contracts: one Route geometry protocol supports the existing orthogonal
  behavior and octilinear geometry without changing electrical topology;
  every consumer resolves the same segment facts and every GUI/Agent mutation
  uses the same planner and transaction boundary.
- Primary checks: derived segment geometry/query/contact tests; edit-engine
  planner, transaction, stretch, and routing tests; editor reducer/shortcut,
  wire interaction, and Playwright wiring tests; model/project compatibility
  and Agent contract tests.

## Commit Intent

Commit as:

```text
feat(routing): unify route geometry and add octilinear wire authoring
```

## Outcome

Implemented a single segment-geometry kernel and made ordinary persisted Routes
octilinear: horizontal, vertical, and ±45° segments share projection, route
tap, crossing, normalization, rendering joins, transaction validation,
selection, and follow/stretch behavior. `power-rail` remains horizontal-only;
the Route JSON shape and Project schema remain 14 because the additive Wire
mode is a command capability rather than a new persisted object type.

Wire now retains authored draft steps and compiles them under an active
orthogonal/octilinear constraint. W remains the entry point; MMB click toggles
the active uncommitted leg while MMB drag continues panning; F3 opens the
policy/corner-order control. Existing authored legs are unchanged by a later
mode change and Backspace removes an authored step. Endpoint movement,
Junction movement, and selected 45° segment movement use the same Route and
transaction proposal surface.

The high-level Agent `wireIntent` exposes the same optional constraint, and
the transient Agent RouteGraph now allows octilinear links/trunks while
retaining cardinal terminal escapes. Generated API and MCP resources were
refreshed.

Validation passed: focused unit/component regressions (19 files / 166 tests),
focused Playwright Wire flow (2 tests), direct TypeScript checks, workspace
build, production smoke, generated Agent/MCP checks, Markdown links,
test-impact against `origin/main`, and `git diff --check`. The project static
and full-unit branch checks were also launched through `verify:branch`; their
individual deterministic static/build/test components completed successfully.

Commit status: committed locally on `codex/octilinear-route-protocol`;
push/PR was not requested.

## Release-gate follow-up

The first PR release-contract job and a local `pnpm release:verify` both found
that `fixtures/exports/phase-7-dense-analog/schematic.svg` no longer matches
the formal export. This target is reopened solely to inspect and deliberately
refresh the export golden if its delta follows from the accepted route geometry
protocol. The other golden artifacts and unrelated release outputs remain
read-only. Re-run the complete release verification and remote required checks
before merging.

Follow-up outcome: the only formal SVG source delta is the terminal miter
bridge on the dense fixture's three diagonal terminal segments. It changes the
old axis-biased bridge into the correct unit-direction bridge; PNG and PDF
hashes change only because they are derived from that SVG. The refreshed
goldens pass `node scripts/export-golden.mjs --check` and the complete local
`pnpm release:verify` gate.
