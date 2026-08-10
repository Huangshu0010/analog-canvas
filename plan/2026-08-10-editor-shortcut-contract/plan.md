# Editor Shortcut Contract

## Goal

Replace App's ordered global-keyboard `if/else` chain with one pure shortcut
resolution contract. Adding future editor commands should have one typed place
to define key ownership and precedence without mixing DOM events, React state,
and command execution.

## Dirty-State Decision

Frontend architecture stages through `5239f88` are committed. Concurrent
documentation, plan archive, reference, and shared-log changes remain dirty
but do not overlap this target. They are read-only and will not be staged.

## Owned Files

- `apps/editor/src/App.tsx`: global keydown resolution and execution only
- `apps/editor/src/editor-shortcuts.ts`
- `apps/editor/src/editor-shortcuts.test.ts`
- `plan/2026-08-10-editor-shortcut-contract/plan.md`

## Read-Only Files

- Existing E2E specifications and Playwright configuration
- Interaction, selection, model, edit-engine, and rendering contracts
- All concurrent dirty paths, including `plan/log.md`

## Shared Dependencies

- Text editor and open command menus retain first refusal over global Escape.
- Typing targets suppress all remaining global shortcuts.
- Existing key ownership and precedence remain unchanged, including `R`
  rotate-versus-rectangle, Enter completion, contextual Escape, bracket style
  steps, and Delete removing a wire bend before deleting selection.
- Shortcut resolution is pure. It cannot mutate React state, access the DOM,
  transact edits, or emit status.
- App remains the command executor and owns all effects.

## Expected Work

1. Define a tagged shortcut-intent union and the minimum contextual snapshot
   required to resolve one keyboard event.
2. Encode modifier rules and contextual priority in a pure resolver.
3. Add table-driven tests for command mappings, ignored typing input, and
   conflict-prone priority branches.
4. Replace App's keydown chain with resolve-once/execute-once dispatch.

## Validation

- Focused shortcut and App unit tests
- Focused Playwright coverage for text editing, command menu dismissal,
  rotate/rectangle, tool shortcuts, undo/redo, save/open guards, style steps,
  Enter completion, Escape cancellation, and Delete behavior
- Full editor Vitest and Playwright suites
- `pnpm typecheck`, `pnpm build`, `git diff --check`, status audit

## Commit Intent

Commit only owned paths as:

```text
refactor(editor): centralize keyboard shortcut contract
```

The shared maintenance log remains deferred to its concurrent owner.

## Outcome

- Added a pure, tagged shortcut resolver with an explicit context snapshot and
  one result per key event.
- Centralized modifier ownership and conflict priority for history/file
  chords, tool activation, rotate-versus-rectangle, Enter completion,
  contextual Escape, drawing style steps, and Delete behavior.
- Replaced App's conditional key chain with resolve-once/execute-once dispatch;
  DOM focus checks and command side effects remain in App.
- Added nine contract tests, including typing suppression and conflict-prone
  priority paths.

## Validation Result

- Focused Vitest: 20 passed.
- Focused shortcut Playwright: 12 passed.
- Full editor Vitest: 86 passed across 20 files.
- Full Playwright: 59 passed under the current fully-parallel setting.
- `pnpm typecheck`: passed.
- `pnpm build`: passed; the existing Vite large-chunk advisory remains.
- Final `git diff --check` and status audit run immediately before commit.
- `plan/log.md` remains unstaged because its dirty state belongs to the
  concurrent repository-maintenance target.
