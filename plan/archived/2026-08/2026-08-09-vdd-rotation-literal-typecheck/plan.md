# Restore VDD placement transaction typecheck

## Goal

Repair the committed VDD placement transaction so its rotation literal satisfies
the typed edit contract and the workspace typecheck can run after the editor
label-selection target.

## Dirty-State Note

The worktree contains only unrelated untracked generated circuit artifacts,
historical plans, and a local probe. They do not overlap this one-line editor
target and will remain untouched.

## Owned Files

- `apps/editor/src/App.tsx`
- `plan/2026-08-09-vdd-rotation-literal-typecheck/plan.md`
- `plan/log.md`

## Read-Only Files

- `packages/edit-engine/src/transaction.ts`
- `packages/model/src/schema.ts`

## Shared Dependencies

- `SchematicEdit` requires rotation to be one of `0 | 90 | 180 | 270`.

## Expected Work

1. Preserve the VDD annotation behavior and narrow its literal rotation to the
   schema-compatible type.
2. Run workspace typecheck and the editor build.

## Outcome

- The VDD power-label annotation now declares `rotation: 0 as const`, matching
  the edit schema's rotation union without changing persisted geometry.
- Workspace typecheck and editor build pass.

## Validation

- `pnpm typecheck`
- `pnpm -C apps/editor build`
- `git diff --check`
- `git status --short --branch`

## Commit Intent

```text
fix(editor): type VDD label rotation literal
```
