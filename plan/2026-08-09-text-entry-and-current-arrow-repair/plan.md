# Unify text entry and repair current-arrow controls

## Goal

Remove duplicate property-panel text editors in favor of the canvas RichText
editor, preserve a multi-character browser selection while applying subscript
formatting, and make current-arrow reversal available from normal selection as
well as text editing.

## Dirty-State Note

The tracked worktree is clean. Untracked circuit exports, historical plans,
and the local probe do not overlap this editor target and remain untouched.

## Owned Files

- `apps/editor/src/App.tsx`
- `apps/editor/src/rich-text-editor.tsx`
- `apps/editor/src/rich-text-editor.test.tsx` (if test infrastructure permits)
- `apps/editor/src/App.test.tsx`
- `apps/editor/src/current-arrow.test.ts`
- `plan/2026-08-09-text-entry-and-current-arrow-repair/plan.md`
- `plan/log.md`

## Read-Only Files

- `packages/model/src/schema.ts`
- `packages/render-svg/src/render.ts`
- `packages/edit-engine/src/transaction.ts`

## Shared Dependencies

- Semantic text edits canonicalize through `Annotation.text` and the RichText
  editor session.
- Route-marker direction can be represented by both legacy route attachments
  and ADR-0010 route VisualAnchors.

## Expected Work

1. Remove the instance-label and net-label property-panel text controls;
   retain only object-specific non-text presentation controls there.
2. Preserve and restore the contenteditable range before a formatting command,
   so formatting applies to the entire selected span.
3. Reverse both valid current-arrow direction representations and expose the
   action whenever a current arrow is selected.
4. Add focused regression coverage where feasible.

## Outcome

- Removed the selected-instance “Displayed name” input and Apply button. Text
  now enters through the canvas label's RichText editor; the Property panel
  retains only non-text device presentation controls.
- The RichText editor stores a DOM `Range` whenever its contenteditable
  selection changes and restores that exact range before a format command.
  Multi-character subscript formatting therefore no longer depends on toolbar
  focus behavior.
- Current-arrow reversal is shown on normal current-arrow selection, not only
  in the text-editor toolbar. Its update now changes both a route VisualAnchor
  and a legacy routeAttachment when present.

## Validation

- Focused editor/current-arrow tests.
- `pnpm typecheck`
- `pnpm -C apps/editor build`
- `git diff --check`
- `git status --short --branch`

## Commit Intent

```text
fix(editor): unify text entry and current arrow controls
```
