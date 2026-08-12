---
status: completed
experience: none
---

# Plan group-move routing edits in Edit Engine

## Goal

Move the committed group-move route, Junction, annotation and instance edit
assembly into the Edit Engine routing planner. The editor retains Snap-derived
optional endpoint connection as an interaction decision.

## State and Ownership

Start state from `git status --short --branch`:

```text
## roadmap/connectivity-routing-debugging...origin/roadmap/connectivity-routing-debugging
```

The worktree is clean. This target owns committed group movement assembly only;
Snap candidate selection and transaction execution remain editor/session work.

- `packages/edit-engine/src/routing-planner.ts`
- `packages/edit-engine/src/routing.test.ts`
- `apps/editor/src/app/App.tsx`
- `plan/2026-08-12-connectivity-recovery-c5b/plan.md`
- `plan/log.md`

Shared: derived `proposeGroupMove()` remains the geometry/topology planner and
is adapted to typed transaction edits here.

## Work

1. Add an engine-level group move edit proposal.
2. Replace editor-side route/Junction/annotation edit assembly.
3. Cover the proposal through a transaction regression and focused browser flow.

## Validation

- focused routing and editor group-move tests
- workspace typecheck
- `git diff --check` and status

## Commit Intent

```text
refactor(routing): plan group move edits in engine
```

## Outcome

The group-move route/Junction/annotation/instance edit assembly now lives in
the Edit Engine routing planner. The editor appends only an interaction-owned,
Snap-derived optional endpoint connection.

Validation passed: 32 focused routing/stretch tests, two focused editor group
move E2E flows, workspace typecheck, targeted Prettier, and `git diff --check`.
