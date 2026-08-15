---
status: completed
experience: none
---

# Add About Panel and Compact-Layout Help

## Goal

Add a concise About entry with repository information and the editor version,
and update Help to explain the compact Library and Properties behavior.

## State and Ownership

Start state from `git status --short --branch`:

```text
## main...origin/main
?? .worktrees/
```

`main` was fast-forwarded from `origin/main` before this branch was created.
The untracked `.worktrees/` directory is user-owned and unrelated to the editor
source paths below; it will not be inspected, staged, or modified.

- `apps/editor/src/app/App.tsx`
- `apps/editor/src/components/editor-help-dialog.tsx`
- `apps/editor/src/components/editor-about-dialog.tsx`
- `apps/editor/src/components/editor-about-dialog.test.tsx`
- `apps/editor/src/styles.css`
- `apps/editor/src/app/App.test.tsx`
- `plan/2026-08-15-add-about-help-panel/plan.md`
- `plan/log.md`

Read-only shared dependencies: root/editor package metadata supplies the
version; the existing Help dialog's focus and close behavior is the interaction
model to preserve.

## Work

1. Add a top-bar About button and concise accessible dialog with version and
   repository link.
2. Update Help's placement/selection guidance for compact Library and overlay
   Properties behavior.
3. Cover the rendered About metadata and top-bar entry with focused tests.

## Validation

- `pnpm test:local apps/editor/src/components/editor-about-dialog.test.tsx apps/editor/src/app/App.test.tsx`
- `pnpm test:e2e:local apps/editor/e2e/chrome-isolation.spec.ts`
- `pnpm typecheck`
- `git diff --check`
- `git status --short --branch`

## Commit Intent

Commit as:

```text
feat(editor): add about panel and compact-layout help
```

## Outcome

Added an `About` button between Analytics and Help. Its dialog gives the
Analog Canvas identity, package-derived version, and GitHub repository link,
with the existing dialog backdrop and focus-return behavior. Help now explains
the compact Library and overlay Properties behavior.

Validation passed: focused About/App unit tests (14 tests), the full
chrome-isolation browser spec (3 tests), workspace typecheck, Prettier, and
`git diff --check`.
