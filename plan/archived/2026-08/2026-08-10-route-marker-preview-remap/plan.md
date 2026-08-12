---
status: completed
experience: none
---

# Route Marker Preview And Remap

## Goal

Keep junctions and route-attached annotations visually synchronized throughout
group drag, and preserve a current marker's meaningful physical location when
its route is changed from a simple segment into a multi-segment polyline.

## State and Ownership

Start state from `git status --short --branch`:

```text
## codex/insert-component-dialog...origin/codex/insert-component-dialog
```

The worktree is clean at `8dd3999`. This target follows the unified movement
work and owns the preview/remapping seam that the user's denser-route example
exposed.

- `apps/editor/src/app/App.tsx`
- focused editor geometry/unit/E2E tests
- `packages/edit-engine/src/**` only if the canonical route transaction does
  not already remap route VisualAnchors
- `packages/derived/src/**` only for a pure physical-projection helper shared
  by route edits
- `docs/specs/editor-interaction.md`
- `plan/2026-08-10-route-marker-preview-remap/plan.md`
- `plan/log.md`

Shared dependencies:

- Model `VisualAnchor` and Route schemas remain unchanged; this is lifecycle
  behavior, not a new persisted protocol.
- Existing Snap Engine and `proposeGroupMove` remain the only group movement
  decision path.

## Work

1. Reproduce the stale junction/marker preview and multi-segment marker failure
   at the typed-edit and GUI levels.
2. Ensure group preview includes every junction and route-attached annotation
   that the resulting `proposeGroupMove` transaction will move.
3. On `set_route_points`, remap each marker on that Route from its pre-edit
   physical placement to the nearest valid post-edit segment, preserving
   direction and bounded normal offset instead of trusting a stale segment
   index.
4. Add simple-to-complex and complex-to-simple route regressions, live group
   preview checks, and real browser validation.

## Validation

- focused Derived/Edit Engine/editor unit tests
- focused Playwright flows for live preview and complex reroute
- `pnpm typecheck`
- `pnpm --filter @icm/editor build`
- proportional full Vitest and editor E2E suites
- in-app browser inspection
- `git diff --check`
- `git status --short --branch`

## Commit Intent

Commit as:

```text
fix(editor): preserve route markers through geometry edits
```

## Outcome

Completed without adding another persisted schema or GUI-only movement path.

- Group drag preview now translates internal Junctions and every route-attached
  marker that the canonical group transaction will move on pointer release.
- Route geometry edits capture the marker's old physical anchor and remap it
  onto the resulting polyline. Equal-distance candidates at a bend prefer the
  previous segment direction, preventing an arrow from changing orientation
  merely because a waypoint was inserted.
- Junction route splitting remaps markers to one of the two replacement Route
  ids, so no marker retains a reference to the removed Route.
- Validation passed: three affected production builds, repository typecheck,
  format check, 448 Vitest tests, 63 Playwright flows, in-app browser reload,
  and `git diff --check`.
- Commit status: ready to commit on `codex/insert-component-dialog` as
  `fix(editor): preserve route markers through geometry edits`.
