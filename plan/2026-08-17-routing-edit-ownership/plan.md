---
status: completed
experience: none
---

# Unify Route Edit Planning and Preview

## Goal

Move route-writing algorithms out of `@icm/derived`, make the Edit Engine the
only route mutation owner, and have editor route previews consume the same plan
that is submitted on pointer release. Current drag, stretch, Junction, and
power-rail behavior remains unchanged.

## State and Ownership

Start state from `git status --short --branch`:

```text
## codex/routing-protocol-unification...origin/main [ahead 2]
```

The isolated worktree is clean after the read-protocol commit. This target
owns route mutation/planning code, its editor callers, focused tests, and
plan/log records.

- `packages/edit-engine/src/{route-operations,routing-planner,transaction}.ts`
- `packages/derived/src/{routes,stretch}.ts` and their tests
- `apps/editor/src/app/App.tsx`
- `packages/agent-routing/src/*` only for collision-free planned-geometry names
- focused editor/Edit Engine/derived tests and plan/log records
- current-state routing ADR/spec/status records: `docs/adr/{0009,0013,0014}*`,
  `docs/specs/connectivity-and-routing.md`, and
  `docs/roadmap/connectivity-recovery-status.md`

Read-only shared contracts:

- Schema 11 RouteBranch and SchematicEdit records
- resolved routing geometry/query API from commit `0b425c8`
- transaction revision and atomic validation boundary

## Work

1. Move normalization, orthogonal escape authoring, segment movement, and
   stretch/planning helpers to Edit Engine ownership.
2. Replace `RoutePolyline` with resolved geometry or an edit-local path input;
   remove `routes.ts` and `stretch.ts` after all consumers move.
3. Return an explicit `RouteEditPlan` with transaction edits and preview facts
   from route planners.
4. Make editor previews use planner output rather than direct geometry mutation.
5. Rename Agent-routing's colliding `ResolvedRouteGeometry` to planned route
   geometry.
6. Replace the stale compatibility claims in the current-state ADR/spec/status
   records; preserve the historical roadmap as historical context.

## Validation

- focused derived/Edit Engine/Agent-routing/editor route tests
- relevant route-drag and power-rail browser workflows
- `pnpm test:impact -- --base origin/main`
- `pnpm typecheck`
- `git diff --check`
- `git status --short --branch`

## Test Impact

- Decision: tests-updated
- Contracts: current route mutation output and preview/commit parity
- Primary checks: route edit, routing Edit Engine, planner, Agent routing, and
  editor interaction tests

## Commit Intent

```text
refactor(routing): unify route planning and preview
```

## Outcome

Moved route mutation and authoring helpers from `@icm/derived` to
`@icm/edit-engine`. The former `RoutePolyline` bridge is deleted: pure reads
consume `ResolvedRouteGeometry`; edit operations accept the minimal local
`RouteEditPath`. Group-selection and power-rail traversal remain derived
read-only components.

`RouteEditPlan` now gives the editor the same segment-drag proposal for both
preview and persisted transaction edits. Agent-routing's colliding local type
is now `PlannedRouteGeometry`, and remaining route-path names describe their
role without reviving the removed compatibility protocol. ADR/spec/status
records now match the implemented R10 boundary.

Validation passed: focused route suite (8 files / 71 tests), targeted editor
browser route interaction (3 tests), `pnpm build`, `pnpm docs:check`,
`pnpm typecheck`, `pnpm test:impact -- --base origin/main`, and
`git diff --check`. Implementation committed as `2f210c3` and pushed to
`origin/codex/routing-protocol-unification`.
