---
status: completed
experience: none
---

# Move Examples Beside Library

## Goal

Present Examples as its own left-side panel selected from the far-left tool
rail alongside Library, rather than as a fold inside the Library device panel.

## State and Ownership

Start state from `git status --short --branch` before creating the target
branch:

```text
## main...origin/main
?? .worktrees/
```

The untracked `.worktrees/` directory is unrelated and will remain untouched.
This target is isolated on `codex/examples-rail` and owns the Editor's
Library/Examples panel composition and its direct coverage.

- `apps/editor/src/app/App.tsx`
- `apps/editor/src/app/App.test.tsx`
- `apps/editor/src/features/editor-shell/tool-icon.tsx`
- `apps/editor/src/features/editor-shell/shapes-panel.tsx`
- `apps/editor/src/features/editor-shell/shapes-panel.test.ts`
- `apps/editor/src/features/editor-shell/examples-panel.tsx`
- `apps/editor/src/features/editor-shell/examples-panel.test.ts`
- `apps/editor/src/styles.css`
- `apps/editor/e2e/component-insert.spec.ts`
- `plan/2026-08-17-examples-rail/plan.md`
- `plan/log.md` (close-out entry only)
- `plan/root-audit.md` (close-out entry only)

- Read-only: `apps/editor/src/examples/library-examples.ts`, the two bundled
  schema-11 projects, and the existing dirty-replacement lifecycle
- Shared: the left workspace grid, compact Library behavior, and Project-open
  recovery guard

## Work

1. Extract the examples display into an independent left panel while retaining
   the existing Project-open behavior.
2. Put a top-level Examples control in the far-left tool rail alongside
   Library and make the two controls switch the shared left-panel slot.
3. Preserve desktop and compact layout behavior, then cover the control
   placement and direct example-open path.

## Validation

- `pnpm test:local` for affected App/panel/example tests
- `pnpm test:e2e:local apps/editor/e2e/component-insert.spec.ts --grep <Examples panel>`
- `pnpm test:impact -- --base origin/main`
- `git diff --check`
- `git status --short --branch`

## Test Impact

- Decision: tests-updated
- Contracts: Examples is a separate left-panel surface reached by a far-left
  tool-rail button alongside Library; selecting an example still uses the guarded Project-open
  lifecycle.
- Primary checks: App/panel unit tests and the Examples browser workflow.

## Commit Intent

Commit as:

```text
feat(editor): move Examples beside Library
```

## Outcome

Moved the two bundled circuit examples out of the Library device panel and
into their own Examples panel. The Examples button now sits at the top of the
far-left tool rail, directly above Library, and its label remains fully visible
within the existing rail width. Selecting an example retains the guarded
Project-open lifecycle.

Validation passed:

- focused panel/App tests (3 files / 18 tests)
- focused Examples browser workflow
- `pnpm test:impact -- --base origin/main`
- `pnpm install --frozen-lockfile` and `pnpm ci:check` (137 test files / 819
  tests and 145 browser tests)
- all required GitHub Actions checks on PR #111
- desktop visual review of the tool-rail placement and panel switch

Commit status: integrated into `main` through PR #111 (`f7d961c`).
