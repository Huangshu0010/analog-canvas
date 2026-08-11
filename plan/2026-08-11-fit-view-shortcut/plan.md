---
status: completed
experience: none
---

# Restore Fit View Shortcut

## Goal

Restore unmodified `F` as the primary Fit View shortcut. Retain `Home` as a
compatible secondary alias and leave `Shift+F` intentionally unbound until the
human selects the post-discussion flip convention.

## State and Ownership

Start state from `git status --short --branch`:

```text
## codex/contextual-properties-net-labels...origin/codex/contextual-properties-net-labels
```

The worktree is clean. This target owns:

- `apps/editor/src/interaction/editor-shortcuts.ts`
- `apps/editor/src/interaction/editor-shortcuts.test.ts`
- `apps/editor/src/app/App.tsx`
- `docs/specs/editor-interaction.md`
- `plan/2026-08-11-fit-view-shortcut/plan.md`
- `plan/log.md`

The existing mirror UI commands and orientation helper remain unchanged. The
copy-and-drag request and a replacement mirror key are separate pending design
decisions, not part of this narrow target.

## Work

1. Map unmodified `F` to Fit View and stop emitting a mirror shortcut intent.
2. Remove the now-unreachable global mirror-shortcut handler while preserving
   contextual mirror buttons.
3. Update shortcut tests and the interaction contract.

## Validation

- Focused shortcut tests, workspace typecheck, editor production build,
  `git diff --check`, and status review.

## Commit Intent

```text
fix(editor): restore F fit view shortcut
```

## Outcome

Unmodified `F` now resolves to Fit View and `Home` remains its compatible
alias. `Shift+F` emits no global action while the human selects a durable
mirror convention; the existing contextual mirror controls remain available.
Focused shortcut/App tests (21), workspace typecheck, production editor build,
and `git diff --check` passed.
