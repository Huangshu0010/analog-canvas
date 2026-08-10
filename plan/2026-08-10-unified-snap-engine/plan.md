---
status: completed
experience: none
---

# Unified Editor Snap Engine

## Goal

Replace the editor's disconnected grid, pin, Guide, and drafting snap helpers
with one permanent editor-owned Snap Engine. Use the same resolved result for
live preview and pointer-up commit, add transient alignment-extension feedback,
and keep snap state out of the persisted model, edit-engine protocol, and Agent
API.

## State and Ownership

Start state from `git status --short --branch`:

```text
## agent/fix-ci-baseline
```

The worktree is clean. The branch is five committed editor-refactor commits
ahead of `main`; those commits are treated as the current baseline because the
wire and interaction extractions are direct dependencies of this target. No
uncommitted user or worker files are present.

Owned paths:

- `apps/editor/src/snap/**`
- `apps/editor/src/App.tsx`
- `apps/editor/src/canvas-drag-session.ts`
- `apps/editor/src/canvas-drag-session.test.ts`
- `apps/editor/src/route-interaction-geometry.ts`
- `apps/editor/src/route-interaction-geometry.test.ts`
- focused editor interaction tests and styles needed for snap feedback
- `docs/specs/editor-interaction.md`
- this target plan and `plan/log.md`

Shared/read-only boundaries:

- Persisted Project/Document schemas remain unchanged.
- `packages/edit-engine`, Agent API, and wire connectivity semantics remain
  unchanged.
- Existing typed edits remain the sole commit boundary.

## Work

1. Define one editor Snap Engine with profiles, screen-pixel tolerance,
   axis-independent matches, deterministic priority, and transient guide
   evidence.
2. Build candidates for grid, persisted Guides, instance anchors/bounds/pins,
   electrical endpoints/routes, and drafting geometry without persisting snap
   session state.
3. Migrate instance/group movement, drafting movement/handles, Guide movement,
   and wire/drafting point acquisition to the shared engine. Remove superseded
   helpers as their callers migrate.
4. Make live preview and commit use the same resolver and render temporary
   alignment guides. Correct the explicit Align command to target the current
   selection.
5. Add focused regression tests for axis extension snap, Guide snap,
   zoom-invariant tolerance, moving-set exclusion, preview/commit parity, and
   profile-specific electrical behavior.

## Validation

- `pnpm exec vitest run apps/editor/src/snap apps/editor/src/route-interaction-geometry.test.ts apps/editor/src/App.test.tsx`
- `pnpm typecheck`
- `pnpm --filter @icm/editor build`
- `git diff --check`
- `git status --short --branch`

The editor-wide typecheck and build are justified because `App.tsx` is the
shared interaction entry point. The full workspace suite is not the default;
it will be added only if focused checks expose a shared-contract risk.

## Commit Intent

Commit as:

```text
feat(editor): unify snap and alignment interactions
```

## Outcome

Implemented one editor-owned Snap Engine and migrated instance/group movement,
Drafting movement and handles, Guide movement, Wire point acquisition, and grid
rounding to it. The resolver supports screen-pixel tolerance, capture
hysteresis, independent axis extension lines, exact compatible electrical
matches, profile-specific candidate policy, primary-object group snapping, and
pre-preview rejection of off-grid instance candidates. Snap feedback is painted
into an imperative transient SVG layer so it cannot invalidate the moving
formal SVG transform; live `Alt` state suppresses Snap without changing the
persisted model or edit protocol. The old `directPinSnap` implementation was
removed, and Align now targets the current selection.

Validation passed: 29 focused Vitest tests, repository typecheck, editor
production build, changed-file formatting, and `git diff --check`. The build's
existing large-chunk warning remains. Automated in-app browser access to the
loopback URL was unavailable; the user's live test exposed the transient-layer
and illegal-boundary regressions, both of which were corrected and covered by
focused tests.
