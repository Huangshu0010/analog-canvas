---
status: completed
experience: none
---

# Add Library Examples

## Goal

Add a consistent left-Library Examples section that presents the two supplied
schema-11 Projects as named, single-column, larger cards and opens a selected
Project directly in the editor.

## State and Ownership

Start state from `git status --short --branch` before creating the target
branch:

```text
## codex/device-protocol-compatibility-plan...origin/codex/device-protocol-compatibility-plan
?? .worktrees/
```

The untracked `.worktrees/` directory is an unrelated existing worktree and
will remain untouched. This target is isolated on
`codex/library-examples`. The supplied downloads are read-only source assets;
their repository copies and the Editor Library surface are owned by this
target.

- `apps/editor/src/examples/`
- `apps/editor/src/examples/library-examples.test.ts`
- `apps/editor/src/features/editor-shell/shapes-panel.tsx`
- `apps/editor/src/features/editor-shell/shapes-panel.test.ts`
- `apps/editor/src/app/App.tsx`
- `apps/editor/src/app/App.test.tsx`
- `apps/editor/src/styles.css`
- `apps/editor/e2e/component-insert.spec.ts`
- `plan/2026-08-17-library-examples/plan.md`
- `plan/log.md` (close-out entry only)
- Read-only: `E:/Downloads/{1,2}New Circuit.icproj.json`, current Project
  protocol and document-controller replacement boundary

## Work

1. Package and validate the two supplied schema-11 Projects as browser-bundled
   examples with descriptive names.
2. Add an Examples fold to the left Library with one named, full-width card per
   row, visually aligned with existing Library controls.
3. Route card selection through the existing validated Project replacement and
   recovery lifecycle, then preserve responsive Library behavior.
4. Cover the Examples display and open flow with focused unit and browser
   tests.

## Validation

- `pnpm test:local` for affected Editor and Project/example contracts
- `pnpm test:e2e:local apps/editor/e2e/component-insert.spec.ts --grep <Examples flow>`
- `pnpm test:impact -- --base origin/codex/device-protocol-compatibility-plan`
- `git diff --check`
- `git status --short --branch`

## Test Impact

- Decision: tests-updated
- Contracts: bundled Project examples stay schema-valid; each named Library
  card replaces the current Project only through the established open lifecycle.
- Primary checks: Editor panel/App tests and the Library browser flow.

## Commit Intent

Commit as:

```text
feat(editor): add Library project examples
```

## Outcome

Bundled the two supplied schema-11 Projects as named Library examples. The
Examples fold now appears above All devices, uses one larger full-width card
per row, and opens a fresh Project clone through the existing dirty-recovery
and Project replacement lifecycle. The card visual layout was checked in the
running Editor at desktop width; both full names are visible.

Validation passed:

- `pnpm test:local apps/editor/src/examples/library-examples.test.ts apps/editor/src/features/editor-shell/shapes-panel.test.ts apps/editor/src/app/App.test.tsx`
  (3 files, 19 tests)
- `pnpm test:e2e:local apps/editor/e2e/component-insert.spec.ts --grep "opens named full-width Project examples from Library"`
  (1 browser test)
- `pnpm test:impact -- --base origin/codex/device-protocol-compatibility-plan`

Commit status: committed and pushed as
`feat(editor): add Library project examples` on `codex/library-examples`.
