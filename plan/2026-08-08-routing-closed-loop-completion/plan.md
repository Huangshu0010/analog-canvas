# Complete the routing closed loop (caller, tap geometry, dry-run, multi-move)

## Goal

The reviewer confirmed all four P0/P1 blockers are real and the loop is not yet
runnable end-to-end. Fix them so the `Agent -> Expander -> dry-run -> transact
-> diagnostics` loop actually closes, then prove it with an end-to-end test and
a regenerated CDAC. No push until the loop closes.

Scope is five fixes, each independently testable:

1. **Skill caller is unrunnable** (`expand-route-tree.mjs`): `import
   "@icm/agent-routing"` cannot resolve from the script location, and
   `JSON.parse` yields a plain object where the expander expects a `Map`.
2. **Trunk edits diverge from returned geometry** (already fixed in worktree,
   uncommitted; dist stale): shared-trunk / ordered-bus attached escapes to
   trunk-end Junctions while `resolvedGeometry` claimed the nearest tap point.
   Tap-junction fix exists locally but is uncommitted and dist is stale.
3. **dry-run returns stale geometry**: `dryRun: true` returns the original
   Document, so `resolvedRoutes` reports pre-edit polylines and new Routes are
   invisible.
4. **Multi-instance move uses a stale snapshot**: each `move_instance` passes
   the pre-transaction Document to `proposeLocalStretch`, so a second move in
   the same transaction cannot see the first move's effect on shared Routes.
5. **End-to-end test + regenerate CDAC**: prove the caller, expander, dry-run,
   and diagnostics actually close on a real netlist.

## Dirty-State Note

The worktree already carries an uncommitted tap fix in
`packages/agent-routing/src/expand.ts` (the fix for P0 #2). It will be folded
into this target. The broader dirty set (editor, symbols, fixtures) is
unrelated and untouched.

## Owned Files

- `packages/agent-routing/src/expand.ts` (tap fix already local; plus
  local-branch-tree duplicate-link dedup; plus using existingRoutePolylines/
  outward/anchors is out of scope here — recorded as follow-up, not a blocker
  for the loop)
- `packages/agent-routing/src/expand.ts` `ExpansionInput` serialization helper
  (new `SerializedExpansionInput` + `hydrateExpansionInput`)
- `packages/agent-routing/test/expand.test.ts` (fix the routeCount=6 assertion
  that pinned the duplicate-link bug; add a trunk-tap geometry assertion; add a
  dry-run geometry assertion is in agent-adapter, not here)
- `packages/agent-routing/dist/*` (rebuilt)
- `skills/circuit-layout/scripts/expand-route-tree.mjs` (resolvable import +
  hydrate)
- `skills/circuit-layout/scripts/expand-route-tree.test.mjs` (new CLI test) OR
  a repo-root vitest that exercises the caller — prefer the latter for CI
- `packages/edit-engine/src/transaction.ts` (dryRun returns candidate.data;
  move_instance passes draft to stretch)
- `packages/edit-engine/src/routing.test.ts` (add a multi-instance
  connected-move regression)
- `packages/agent-adapter/src/service.ts` / `service.test.ts` (resolvedRoutes
  on dry-run now reflects proposed geometry; add a dry-run resolvedRoutes
  assertion)
- `netlists/sky130-switched-capacitor-dac-6bit-pvt/agent-cdac-flat.mjs`
  (regenerate; verify 0 ROUTE_OVERLAP after tap fix)
- `plan/2026-08-08-routing-closed-loop-completion/plan.md`, `plan/log.md`

## Read-Only Files

- `docs/adr/0008-agent-local-route-tree-expander.md` (boundary)
- `docs/adr/0009-move-stretches-connected-routes.md` (dryRun must stay
  non-committing; returning candidate.data is read-only)
- `packages/derived/src/stretch.ts` (proposeLocalStretch semantics)

## Shared Dependencies

- The expander dist must be rebuilt after #1/#2 before the caller or recipe
  can exercise the fix.
- `proposeLocalStretch` clones its input Document and moves one instance; it
  reads `route.waypoints` from the passed Document. Passing `draft` (with prior
  edits applied) makes multi-move cascade correctly without changing the
  helper signature.

## Expected Work

### #2 (commit the existing tap fix + dedup)

1. Keep the worktree tap fix in `expand.ts` (shared-trunk + ordered-bus now
   create a real `tapId` Junction per endpoint and attach the escape to it).
2. Add local-branch-tree duplicate-link dedup: track an undirected
   `Set<string>` of `"a|b"` sorted pairs in `appendGroupLinks`; skip if the pair
   was already linked in either direction.
3. Rebuild dist.
4. Fix the `expand.test.ts` assertion that pinned `routeCount: 6` (the
   duplicate-link behavior) to the correct deduped count, and add an assertion
   that trunk shapes' resolved endpoints land on a tap Junction, not a
   trunk-end Junction.

### #1 (caller)

5. Add `SerializedExpansionInput` + `hydrateExpansionInput` to
   `packages/agent-routing/src/expand.ts` (exported): accepts
   `{ endpoints: ResolvedEndpoint[]; existingRoutePolylines: ...;
   instanceBoxes: ... }` and returns an `ExpansionInput` with `endpoints` as a
   `Map`. This is the JSON-friendly contract boundary.
6. Rewrite `expand-route-tree.mjs` to import the dist via a repo-root-relative
   path (resolve from `import.meta.url` to the package dist, matching the
   recipe pattern) and to `hydrateExpansionInput` the parsed JSON.
7. Add a focused vitest that spawns the caller with a fixture decision+input
   and asserts it prints `edits`/`resolvedGeometry`/`conflicts` and exits 0.

### #3 (dry-run candidate geometry)

8. In `executeTransaction`, change the `dryRun === true` return to return
   `candidate.data` (the validated draft) instead of `document`. This keeps
   `applied: false` (no commit) but lets the Adapter collect proposed
   `resolvedRoutes`. Verify the store is NOT mutated in the dryRun path
   (`service.ts` only commits on `result.applied`).
9. Add an `agent-adapter` test: a dryRun transact that touches a Route, assert
   `resolvedRoutes` contains the proposed (not the original) polyline.

### #4 (multi-instance move)

10. In `move_instance`, pass `draft` (not `document`) to
    `applyStretchedRoutes`. Since `proposeLocalStretch` clones its input and
    the instance is already at its new position in `draft`, the helper reads
    the cascaded waypoints and resolves endpoints against the post-prior-move
    geometry. Protected-segment try/catch still skips.
11. Add a regression: two instances on the same Net/Route, both moved in one
    transaction; assert both stretches apply and the Route stays orthogonal.

### #5 (end-to-end + CDAC)

12. Regenerate the CDAC recipe; assert `VISUAL_ROUTE_OVERLAP === 0` (the tap
    fix removes the parallel-escape overlaps).
13. Add one end-to-end test that exercises caller -> expandRouteTree ->
    dryRun transact -> commit transact -> diagnostics, on a tiny 2-instance
    fixture, asserting the resolvedRoutes seen pre-commit match the committed
    geometry.

## Validation

- `pnpm --filter @icm/agent-routing build`
- `pnpm typecheck`
- `vitest run packages/agent-routing packages/edit-engine packages/agent-adapter`
- `node tools/agent-layout/generate.mjs netlists/sky130-switched-capacitor-dac-6bit-pvt/agent-cdac-flat.mjs`
  then assert 0 ROUTE_OVERLAP via `diagnoseVisualQuality`
- `git diff --check`

## Commit Intent

```text
fix(agent-routing): close the expander loop (caller, tap geometry, dry-run, multi-move)
```
