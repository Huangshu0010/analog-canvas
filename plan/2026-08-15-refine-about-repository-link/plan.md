---
status: completed
experience: none
---

# Refine About Repository Link

## Goal

Show the repository URL directly in About, open it in a new tab, and shorten
the product description by removing the browser-specific phrase.

## State and Ownership

Start state from `git status --short --branch`:

```text
## main...origin/main
?? .worktrees/
```

The untracked `.worktrees/` directory is user-owned and unrelated; it will not
be inspected, staged, or modified.

- `apps/editor/src/components/editor-about-dialog.tsx`
- `apps/editor/src/components/editor-about-dialog.test.tsx`
- `apps/editor/e2e/chrome-isolation.spec.ts`
- `plan/2026-08-15-refine-about-repository-link/plan.md`
- `plan/log.md`

## Work

1. Replace the generic About repository link label with the visible URL.
2. Make the link open safely in a new tab and update its automated contract.
3. Remove the browser-specific wording from the About description.

## Validation

- `pnpm test:local apps/editor/src/components/editor-about-dialog.test.tsx`
- `pnpm test:e2e:local apps/editor/e2e/chrome-isolation.spec.ts --grep "About"`
- `pnpm typecheck`
- `git diff --check`
- `git status --short --branch`

## Commit Intent

Commit as:

```text
fix(editor): refine about repository link
```

## Outcome

About now displays the full GitHub repository URL and opens it in a new tab
with `noreferrer`, so navigation does not replace the active editor. The
description now ends at “editable circuit design.”

Validation passed: focused About unit test, focused About Playwright test,
workspace typecheck, Prettier, and `git diff --check`.
