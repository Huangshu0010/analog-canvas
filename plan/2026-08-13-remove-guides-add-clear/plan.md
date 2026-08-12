---
status: completed
experience: none
---

# Remove manual Guides and add Clear canvas

## Goal

Simplify the editor by completely removing the persisted manual Guide feature,
while adding an undoable Clear canvas command and a deliberate recovery-safe
Refresh app button.

## State and Ownership

Start state from `git status --short --branch`:

```text
## codex/persistent-authoring-input-safety...origin/codex/persistent-authoring-input-safety
```

The worktree was clean at commit `6ce21b4`. This target continues on the
user-selected branch and owns:

- `apps/editor/src/app/App.tsx`
- `apps/editor/src/components/editor-help-dialog.tsx`
- `apps/editor/src/features/editor-shell/tool-icon.tsx`
- `apps/editor/src/interaction/`
- `apps/editor/src/snap/candidates.ts` and focused tests
- `apps/editor/src/styles.css`
- focused editor browser tests under `apps/editor/e2e/`
- `packages/edit-engine/src/transaction.ts`, `history.ts`, and focused tests
- `packages/model/src/` Guide schema/factory/migration surfaces
- `packages/agent-adapter/src/` snapshot Guide surfaces
- Guide-only renderer/test fixtures and mechanical drafting-layer fixture updates
- `docs/specs/editor-interaction.md`
- this plan and `plan/log.md`

The user explicitly declined backward compatibility for Guide records, so the
Guide field and edits are removed from the accepted data/Agent contracts rather
than silently retained. Transient Smart Snap alignment feedback is a separate
automatic canvas concern and remains. Clear canvas is a new typed atomic edit
so it remains undoable and follows the same transaction boundary as every
other human edit. Refresh app flushes current recovery synchronously before
calling the browser reload API.

## Work

1. Remove manual Guides from Model, migration, Edit Engine, Agent snapshot,
   editor state, shortcuts, menus, tool rail, help, canvas, and snap candidates.
2. Add an atomic `clear_document` edit that removes active-Document circuit,
   annotation, constraint, and drafting content while preserving Document
   identity, presentation, and history.
3. Add an Edit-menu Clear canvas action with an explicit active-Cell name,
   confirmation, clean transient-state reset, and Undo support.
4. Add a visible Refresh app command that synchronously flushes recovery before
   explicitly reloading, while raw browser refresh shortcuts remain blocked.
5. Update the accepted interaction contract and focused regressions for Guide
   absence, cancellation, clear/undo, and safe explicit refresh.

## Validation

- focused shortcut/state/snap/Edit Engine unit tests
- focused browser tests for command-surface Guide absence and Clear/Undo
- complete editor interaction browser specs affected by the command surface
- `corepack pnpm typecheck`
- `git diff --check`
- `git status --short --branch`

## Commit Intent

Commit as:

```text
feat(editor): remove guides and add clear and refresh
```

## Outcome

Removed the manual Guide feature from the persisted model, migration output,
Edit Engine, Agent API, renderer assumptions, snap candidates, editor state,
commands, shortcuts, canvas, fixtures, and accepted active specifications.
Automatic Smart Snap alignment feedback remains transient editor state. Added
the atomic `clear_document` edit and a confirmed `Edit / Clear canvas` command;
one Undo restores the complete active Document including MOS bulk defaults.
Added `File / Refresh app`, which flushes a recovery snapshot before reload and
automatically restores it afterward while raw browser refresh shortcuts remain
blocked.

Validation completed with workspace typecheck, generated Agent API artifact
check, 613/613 unit tests, and the three affected browser specifications. The
first 16-worker browser run passed 93/95; the two failures exposed stale test
assumptions about tools exiting after one placement. After explicitly pressing
Escape in those tests, both passed at one worker and all six directly affected
browser regressions passed together. `git diff --check` is clean.
