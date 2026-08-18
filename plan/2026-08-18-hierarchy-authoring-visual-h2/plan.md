---
status: completed
experience: none
---

# Hierarchy authoring and visual H2: unified Cell placement

## Goal

Make placement of an existing Cell use the same pending cursor-placement
interaction as every normal component, including grid preview, rotation,
mirror, cancel, selection, default reference label, and Cell-name value
annotation. Preserve the existing subcircuit Instance and Project structural
transaction contracts.

## State and Ownership

Start state from `git status --short --branch`:

```text
## codex/hierarchy-authoring-visual-plan...origin/codex/hierarchy-authoring-visual-plan
?? .worktrees/
```

`.worktrees/` is pre-existing untracked workspace infrastructure and remains
untouched. This target owns the editor insert/pending-placement and hierarchy
instance construction modules, rectangle-conversion parity, their unit/E2E
tests, user interaction documentation, target plan/log/root-audit records.
Schema-13 geometry, Agent protocol, Cell Port authoring, and Cell Manager
surfaces are read-only dependencies.

## Work

1. Generalize the shared pending-placement controller with an explicit Cell
   placement factory rather than a separate centre-placement command.
2. Create hierarchy Instance `Xn` and Cell-name annotations through the shared
   instance annotation protocol and commit through the Project transaction.
3. Replace the prompt-and-centre `Place Cell` path with selection into the
   normal Insert dialog/preview, and make rectangle conversion use the same
   factory where its context permits.
4. Add focused helper and browser regressions for preview, transform, cancel,
   commit, annotations, undo/redo, and save/reopen.

## Validation

- focused editor/unit and hierarchy Playwright tests
- `pnpm docs:check`
- `pnpm test:impact -- --base origin/main`
- `git diff --check`
- package build/typecheck; expand to `pnpm verify:branch` before delivery

## Test Impact

- Decision: tests-updated
- Contracts: one pending-placement interaction for built-in and Cell symbols;
  hierarchy commit remains atomic/undoable and annotations remain ordinary
  object-anchored RichText.
- Primary checks: component-placement/hierarchy unit tests, hierarchy browser
  workflows, `pnpm verify:branch`.

## Commit Intent

Commit as:

```text
feat(editor): place Cells through shared component placement
```

## Outcome

Completed shared Cell placement without adding a hierarchy-specific canvas
mode. **Place Cell** opens the ordinary Insert dialog in its focused Cells
view; choosing a Cell enters the established pending-placement reducer with
preview, grid snap, rotation, mirror, repeated placement, and cancellation.
The commit factory creates the typed subcircuit Instance and ordinary
object-anchored `Xn`/Cell-name annotations through a Project transaction.
Rectangle conversion now shares the same hierarchy Instance factory.

Validation passed: focused 3-file Vitest (16 tests), hierarchy Playwright
(2 scenarios), `pnpm typecheck`, `pnpm docs:check`,
`pnpm test:impact -- --base origin/main`, `git diff --check`, and
`pnpm verify:branch` (144 files / 880 tests, workspace build, production
smoke).
