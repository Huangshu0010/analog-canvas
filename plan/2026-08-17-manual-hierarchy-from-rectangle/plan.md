---
status: completed
experience: none
---

# Create and enter hierarchical Cells from rectangles

## Goal

Allow a selected drafting rectangle to become a formal hierarchical block on
the first `E` press, immediately enter its newly created child Cell, return to
the parent with Up or `Shift+E`, and re-enter existing blocks with `E` or a
double-click.

## State and Ownership

Start state from `git status --short --branch`:

```text
## main...origin/main
```

The worktree was clean and `main` was current before the target branch was
created. This target owns the manual hierarchy conversion/navigation surface,
its model-controller integration, hierarchical symbol generation, focused
tests, and its plan/log records.

- `apps/editor/src/features/hierarchy/`
- `apps/editor/src/app/App.tsx`
- `apps/editor/src/interaction/editor-shortcuts.ts`
- `apps/editor/src/interaction/editor-shortcuts.test.ts`
- `apps/editor/src/document/`
- `packages/symbols/src/hierarchical-block*`
- `packages/symbols/src/resolver.test.ts`
- `packages/symbols/src/schema.ts`
- `apps/editor/e2e/`
- `plan/2026-08-17-manual-hierarchy-from-rectangle/plan.md`
- `plan/root-audit.md`
- `plan/log.md`

Shared contracts are Project validation, typed Document edits, symbol
resolution (including the explicit zero-terminal hierarchical-block marker),
per-document history, and persisted subcircuit bindings.

## Work

1. Add a validated rectangle-to-child-Cell conversion with collision-free Cell,
   Document, and instance identities.
2. Allow formal zero-terminal manual hierarchical blocks and refresh the
   controller's Project structure without starting a new Project session.
3. Wire `E`, `Shift+E`, Up, and double-click navigation into the Editor and
   present hierarchy navigation without import-only language.
4. Add focused unit and browser regression coverage, including save/reload.

## Validation

- Focused hierarchy, shortcut, controller, and browser tests
- `pnpm test:impact -- --base origin/main`
- `pnpm install --frozen-lockfile`
- `pnpm ci:check`
- `git diff --check`
- `git status --short --branch`

## Test Impact

- Decision: tests-updated
- Contracts: formal rectangle conversion, zero-terminal hierarchy symbol
  resolution, navigation shortcuts, parent return, re-entry, and persistence
- Primary checks: affected Vitest suites and a focused Playwright hierarchy flow

## Commit Intent

Commit as:

```text
feat(editor): add manual hierarchical Cell editing
```

## Outcome

Delivered formal manual hierarchy authoring: an unlocked selected rectangle is
atomically replaced by a persisted subcircuit instance and a new empty child
Cell, then opened immediately. `E`, `Shift+E`, Up, and double-click cover entry
and return navigation; zero-terminal child Cells resolve as explicitly typed
hierarchical blocks without weakening ordinary symbol validation. Structural
creation keeps the current Project/recovery session and rebuilds per-Document
histories because their symbol-resolver context changed.

Focused validation passed 39 unit tests and the save/reopen browser scenario.
`pnpm test:impact -- --base origin/main`, `pnpm install --frozen-lockfile`, and
the complete `pnpm ci:check` gate passed, including 831 unit/integration tests,
147 browser tests, build, release verification, and production smoke checks.
