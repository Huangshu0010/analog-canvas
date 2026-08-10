# Extract Help Dialog

## Goal

Extract the self-contained Help presentation from App into a focused component
without changing its content, dismissal behavior, focus lifecycle, or styling.
This establishes a real low-coupling presentation boundary rather than moving
highly coupled editor state into a large prop bag.

## Dirty-State Decision

Frontend architecture stages through `15334c8` are committed. Concurrent
documentation, plan archive, reference, and shared-log changes remain dirty
but do not overlap this target. They remain read-only and unstaged.

## Owned Files

- `apps/editor/src/App.tsx`: Help markup call site only
- `apps/editor/src/editor-help-dialog.tsx`
- `plan/2026-08-10-extract-help-dialog/plan.md`

## Read-Only Files

- `apps/editor/src/styles.css`
- Existing E2E specifications and Playwright configuration
- All business, interaction, selection, and persistence modules
- All concurrent dirty paths, including `plan/log.md`

## Shared Dependencies

- App retains Help open state, open-button focus restoration, and Escape
  shortcut execution.
- The component owns only backdrop/dialog markup and invokes `onClose` for its
  backdrop and close button.
- Existing IDs, roles, accessible names, content, classes, and focus ref remain
  unchanged.

## Expected Work

1. Move Help markup into `EditorHelpDialog` with an explicit close callback and
   close-button ref.
2. Replace the inline conditional in App with the component call.
3. Verify backdrop, Escape, close button, focus, typography, and production
   smoke behavior.

## Validation

- App unit tests and typecheck
- Focused Help dismissal and chrome typography Playwright flows
- Full editor Vitest and Playwright suites
- `pnpm build`, `git diff --check`, status audit

## Commit Intent

Commit only owned paths as:

```text
refactor(editor): extract help dialog component
```

The shared maintenance log remains deferred to its concurrent owner.

## Outcome

- Moved the complete Help dialog into a two-prop presentation component while
  preserving every accessible identifier, class, content section, dismissal
  path, and close-button ref.
- Reduced `App.tsx` by 130 lines without moving editor state or business
  callbacks into the component.
- App retains Help state, shortcut ownership, focus restoration, and status;
  the component owns only dialog rendering and close intent.

## Validation Result

- App Vitest: 11 passed.
- Focused Help/chrome Playwright: 3 passed.
- Full editor Vitest: 92 passed across 21 files.
- Full Playwright: 59 passed under the current fully-parallel setting.
- `pnpm typecheck`: passed.
- `pnpm build`: passed; the existing Vite large-chunk advisory remains.
- Final `git diff --check` and status audit run immediately before commit.
- `plan/log.md` remains unstaged because its dirty state belongs to the
  concurrent repository-maintenance target.
