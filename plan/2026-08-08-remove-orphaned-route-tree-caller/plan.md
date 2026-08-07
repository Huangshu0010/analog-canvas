# Remove Orphaned Route-Tree Caller

## Goal

Delete the dead `expand-route-tree.mjs` Skill caller, its test, and its
fixtures so CI turns green. The caller is an orphan of the `13b05c9`
RouteTreeDecision → RouteGraph refactor: it imports and calls
`expandRouteTree`, a function that no longer exists (replaced by
`expandRouteGraph` with a different input model). It is the sole remaining
CI failure after three earlier fix commits restored netlists tracking and
regenerated the resistor golden.

## Background

`skills/circuit-layout/scripts/expand-route-tree.test.mjs` is the only failing
test file in CI run 31226469697 (39/40 files pass). Two stacked problems:

1. CI runs `pnpm test` with no `pnpm build`, and `.gitignore` excludes
   `packages/agent-routing/dist/`, so the caller's dynamic `import(distPath)`
   throws `ERR_MODULE_NOT_FOUND` in CI.
2. Even with `dist/` present (locally), the caller calls `expandRouteTree`,
   which was removed in `13b05c9` ("demote expander to a route-graph geometry
   helper"); the live export is `expandRouteGraph(graph, input)`, taking a
   `RouteGraph` rather than a `RouteTreeDecision`.

The caller is unreferenced by any active Skill surface: `grep` of
`skills/circuit-layout/SKILL.md`, the references manifest, and
`docs/agent/**` finds no mention. Only plan/log documents and the test itself
reference it. The Agent workflow remains complete without it (ADR 0008: the
caller "is a convenience, not a required API").

## Dirty-State Decision

The worktree carries uncommitted group 2/3 (current-arrow + annotation)
changes in `apps/editor`, `packages/model`, `packages/render-svg`, and
`packages/derived`. None of those touch the Skill caller or its fixtures, so
there is no overlap. The four files to delete are tracked and clean at HEAD
`baffb44`. This target deletes files only; it does not edit any file that
group 2/3 owns.

## Owned Files

- `plan/2026-08-08-remove-orphaned-route-tree-caller/plan.md`
- `skills/circuit-layout/scripts/expand-route-tree.mjs` (delete)
- `skills/circuit-layout/scripts/expand-route-tree.test.mjs` (delete)
- `skills/circuit-layout/scripts/fixtures/decision.json` (delete)
- `skills/circuit-layout/scripts/fixtures/input.json` (delete)
- this target's entry in `plan/log.md`

## Expected Work

1. `git rm` the caller, its test, and both fixtures.
2. Confirm no dangling reference remains in active Skill/docs surfaces.
3. Run the focused test suite to confirm zero remaining failures, typecheck,
   and `git diff --check`.

## Validation

- `pnpm vitest run` shows 0 failed test files (the 40th file is gone).
- `pnpm typecheck` passes (no code imports the caller).
- `git diff --check`.
- CI on the resulting commit turns green (confirmed after push).

## Commit Intent

Commit as a standalone `chore(agent-routing)` removal, then push. This is the
group-4 (agent-routing) cleanup that closes the last CI failure.
