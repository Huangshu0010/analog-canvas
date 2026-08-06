# Execute Phase 3 Connectivity and Routing

## Goal

Complete the Phase 3 exit gate with deterministic visible-connectivity and
flightline derivation, explicit orthogonal Route/Junction editing, crossing
semantics, local stretch, locks, detach-to-flightline behavior, formal route
rendering, and a browser workflow that exercises the same typed Edit Engine.

This is the fourth bounded target under the active Phase 0-7 goal.

## Dirty-State Note

Start state from `git status --short --branch`:

```text
## main...origin/main
```

The worktree is clean at Phase 2 commit `a0feb43`.

## Owned Files

- new `packages/derived/` connectivity, endpoint, route-geometry, flightline,
  diagnostic, and local-stretch implementation
- routing edit additions under `packages/edit-engine/`
- the narrowly required cross-Net endpoint ownership invariant under
  `packages/model/`
- route and Junction rendering under `packages/render-svg/`
- narrowly required routing interaction/session changes under `apps/editor/`
- root workspace/type configuration required for `@icm/derived`
- Phase 3 hand-authored Project and SVG goldens under `fixtures/`
- `docs/specs/connectivity-and-routing.md`
- compatible updates to `docs/specs/edit-engine.md` and `docs/specs/README.md`
- `docs/roadmap/README.md`
- `docs/roadmap/phase-3-connectivity-and-routing.md`
- `plan/2026-08-07-execute-phase-3/`
- `plan/log.md`

## Read-Only Files

- Project/Document v1 schema and accepted Phase 0 ADRs unless deterministic
  evidence proves an existing invariant is insufficient
- `packages/spice/` and Phase 2 source/corpus goldens
- `docs/overall-product-plan.md`
- Phase 4-7 roadmap files
- `lib/circuit.vss`, `netlists/`, and `.reference-src/`
- previous-converter automatic layout, routing, Page Scene, and rendering code

## Shared Dependencies

- Logical Net membership is electrical truth. Route deletion or geometry never
  removes terminals or ports from a Net.
- Visible connectivity is derived exclusively from explicit Route endpoints
  and Junction objects. Polyline intersection alone never unions components.
- Endpoint coordinates derive from placed Symbol pins, positioned ports, or
  Junction positions and are never persisted separately.
- Flightlines, visible components, crossing diagnostics, wire drafts,
  selection, and previews remain derived/session state.
- Formal SVG contains routes and explicit Junction dots but excludes
  flightlines, hit targets, diagnostics, and tool previews.
- GUI route operations commit typed transactions through `DocumentHistory`.
  Preview and hit testing do not mutate the Document.

## Expected Work

1. Accept the connectivity/routing specification with endpoint, component,
   flightline MST, orthogonal normalization, crossing, Junction, lock, stretch,
   and detach contracts.
2. Add `@icm/derived` for endpoint coordinates, explicit per-net visible graph,
   deterministic components/MST flightlines, route polylines, crossings, and
   local endpoint-stretch proposals.
3. Add typed `set_route_points`, `add_junction`, `remove_junction`, and
   `make_flightline` edits with atomic split, membership, orthogonality,
   segment-mode, and locked-route preflight.
4. Render deterministic formal routes/Junctions and derived editor flightlines.
5. Add a hand-authored routing fixture whose two independent nets cross at a
   geometric X without connecting.
6. Add Wire and Junction tool state, route/Junction hit targets, selection,
   Stretch, Detach, and move-with-local-stretch behavior to the editor.
7. Add graph, MST, crossing, normalization, atomic split, lock, detach, render
   golden, component, and Playwright acceptance tests.
8. Run the full Phase 3 exit gate and record completion evidence only if
   topology remains explicit and every derived result is deterministic.

## Validation

- `pnpm install --frozen-lockfile`
- `pnpm format:check`
- `pnpm references:check`
- `pnpm typecheck`
- focused derived graph, endpoint, MST tie-break, crossing, and stretch tests
- focused Edit Engine route membership, orthogonality, atomic split, lock,
  removal, dry-run, and rollback tests
- Project schema validation before and after every routing edit
- route/Junction SVG golden and explicit absence of flightline overlays
- Playwright Wire, crossing, Junction, Move/stretch, Detach, and flightline
  update scenarios
- `pnpm test`
- `pnpm build`
- `pnpm test:e2e`
- Markdown relative-link and fence checks
- product/reference coupling inspection
- `git diff --check`
- `git status --short --branch`

The target changes a shared edit union, a new derived package, formal rendering,
and browser tools, so focused verification is followed by full workspace and
browser gates.

## Experience Signal (for human review)

None at target start. No experience note will be extracted automatically.

## Commit Intent

Commit as:

```text
Complete Phase 3 connectivity and routing
```

## Outcome

- Added deterministic endpoint, component, MST flightline, route-polyline,
  crossing, normalization, and local-stretch derivation in `@icm/derived`.
- Added typed Route/Junction/detach edits with atomic validation, locks, and
  history context, then exercised them through the native-SVG editor.
- Added a canonical two-Net crossing fixture, formal route/Junction rendering,
  upright labels, 61 total tests, and a complete Playwright routing flow.
- Browser inspection confirmed independent crossings render without dots,
  editor-only flightlines remain overlays, labels remain readable, and the
  formal layer stays monochrome.

No implementation from the previous converter's automatic layout, routing,
Page Scene, renderer, or workflow was migrated.
