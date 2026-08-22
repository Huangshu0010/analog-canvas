---
status: completed
experience: none
---

# Spell out Publish to Gallery and finish the brand parity

## Goal

1. The menubar publish control read "Publish", leaving its destination
   implicit next to Search. Show the full action.
2. That longer label pushed the right-hand chrome past the viewport at the
   narrow breakpoint, which the browser suite caught.
3. The editor still truncated its own wordmark to "Analog Ca…", so the brand
   read as a different size from the gallery's even though both draw the same
   22px mark.

## State and Ownership

Start state: clean worktree on `main`. Branch `claude/publish-full-label`.

Owned paths:

- `apps/editor/src/app/App.tsx`
- `plan/2026-08-22-publish-full-label/plan.md`, `plan/log.md`

## Work

1. Label the button "Publish to Gallery".
2. Drop the now-redundant `aria-label` — the visible text is the accessible
   name — and keep `title` for the tooltip.
3. Let the menubar yield before the right-hand chrome does: it becomes
   shrinkable and scrolls its own row under 900px instead of pushing
   Analytics/About/Help off-screen.
4. Move the editor's truncation off the brand link and onto the
   project/document line, so the wordmark always renders in full and only the
   variable-length text yields.

## Validation

- repository typecheck, prettier
- editor unit tests; gallery and manual-editor browser specs
- menubar clearance measured in a running editor at a narrow viewport

## Gate Review

- Decision: affected — one presentation string in the editor shell.
- Early gates: prettier, editor unit tests.
- Affected gates: gallery and manual-editor browser specs (they drive the
  publish control and assert the command surface).
- Final gates: `pnpm ci:check` cannot run locally (pnpm absent); delegated to
  the remote required checks.
- Platform risks: none.

## Test Impact

- Decision: no-test-change
- Reason: the browser specs reach the control by `data-testid`
  (`publish-gallery-button`) and the dialog by role, so no assertion names the
  visible string; the accessible name is unchanged because it now comes from
  the button text instead of a duplicate `aria-label`. The existing narrow
  breakpoint spec already asserts that the right-hand chrome stays inside the
  viewport — it caught the overflow this label introduced and now passes
  against the shrinkable menubar, so it remains the protecting contract.

## Commit Intent

```text
fix(editor): spell out Publish to Gallery in the menubar
```

## Outcome

The button reads "Publish to Gallery". The first CI run rejected the change:
at the 720px breakpoint the longer label pushed Help to x=736 against a 720px
viewport. The menubar now shrinks and scrolls its own row under 900px, so the
right-hand chrome stays put and the label stays whole.

With the menubar able to yield, the editor no longer needs to truncate its
brand. Both views now measure identically: a 22×22 mark, a 98.1px "Analog
Canvas" wordmark that is not truncated in either view, an 8px gap, and a 22px
link height. Only the project/document line truncates, and only in the editor.

Validation: typecheck, 181 unit files / 1135 tests, 187 Playwright tests,
prettier, markdown links, and diff checks.
