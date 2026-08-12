---
status: completed
experience: none
---

# Consume resolved routing geometry in visual diagnostics

## Goal

Make visual route diagnostics consume one resolved document geometry pass rather
than independently resolving each route, while preserving diagnostic facts and
their deterministic order.

## State and Ownership

Start state from `git status --short --branch`:

```text
## roadmap/connectivity-routing-debugging...origin/roadmap/connectivity-routing-debugging
```

The worktree is clean. This target owns visual read diagnostics and their
regressions only. Route primitive, mutation planner and renderer stay
read-only.

- `packages/derived/src/visual.ts`
- `packages/derived/src/visual.test.ts`
- `plan/2026-08-12-connectivity-recovery-c3h/plan.md`
- `plan/log.md`

Shared: `resolved-route-geometry.ts` is consumed without contract changes.

## Work

1. Resolve document routing geometry once per visual diagnosis run.
2. Route quality, short-segment and ambiguous-junction checks consume the
   common centerlines.
3. Preserve route diagnostic compatibility with a focused fixture regression.

## Validation

- focused derived visual/geometry tests
- workspace typecheck
- `git diff --check` and status

## Commit Intent

```text
refactor(derived): consume resolved route geometry in visuals
```

## Outcome

Visual route-quality, short-segment and ambiguous-junction diagnostics now
share one document-level resolved geometry pass. Existing diagnostic facts and
ordering remain covered by the visual regression suite.

Validation passed: 16 focused visual/geometry/diagnostic tests, workspace
typecheck, targeted Prettier, and `git diff --check`.
