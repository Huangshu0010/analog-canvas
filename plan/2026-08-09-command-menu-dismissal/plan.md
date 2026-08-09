# Command menu dismissal

## Goal

Make the header command popovers (`Draw`, `File`, `Edit`, `View`, `More`) close
when the user clicks outside them or presses Escape. Preserve native details
semantics, menu-to-menu exclusivity, the component library's independent
details sections, and existing canvas Escape behavior when no command menu is
open.

## Dirty-state decision

The shared worktree contains completed but uncommitted drafting, wire,
renderer, model, style, test, and log changes. `App.tsx` and
`manual-editor.spec.ts` overlap this target. The user explicitly requested this
editor interaction repair after those changes were handed over, so this target
may make narrowly scoped menu-dismissal edits there. It must stage only its
own hunks and leave all drafting/wire work untouched.

## Ownership

- `apps/editor/src/App.tsx`
- `apps/editor/e2e/manual-editor.spec.ts`
- `plan/2026-08-09-command-menu-dismissal/plan.md`
- a separately staged `plan/log.md` entry at completion

Read-only: CSS, model, edit engine, renderer, component-library details, and
all other dirty paths.

## Work

1. Add a document-level capture listener that closes only open
   `.command-menu` details when a pointer starts outside every command menu.
2. Give Escape priority to an open command menu; stop that Escape from also
   cancelling a wire, drafting gesture, or selection.
3. Add browser coverage for outside click and Escape dismissal.

## Validation

- Focused Playwright command-menu test.
- Editor build and focused formatting check.
- `git diff --check` and staged diff review.

## Commit intent

```text
fix(editor): dismiss command menus outside the toolbar
```
