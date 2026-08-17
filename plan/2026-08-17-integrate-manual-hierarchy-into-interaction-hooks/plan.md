---
status: active
experience: none
---

# Integrate manual hierarchy with interaction Hooks

## Goal

Merge the latest `origin/main` manual hierarchical Cell editing feature into
the completed interaction-Hook branch without losing either behavior.

## State and Ownership

Start state from `git status --short --branch`:

```text
## codex/app-transaction-module-layers...origin/codex/app-transaction-module-layers
?? .worktrees/
```

The untracked `.worktrees/` directory is pre-existing workspace infrastructure
and does not overlap this target. This target owns merge integration and its
records:

- `apps/editor/src/app/App.tsx`
- `apps/editor/src/features/**` only if the merge requires an import or Hook
  boundary correction
- `plan/2026-08-17-integrate-manual-hierarchy-into-interaction-hooks/plan.md`
- `plan/log.md`
- `plan/root-audit.md`

Shared dependencies are `useInteractionState`, `useSelectionController`,
document transactions, and the manual-hierarchy contract introduced by
`origin/main` commit `0975466`. Existing plans and the persisted protocol are
read-only.

## Work

1. Merge `origin/main` and identify every conflict.
2. Preserve manual Cell extraction/editing while retaining the five domain
   Hooks as the single interaction owners.
3. Run hierarchy and affected interaction browser regressions, then the
   branch verification gate.

## Validation

- `pnpm test:local apps/editor/src/app/App.test.tsx`
- `pnpm test:e2e:local apps/editor/e2e/manual-editor.spec.ts --grep "hierarchy|Cell|rectangle"`
- affected selection/wire/placement browser scenarios
- `pnpm verify:branch`
- `pnpm test:impact -- --base origin/main`
- `git diff --check`
- `git status --short --branch`

## Test Impact

- Decision: no-test-change
- Reason: this integration preserves two already-tested behavior sets; existing
  hierarchy and interaction browser contracts exercise the merged wiring.

## Commit Intent

Commit as:

```text
merge: integrate manual hierarchy with interaction hooks
```

## Outcome

Pending merge and validation.
