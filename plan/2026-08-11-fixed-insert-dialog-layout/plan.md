---
status: completed
experience: none
---

# Fixed Insert Component Dialog Layout

## Goal

Keep the Insert Component dialog, symbol preview, and action buttons at stable
sizes as the component catalog grows; only the component list may scroll.

## State and Ownership

Start state from `git status --short --branch`:

```text
## main...origin/main
```

The worktree is clean at `8e56772`. This target owns only the insert-dialog
layout and its focused browser regression.

- `apps/editor/src/styles.css`
- `apps/editor/e2e/component-insert.spec.ts`
- `plan/2026-08-11-fixed-insert-dialog-layout/plan.md`
- `plan/log.md`

The component catalog and insertion behavior are read-only dependencies; this
target does not change symbol data, button sizing, or command semantics.

During validation, the unrelated untracked
`plan/2026-08-11-razavi-pdf-opamp/` path appeared. It is outside this target's
owned files and is left untouched and uncommitted.

## Work

1. Give the dialog explicit header/search/body/footer grid rows and a stable
   viewport-bounded height.
2. Constrain the master-detail body so catalog growth produces an internal
   scrollbar without resizing the preview or displacing the footer.
3. Add a browser regression that checks dimensions, action visibility, and
   list overflow before and after selecting/searching catalog entries.

## Validation

- focused component-insert Playwright tests
- `pnpm typecheck`
- `pnpm --filter @icm/editor build`
- in-app browser inspection at desktop and compact viewport sizes
- `git diff --check`
- `git status --short --branch`

## Commit Intent

Commit as:

```text
fix(editor): stabilize component insert dialog layout
```

## Outcome

Completed. The dialog now has a viewport-bounded fixed height with explicit
header, search, body, and footer rows. Catalog overflow is contained by the
left list's scrollbar; the right preview, 288 by 224 pixel artwork, and action
row remain stable when Inductor is selected.

- Validation passed: three focused Playwright flows, repository typecheck,
  editor production build, focused Prettier check, live in-app browser geometry
  and visual inspection, and `git diff --check`.
- Commit status: ready to commit on `main` as
  `fix(editor): stabilize component insert dialog layout`.
