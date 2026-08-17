---
status: completed
experience: none
---

# Editor App document and runtime helper layering

## Goal

Move the remaining file-level document-query and browser-runtime helpers out
of `App.tsx`, keeping the component focused on state orchestration and
rendering without changing its observable editor behavior.

## State and Ownership

Start state from `git status --short --branch`:

```text
## codex/app-transaction-module-layers...origin/codex/app-transaction-module-layers [ahead 1]
?? .worktrees/
```

The untracked `.worktrees/` directory is pre-existing workspace
infrastructure and does not overlap this target. The preceding Edit Engine
target is committed locally and will be pushed with this follow-up.

- `apps/editor/src/app/App.tsx`
- `apps/editor/src/app/editor-document-helpers.ts`
- `apps/editor/src/app/editor-runtime-helpers.ts`
- `apps/editor/src/app/editor-document-helpers.test.ts`
- `plan/2026-08-17-editor-app-runtime-helper-layering/plan.md`
- `plan/log.md`

Shared: model document identities, component parameter projection, browser
command menus, shortcut input handling, and App integration behavior.

## Work

1. Move endpoint display, routing-counter, instance-label, and draft-value
   document helpers into a pure App-adjacent module.
2. Move command-menu, typing-target, compact-layout, and crash-probe runtime
   helpers into a browser-runtime module.
3. Add direct unit tests for the document helper contracts and replace App
   local declarations with imports.

## Validation

- `pnpm test:local apps/editor/src/app/editor-document-helpers.test.ts apps/editor/src/app/App.test.tsx`
- `pnpm --filter @icm/editor build`
- `pnpm typecheck`
- `pnpm test:impact -- --base origin/main`
- `git diff --check`
- `git status --short --branch`

## Test Impact

- Decision: tests-updated
- Contracts: endpoint identifiers, routing ID allocation floor, instance-label
  lookup, and uncommitted value-preview projection remain stable.
- Primary checks: document helper unit test and existing App integration test.

## Commit Intent

Commit as:

```text
refactor(editor): layer App document runtime helpers
```

## Outcome

Moved App document-query/value-preview helpers and browser runtime helpers into
focused modules. `App.tsx` now imports them while retaining editor state,
command orchestration, and rendering. The focused App/helper suite (2 files /
16 tests), Editor production build, repository typecheck, test-impact check,
and diff hygiene all passed.
