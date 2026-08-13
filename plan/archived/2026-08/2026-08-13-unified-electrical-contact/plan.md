---
status: completed
experience: none
---

# Unify Electrical Contact Authoring and Presentation

## Goal

Establish one canonical contact protocol for Wire completion, component
placement, component movement, and contact-dot rendering. It must allow clear
MOS pin-to-pin loops, connect a pin dropped onto an existing conductor by
splitting/reusing Route topology, preserve crossings and genuine ambiguity,
and keep connected wiring orthogonal while devices move.

## State and Ownership

Start state from `git status --short --branch` in the isolated worktree:

```text
## codex/unified-electrical-contact...origin/main
```

The worktree is clean and starts at `origin/main` commit `2d4a527`. The
original worktree's separate branch is not modified.

Owned paths:

- `packages/derived/src/contact.ts`
- `packages/derived/src/contact-target.ts`
- `packages/derived/src/contact.test.ts`
- `packages/derived/src/index.ts`
- `packages/edit-engine/src/routing-planner.ts`
- `packages/edit-engine/src/transaction.ts`
- `packages/agent-adapter/src/service.ts`
- `fixtures/agent-api/agent-circuit-request.schema.json`
- `fixtures/agent-api/agent-circuit.openapi.json`
- `packages/edit-engine/src/routing.test.ts`
- `packages/render-svg/src/render.ts`
- `packages/render-svg/src/render.test.ts`
- `fixtures/visual-golden/phase-1-manual.svg`
- `fixtures/visual-golden/phase-3-crossing.svg`
- `fixtures/visual-golden/phase-5-dense-analog.svg`
- `apps/editor/src/app/App.tsx`
- `apps/editor/src/features/component-insert/placement-connectivity.ts`
- `apps/editor/src/features/component-insert/placement-connectivity.test.ts`
- `apps/editor/src/snap/engine.ts`
- `apps/editor/src/snap/engine.test.ts`
- `apps/editor/src/snap/candidates.ts`
- `apps/editor/src/snap/candidates.test.ts`
- `apps/editor/e2e/manual-editor.spec.ts`
- `docs/specs/connectivity-and-routing.md`
- `docs/specs/editor-interaction.md`
- `plan/2026-08-13-unified-electrical-contact/plan.md`
- `plan/log.md`

Shared contracts:

- Project schema and Route/Junction edit kinds remain unchanged.
- `ResolvedDocumentRoutingGeometry`, visible connectivity, and the typed Edit
  Engine transaction remain the authoritative geometry/topology boundaries.
- Existing crossing, route-anchor, bulk-route, clipboard, delete, highlight,
  and imported-flightline behavior must remain intact.

## Work

1. Introduce a canonical point-contact read model that groups coincident raw
   pin/Junction/Route candidates by actual visible conductor, distinguishing
   storage partitions from genuine multi-conductor crossings.
2. Route Wire completion through that model so pin plus incident Route and
   Route-corner duplicates do not create false ambiguity, while different
   conductors remain explicit.
3. Add one typed `attach_endpoint_to_route` primitive and shared
   placement/move proposals that support pin-to-Route splitting and multiple
   independent, non-conflicting contacts in one atomic transaction. This is a
   deliberate shared Edit Engine contract expansion: the endpoint becomes the
   common endpoint of the split Route halves, so subsequent instance movement
   follows the same topology without a decorative/coincident Junction.
4. Derive contact markers from committed topology and render dots for explicit
   terminal contacts/branches without persisting decorative Junctions or
   dotting ordinary bends, crossings, and hollow Ports.
5. Verify connected-device movement follows its authored Route endpoints and
   add regressions for MOS G-D loops, device-on-wire placement/move, contact
   dots, crossings, route corners, and multi-pin ambiguity.

## Validation

- `pnpm test:local packages/derived/src/contact.test.ts packages/edit-engine/src/routing.test.ts packages/render-svg/src/render.test.ts apps/editor/src/features/component-insert/placement-connectivity.test.ts apps/editor/src/snap/engine.test.ts`
- `pnpm test:e2e:local apps/editor/e2e/manual-editor.spec.ts --grep "contact|Gate|wire|connected component"`
- `pnpm verify:branch`
- `git diff --check`
- `git status --short --branch`

## Commit Intent

Commit as bounded implementation and validation records under:

```text
refactor(connectivity): unify electrical contact authoring
```

## Outcome

Implemented one conductor-aware contact target model and the typed
`attach_endpoint_to_route` transaction primitive. Wire completion now groups
raw hits by visible routed component; component placement/movement can split a
Route around a real terminal endpoint; connected split halves follow later
instance movement orthogonally; and the renderer derives terminal contact dots
without dotting hollow Ports or crossings. Component placement capture was
also centralized so Route/annotation hit overlays cannot swallow a placement
click.

Validation passed:

- focused unit contracts: 75 tests across contact, routing, rendering,
  placement, and snap behavior;
- targeted browser regressions: 5 tests covering MOS Gate-to-Drain, Route
  crossing/Junction behavior, route stretch/deletion, and component-on-Route
  placement plus movement;
- generated Agent API artifact check;
- `pnpm verify:branch`: 110 files / 675 tests, workspace build, and production
  preview smoke;
- `git diff --check` and final status review.
