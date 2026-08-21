---
status: completed
experience: none
---

# Imported Reference Default Display

## Goal

Make every imported instance's existing reference visible by default when it is
placed from the Placement Tray, regardless of whether it is placed singly,
dragged, or placed through Place all.

## State and Ownership

Start state from `git status --short --branch`:

```text
## codex/schematic-instance-lifecycle-ux
?? .pnpm-store/
?? .worktrees/
```

The tracked worktree is clean. The untracked local dependency/worktree paths
are outside this target and will remain untouched.

- `apps/editor/src/features/instance-display/`
- `apps/editor/src/features/component-insert/`
- `apps/editor/src/app/App.tsx`
- focused editor tests and `plan/log.md`

Shared: imported SPICE instances retain their electrical `netlist.reference`
and schema-17 schematic reference; this target creates only their missing
visual Reference projections on placement.

## Work

1. Add one display helper that derives only missing default Reference/formal
   Port labels for a placed retained instance, preserving existing user labels.
2. Use it for single Placement Tray placement, drag/drop, and Place all.
3. Add regression coverage for imported-style references across the shared
   default-label and placement paths.

## Validation

- `pnpm test:local <affected editor tests>`
- `pnpm test:e2e:local <affected spec> --grep <pattern>` where practical
- `pnpm test:impact -- --base origin/main`
- `git diff --check`
- `git status --short --branch`

## Test Impact

- Decision: tests-updated
- Contracts: a retained instance with a reference receives one visible default
  Reference projection on placement; existing labels remain authoritative.
- Primary checks: default display, retained-placement, App tray, and browser
  import-placement contracts.

## Commit Intent

Commit as:

```text
fix(editor): show imported references on placement
```

## Outcome

Added one placement-time helper that creates only missing default Reference and
formal-Port labels. Single Tray placement, canvas drag/drop, and Place all now
use it, so imported instance references become visible on the first placement
without replacing existing user-owned label projections.

Validation passed: focused editor unit contracts (3 files / 18 tests), the
SPICE import then Place all browser regression (1 test), typecheck, format,
test-impact, and diff checks.
