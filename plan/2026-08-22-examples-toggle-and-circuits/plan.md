---
status: completed
experience: none
---

# Examples toggle and bundled circuit additions

## Goal

Make a second click on the left-rail Examples control collapse its panel, matching the Library control, and publish the two user-supplied Project files as named bundled Examples.

## State and Ownership

Start state from `git status --short --branch`:

```text
## main...origin/main [ahead 3, behind 9]
?? .pnpm-store/
?? .worktrees/
```

The untracked dependency cache and worktree container are unrelated and will be left untouched. This target owns only the Examples-panel state, bundled Example assets/metadata, and their focused tests.

- `apps/editor/src/features/editor-shell/use-editor-panels.ts`
- `apps/editor/src/examples/library-examples.ts`
- `apps/editor/src/examples/library-examples.test.ts`
- `apps/editor/src/examples/*.icproj.json` for the two curated Projects
- `apps/editor/e2e/component-insert.spec.ts`
- `plan/2026-08-22-examples-toggle-and-circuits/plan.md`
- `plan/log.md`

- Read-only: `apps/editor/src/app/App.tsx`, `apps/editor/src/features/editor-shell/examples-panel.tsx`, supplied files in `E:/Downloads/`.
- Shared: Project parsing/schema migration through `@icm/project-protocol`; the left-panel mode contract in `useEditorPanels`.

## Work

1. Add a mode-aware Examples toggle that collapses an open Examples panel and otherwise opens it, preserving the established Library behavior.
2. Bundle the two supplied Project files with concise topology-based names and list them in the Example registry.
3. Extend focused unit and browser coverage for the new toggle and named cards.

## Validation

- `pnpm test:local apps/editor/src/examples/library-examples.test.ts`
- `pnpm test:e2e:local apps/editor/e2e/component-insert.spec.ts --grep "opens named full-width Project examples"`
- `pnpm test:e2e:local apps/editor/e2e/manual-editor.spec.ts`
- `pnpm test:impact -- --base main`
- `pnpm gate:preflight -- --base main`
- `pnpm gate:affected -- --base main`
- `git diff --check`
- `git status --short --branch`

## Gate Review

- Decision: affected
- Early gates: `pnpm gate:review:check -- --base main`, `pnpm ci:static`, and `pnpm test:impact -- --base main`.
- Affected gates: focused registry unit test plus `component-insert` and full `manual-editor` browser coverage; then `pnpm gate:affected -- --base main`.
- Final gates: `pnpm ci:check` and remote required checks before any merge to `main`.
- Platform risks: browser panel state must match desktop and compact behavior; source Project assets must parse to the current schema.

## Test Impact

- Decision: tests-updated
- Contracts: an active Examples toggle collapses the left panel; each built-in card has a unique ID, a non-empty name, and opens as a current-schema Project.
- Primary checks: `apps/editor/src/examples/library-examples.test.ts`; `apps/editor/e2e/component-insert.spec.ts`; `apps/editor/e2e/manual-editor.spec.ts`.

## Commit Intent

Commit as:

```text
feat(editor): add bundled differential examples
```

## Outcome

Examples now mirror Library's toggle semantics: a repeated click folds the
active Examples panel and a later click opens it again. Added the supplied
current-mirror-loaded differential pair and fully differential two-stage op
amp as schema-current bundled Projects with named cards.

Validation passed:

- `pnpm test:local apps/editor/src/examples/library-examples.test.ts`
- focused `component-insert` Example test
- `pnpm gate:preflight -- --base main`
- `pnpm gate:affected -- --base main` (1108 unit tests, 22 component-insert
  browser tests, and 91 manual-editor browser tests)
- `git diff --check`

The first standalone manual-editor run was interrupted by an orphaned
Playwright process from an earlier invocation; after stopping only those
verified test processes, the canonical affected gate reran the suite cleanly.
Commit status: committed locally on `codex/examples-toggle-and-circuits`.
