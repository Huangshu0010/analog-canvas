---
status: completed
experience: none
---

# Consume resolved routing geometry in stretch planning

## Goal

Use the resolved document geometry contract as the source of existing route
centerlines for direct wire-segment drag and local stretch proposals, without
changing mutation semantics or route storage.

## State and Ownership

Start state from `git status --short --branch`:

```text
## roadmap/connectivity-routing-debugging...origin/roadmap/connectivity-routing-debugging
```

The worktree is clean. This target owns read inputs to derived stretch
proposals. `routes.ts` normalization/move primitives and Edit Engine mutation
remain read-only shared dependencies.

- `packages/derived/src/stretch.ts`
- `packages/derived/src/stretch.test.ts`
- `plan/2026-08-12-connectivity-recovery-c3i/plan.md`
- `plan/log.md`

## Work

1. Resolve the source document once per drag/stretch proposal run.
2. Convert only the required resolved centerline/segment modes at the legacy
   mutation primitive boundary.
3. Preserve existing direct drag and local/group stretch regressions.

## Validation

- focused stretch tests
- workspace typecheck
- `git diff --check` and status

## Commit Intent

```text
refactor(derived): consume resolved route geometry in stretch
```

## Outcome

Wire segment drag and local stretch now resolve the source document once and
derive their mutable input only at the existing pure mutation primitive
boundary. Route persistence and mutation semantics are unchanged.

Validation passed: 15 focused stretch/geometry tests, workspace typecheck,
targeted Prettier, and `git diff --check`.
