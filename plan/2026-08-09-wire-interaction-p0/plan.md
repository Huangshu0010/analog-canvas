# Wire interaction P0

## Goal

Finish the P0 manual-wiring reliability work: route/bend taps create an
electrical junction deterministically, Wire mode ignores selectable visual
overlays, and users can distinguish electrical deletion from removal of only
route geometry (flightline).

## Dirty-state decision

The worktree is dirty. `apps/editor/src/App.tsx` and `styles.css` contain
parallel hierarchy/drafting/help work; model, derived, SPICE, e2e, fixtures,
and unrelated plans are also dirty. The user explicitly resumed the P0 editor
work after the parallel UI work completed. This target will make only narrow,
located P0 changes in `App.tsx`/`styles.css`; it will not reformat, revert, or
stage unrelated hunks. The existing edit-engine routing contract is currently
clean and may be changed only with focused tests.

## Ownership

- Own: `apps/editor/src/App.tsx`, `apps/editor/src/styles.css`,
  `packages/edit-engine/src/transaction.ts`, focused edit-engine/editor tests,
  this plan, and `plan/log.md`.
- Read-only: model schema, connectivity/flightline derivation, formal renderer,
  all current visual-style/reference assets, importer/SPICE changes, hierarchy
  and Help work, and unrelated plans.
- Shared contracts: route endpoint/Junction model, `make_flightline`,
  `connect_endpoints`, `disconnect_endpoint`, derived connectivity and
  flightlines.

## Intended work

1. Replace exact-coordinate route hit testing with a deterministic resolver
   that projects the pointer onto an orthogonal route, snaps a nearby bend to
   its exact waypoint, and handles a shared bend once. Wire stops on a route or
   ordinary bend will split it and create/reuse a junction; crossings remain
   unconnected unless the user stops there.
2. Give Wire mode a dedicated input plane and disable instance/annotation/
   drafting hit overlays while wiring, while retaining route and endpoint hit
   priority. All free space remains a valid wire click.
3. Preserve `make_flightline` as explicit **Unroute** behavior. Make
   Delete/Backspace on a selected, isolated terminal/port-to-terminal/port
   route remove its electrical connection rather than silently leaving a
   flightline. Current Nets lack persistent connection-edge provenance, so
   routes involving a junction or another attached route will be rejected with
   a clear message rather than guessed at, silently retaining a Net, or
   incorrectly partitioning an imported SPICE Net. A future connection-edge
   model can remove that deliberately conservative limit.
4. Add focused regression coverage for bend taps, overlay pass-through, and
   Delete vs Unroute.

## Invariants

- A crossing without a stop never creates a connection.
- A visible junction is created only when a new branch is made; an existing
  degree-two bend remains an invisible snap target.
- Removing route geometry preserves electrical connectivity and intentionally
  produces flightlines; deleting a route removes its electrical relationship.
- Wire tool target resolution is independent of annotation z-order.
- Do not alter SPICE import/export or visual style assets.

## Validation

Run focused edit-engine and editor tests, editor build/typecheck as applicable,
then `git diff --check` and `git status --short --branch`. Record exact results
in `plan/log.md`. Commit only intentional P0 hunks/files.

## Commit intent

`feat(editor): make manual wire taps and deletion topology-aware`

## Outcome

- Replaced the exact-equality route test with a screen-pixel-tolerant nearest
  projection resolver. Internal route waypoints are preferred as virtual snap
  targets, so a near-bend tap is persisted at the exact bend coordinate.
- Added a Wire-only canvas input plane. Selection overlays use a wire-mode CSS
  override (rather than ineffective SVG presentation attributes) so labels,
  instances, guides, and drafting shapes cannot steal a wire click. Route hits
  are now above component hit boxes and below endpoints/annotations.
- Extended `splitRoute` to materialize a Junction at an existing waypoint
  without creating a zero-length segment. This is the engine counterpart to
  the virtual-bend UI snap.
- Added explicit **Delete electrical connection** and **Unroute (keep
  electrical connection)** route actions. Delete is intentionally limited to
  isolated terminal/port routes; branched/shared routes are rejected with a
  clear message because the current Net model lacks persistent connection-edge
  provenance.
- Focused browser coverage passes for label pass-through, a 5px route tap,
  Delete versus Unroute, and a 3px off-axis bend tap. Engine coverage passes
  for endpoint and waypoint splitting.

## Validation result

- Passed: focused Playwright P0 set, 3/3.
- Passed: `packages/edit-engine/src/routing.test.ts`, 10/10.
- Passed: `pnpm --filter @icm/editor build`, focused Prettier, and
  `git diff --check`.
- Blocked outside this target: workspace typecheck and the editor SSR test
  fail in parallel hierarchy/Razavi changes (`sourceBinding.sourceRef`,
  drafting-object narrowing, model enum/render catalog errors). The existing
  routing-demo Playwright case also currently expects the now-moved More-menu
  command. Neither was changed here.
