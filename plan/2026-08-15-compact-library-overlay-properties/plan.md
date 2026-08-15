---
status: completed
experience: none
---

# Compact Library and Overlay Properties at Narrow Widths

## Goal

Keep the Library on the left at narrow viewport widths as a default-collapsed,
single-column panel, and make Properties overlay rather than consume canvas
layout space. Preserve the existing Properties content and fold interaction.

## State and Ownership

Start state from `git status --short --branch`:

```text
## main...origin/main
```

The worktree was clean before this target. This target owns the narrow editor
layout and its focused coverage.

- `apps/editor/src/app/App.tsx`
- `apps/editor/src/features/editor-shell/shapes-panel.tsx`
- `apps/editor/src/styles.css`
- `apps/editor/e2e/component-insert.spec.ts`
- `apps/editor/e2e/manual-editor.spec.ts`
- `plan/2026-08-15-compact-library-overlay-properties/plan.md`
- `plan/log.md`

Read-only shared dependencies: the component catalog and the existing
Properties content/folding contract. Changes must not alter component placement
or persisted desktop Library preference.

## Work

1. Add a narrow-viewport layout mode that defaults the Library closed without
   overwriting the saved desktop preference, and keeps Library and Properties
   mutually exclusive while compact.
2. Keep the Library in the left workspace column, render its tiles in one
   compact column, and expose concise narrow labels while preserving accessible
   full labels.
3. Convert narrow Properties positioning from a bottom grid row to a
   right-side overlay without changing its content or fold interaction.
4. Add focused browser coverage for narrow geometry, default state, and panel
   exclusivity.

## Validation

- `pnpm test:local apps/editor/src/features/editor-shell/shapes-panel.test.ts apps/editor/src/app/App.test.tsx`
- `pnpm test:e2e:local apps/editor/e2e/component-insert.spec.ts apps/editor/e2e/manual-editor.spec.ts --grep "narrow breakpoint|canvas width"`
- `pnpm typecheck`
- `git diff --check`
- `git status --short --branch`

## Commit Intent

Commit as:

```text
fix(editor): compact narrow library and overlay properties
```

## Outcome

At widths up to 860px, Library now starts collapsed without overwriting the
stored desktop preference. It expands as a compact, left-side single-column
panel with the concise `All` heading. Properties retains its existing content
and fold behavior but is now a right-side overlay; opening either panel closes
the other while compact, and opening Properties leaves the canvas layout width
unchanged after the transition completes.

Validation passed: focused Library/App unit tests (16 tests), focused narrow
Library/canvas Playwright coverage (2 tests), workspace typecheck, Prettier,
and `git diff --check`.
