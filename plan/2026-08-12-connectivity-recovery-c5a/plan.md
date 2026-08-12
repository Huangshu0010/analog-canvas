---
status: completed
experience: none
---

# Move committed wire manipulation planning into Edit Engine

## Goal

Make committed segment drag and loose-route translation use typed Edit Engine
routing proposals rather than letting the editor assemble topology edits. The
editor retains transient preview only.

## State and Ownership

Start state from `git status --short --branch`:

```text
## roadmap/connectivity-routing-debugging...origin/roadmap/connectivity-routing-debugging
```

The worktree is clean. This target owns the two committed wire manipulation
paths and their planner tests. Group move and pointer-preview geometry remain
outside this bounded target.

- `packages/edit-engine/src/routing-planner.ts`
- `packages/edit-engine/src/routing.test.ts`
- `apps/editor/src/app/App.tsx`
- `plan/2026-08-12-connectivity-recovery-c5a/plan.md`
- `plan/log.md`

Shared: derived stretch proposals remain the topology-aware source; transaction
validation remains the sole mutation boundary.

## Work

1. Add typed planner proposals for segment move and whole loose-route move.
2. Commit their returned edits directly from the editor.
3. Cover loose route translation and anchored segment drag through the planner.

## Validation

- focused Edit Engine routing and editor route-drag tests
- workspace typecheck
- `git diff --check` and status

## Commit Intent

```text
refactor(routing): plan committed wire manipulation in engine
```

## Outcome

Committed segment drag and loose-route translation now receive typed Edit
Engine proposals. The editor continues to own only pointer preview/session;
topology edits are planned in the same module as Wire and Delete proposals.

Validation passed: 31 focused routing/stretch tests, two focused editor E2E
flows, workspace typecheck, targeted Prettier, and `git diff --check`.
