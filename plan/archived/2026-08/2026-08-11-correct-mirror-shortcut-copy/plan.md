---
status: completed
experience: none
---

# Correct Mirror Shortcut Copy

## Goal

Align the visible Edit menu, Properties controls, and Help shortcut guidance
with the implemented `Shift+R` left/right and `Shift+V` top/bottom mirror map.

## State and Ownership

Start state from `git status --short --branch`:

```text
## codex/contextual-properties-net-labels...origin/codex/contextual-properties-net-labels
```

The worktree is clean. This target owns only visible editor copy and its factual
plan/log records.

- `apps/editor/src/app/App.tsx`
- `apps/editor/src/components/editor-help-dialog.tsx`
- `docs/specs/editor-interaction.md`
- `plan/2026-08-11-correct-mirror-shortcut-copy/plan.md`
- `plan/log.md`

## Work

1. Replace stale `F` and `Shift+F` labels in Edit and Properties mirror controls.
2. Make Help state the current mirror map and copy-placement lifecycle clearly.
3. Check the interaction specification has no obsolete mirror shortcut copy.

## Validation

- `pnpm --filter @icm/editor build`
- targeted source search for obsolete mirror shortcut labels
- `git diff --check`
- `git status --short --branch`

## Commit Intent

Commit as:

```text
fix(editor): correct mirror shortcut labels
```

## Outcome

Replaced stale `F` / `Shift+F` mirror labels in the Edit menu and selected
component Properties controls with the implemented `Shift+R` / `Shift+V` map.
Help now explicitly states that `F` fits the view and describes click-to-place
and Escape-to-cancel copy placement. The interaction specification already used
the correct map. Production editor build, obsolete-label search, and diff check
passed.
