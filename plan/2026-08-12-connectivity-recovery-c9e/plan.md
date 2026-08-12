---
status: completed
experience: none
---

# Preserve routing diagnostics as an independent workbench domain

## Goal

Classify route-quality observations in the unified diagnostic adapter as
`routing`, distinct from layout/symbol `visual`, while retaining the existing
visual producer and locator/navigation behavior.

## State and Ownership

Start state from `git status --short --branch`:

```text
## roadmap/connectivity-routing-debugging...origin/roadmap/connectivity-routing-debugging
```

The worktree is clean. This target owns only the envelope adapter and its
contract tests; visual diagnostic production and editor UI are read-only
consumers of the existing domain filter.

- `packages/derived/src/diagnostics/diagnostic.ts`
- `packages/derived/src/diagnostics/diagnostic.test.ts`
- `docs/roadmap/connectivity-recovery-status.md`
- `plan/2026-08-12-connectivity-recovery-c9e/plan.md`
- `plan/log.md`

## Work

1. Establish the explicit routing observation code set at the adapter boundary.
2. Emit `domain: routing` for those facts and retain `visual` for all others.
3. Record that routing now participates in domain filtering/navigation.

## Validation

- focused diagnostic and selection workbench tests
- workspace typecheck
- `git diff --check` and status

## Commit Intent

```text
feat(diagnostics): classify routing observations separately
```

## Outcome

The envelope adapter now assigns the documented `routing` domain to route
quality facts while keeping layout/symbol observations in `visual`. Existing
workbench filtering and navigation consume the domain without UI duplication.

Validation passed: 14 focused diagnostic/selection/visual tests, workspace
typecheck, targeted Prettier, and `git diff --check`.
