# packages/agent-routing expander + Skill caller + shape dictionary

## Goal

Target #3b of the routing-quality sequence. Build the Agent-local route-tree
expander that ADR 0008 bounded: it takes a `RouteTreeDecision` (topology only)
plus a Snapshot-derived input slice and emits typed edits with resolved
coordinates, so the Agent stops hand-computing integer waypoints. The expander
detects conflicts (trunk corridor blocked, missing endpoints, shape mismatch)
but never auto-reroutes or silently switches shapes. Accompanied by a thin
Skill caller script and a non-recipe shape dictionary.

This removes the measured bottleneck (multi-endpoint Net tree arithmetic) that
the thermometer flat layout proved is the real issue, without re-introducing a
server-side router or a persisted Layout Intent.

## Dirty-State Note

Owned paths are additive (new package, new script, new doc, new manifest row,
new test). They do not overlap the existing editor/symbol/fixture dirty set.
`tsconfig.check.json` gains one path entry; `pnpm install` re-links the
workspace (no lockfile change expected). The agent-api schema artifacts are
not touched by this target.

## Owned Files

- `packages/agent-routing/package.json`, `tsconfig.json` (new)
- `packages/agent-routing/src/index.ts`, `types.ts`, `expand.ts` (new)
- `packages/agent-routing/test/expand.test.ts` (new)
- `skills/circuit-layout/scripts/expand-route-tree.mjs` (new)
- `docs/agent/knowledge/route-tree-shapes.md` (new)
- `skills/circuit-layout/references/manifest.md` (add row)
- `tsconfig.check.json` (add path)
- `plan/2026-08-07-agent-routing-expander-package/plan.md`, `plan/log.md`

## Read-Only Files

- `docs/adr/0008-agent-local-route-tree-expander.md` — the boundary this implements.
- `packages/edit-engine/src/transaction.ts` — SchematicEdit shapes the expander emits.
- `packages/derived/src/endpoint.ts`, `routes.ts` — coordinate helpers (the expander does not call them; it reads pre-resolved points from its input slice to stay pure and Agent-local).
- `docs/agent/knowledge/razavi-style-canon.md` — grid=10 canon the expander applies.

## Shared Dependencies

- The expander depends on `@icm/model` (Point, RouteEndpoint) and
  `@icm/edit-engine` (SchematicEdit type) as type-only imports. It does NOT
  depend on `@icm/agent-adapter` (ADR 0008: types must not enter the API
  schema) and does NOT depend on `@icm/model` persistence.
- `SegmentMode` is derived from `SchematicEdit` to avoid a direct zod dep.

## Expected Work

Done:
1. Created `packages/agent-routing` with `types.ts` (RouteTreeDecision /
   RouteTreeExpansion / ResolvedEndpoint / finite RouteTreeShape set),
   `expand.ts` (expandRouteTree + per-shape expanders for direct,
   local-branch-tree, shared-trunk, labeled-islands, ordered-bus), and
   `index.ts`.
2. Applied the grid=10 canon (snap), deterministic stableId (no Math.random /
   Date.now), conflict-only returns (UNKNOWN_SHAPE, MISSING_ENDPOINT,
   SHAPE_MISMATCH, TRUNK_CORRIDOR_BLOCKED). No `auto`/`best` shape; no reroute.
3. Added `skills/circuit-layout/scripts/expand-route-tree.mjs` thin caller.
4. Added `docs/agent/knowledge/route-tree-shapes.md` as a shape menu (not a
   recipe): each shape lists may-fit / expresses-well / common-failure /
   does-not-fit; no global priority order.
5. Added a manifest row routing multi-endpoint Net tree choice to the doc.
6. Added 8 focused tests: direct, shape mismatch, missing endpoint, unknown
   shape (no fallback), local-branch-tree with group links, trunk-corridor
   conflict (not rerouted), labeled-islands, determinism.

## Validation

- `pnpm typecheck` (full workspace) passed.
- `prettier --check` on new TS/MJS files passed.
- `vitest run packages/agent-routing` (8 tests) passed.
- `git diff --check`.
- No agent-api artifact regeneration needed (no API change).

## Commit Intent

```text
feat(agent-routing): add Agent-local route-tree expander and shape dictionary
```
