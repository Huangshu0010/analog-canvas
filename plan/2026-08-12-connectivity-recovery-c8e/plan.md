---
status: completed
experience: none
---

# Aggregate stale hierarchy interface diagnostics

## Goal

Add the roadmap's `ERC_HIERARCHY_INTERFACE_STALE` diagnostic for a changed
child Cell interface: primary navigation must land on the mismatched child
interface and related locators must identify every stale caller instance.

## State and Ownership

Start state from `git status --short --branch`:

```text
## roadmap/connectivity-routing-debugging...origin/roadmap/connectivity-routing-debugging
```

The worktree is clean. Existing per-instance count/name mismatch diagnostics
remain intact for compatibility. This target adds an aggregate, deterministic
ERC view over the same persisted hierarchy link; schema and navigation are
read-only dependencies.

- `packages/derived/src/diagnostics/erc.ts`
- `packages/derived/src/diagnostics/erc.test.ts`
- `plan/2026-08-12-connectivity-recovery-c8e/plan.md`
- `plan/log.md`

## Work

1. Collect valid parent-instance to child-Cell links deterministically.
2. Aggregate incompatible pin/port interfaces per child Cell.
3. Emit a locator at the first mismatched child port (or child document) with
   all incompatible caller instances as related locations.

## Validation

- focused ERC Vitest and workspace typecheck
- `git diff --check` and status

## Commit Intent

```text
feat(erc): aggregate stale hierarchy interfaces
```

## Outcome

Added deterministic `ERC_HIERARCHY_INTERFACE_STALE` aggregation. It retains
the existing per-instance count/name evidence while centering repair navigation
on the child port (or child document when no port is unmatched) and listing all
incompatible callers as related locators. Focused ERC tests and workspace
typecheck passed.
