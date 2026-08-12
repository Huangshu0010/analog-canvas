---
status: completed
experience: none
---

# Connectivity recovery C5a — Wire commit planner boundary

## Goal

Move deterministic wire-path and wire-commit proposal logic out of the editor
feature layer into a pure edit-engine planner. The editor continues to own
pointer sessions, snap candidate choice and UI ids; the planner owns only the
typed edit sequence submitted to the transaction engine.

## State and ownership

The worktree is clean after C4. This target owns a new edit-engine planner,
its export, the editor compatibility re-exports/tests, plan and log. It does
not change the persisted schema, transaction behavior, selection UI, delete
semantics or group stretch.

## Validation

Focused wire-path/wire-editing tests, workspace typecheck, Prettier and
`git diff --check`.

## Outcome

Moved the deterministic manual wire path, wire commit, free-end anchor and
route-tap anchor proposals into `@icm/edit-engine`. Editor feature modules are
now compatibility re-exports, preserving imports while keeping pointer/snap UI
outside the mutation planner. Delete, junction lifecycle and group stretch
remain separate C5 work rather than being silently folded into this refactor.

Validation: workspace typecheck; 16 focused wire-path, wire-editing and
transaction tests; targeted Prettier and `git diff --check`.
