---
status: completed
experience: none
---

# Unify Instance and Route Move Planning

## Goal

Make component/group movement deterministic by giving explicit Route geometry
one transaction-wide authority, while deriving internal wiring from connected
Route components instead of treating every Route on a logical Net as one
movable block.

## State and Ownership

Start state from `git status --short --branch`:

```text
## codex/wire-move-consistency
```

The worktree is clean after commit `6aa57cd`. The isolated worktree remains
separate from the unrelated dirty authoring-input target in the original path.

- `packages/edit-engine/src/transaction.ts`
- `packages/edit-engine/src/routing-planner.ts`
- `packages/edit-engine/src/routing.test.ts`
- `packages/derived/src/stretch.ts`
- `packages/derived/src/stretch.test.ts`
- `docs/adr/0009-move-stretches-connected-routes.md`
- `docs/specs/connectivity-and-routing.md`
- `plan/2026-08-13-move-planner-consistency/plan.md`
- `plan/log.md`

Read-only consumers checked for compatibility:

- `apps/editor/src/app/App.tsx`
- `apps/editor/src/features/clipboard/clipboard.ts`

Shared contracts are the typed edit transaction, Route endpoint identity, and
the existing single-instance/group/segment/whole-route gestures. No Project
schema or public edit kind is added.

## Work

1. Predeclare all explicitly authored Route geometries in a transaction and
   suppress automatic instance route-follow for those Route IDs. Group moves
   emit explicit geometry only for Routes incident to a moved Junction; the
   Engine remains authoritative for terminal-follow geometry.
2. Replace Net-wide internal group selection with connected Route-component
   closure: a component moves only when it contains a selected terminal and
   contains no port or terminal owned by an unselected instance.
3. Keep Net annotations conservative: they move only when the complete logical
   Net remains internal, while Route/Junction annotations follow the movable
   component.
4. Add order-independence, disconnected-same-Net, and boundary-branch
   regressions; update the movement contract without removing existing tools.

## Validation

- `corepack pnpm exec vitest run packages/derived/src/stretch.test.ts packages/edit-engine/src/routing.test.ts`
- `corepack pnpm typecheck`
- `corepack pnpm build`
- `git diff --check`
- `git status --short --branch`

## Commit Intent

Commit as:

```text
fix(routing): unify move and route geometry ownership
```

## Outcome

Group movement now has one geometry owner per Route. Terminal-follow stays in
the Edit Engine; plans emit explicit geometry only for Routes incident to a
moved Junction, and those explicit Route IDs are excluded from automatic
follow. Internal Route/Junction movement is based on actual connected
components, while logical-Net annotations retain the stricter whole-Net rule.
The 36 focused routing/stretch tests, consumer checks, all 620 unit tests,
typecheck, and build validations passed.
