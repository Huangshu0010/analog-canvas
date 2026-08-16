---
status: completed
experience: none
---

# Command Move and Browser-Safe Shortcuts

## Goal

Complete the editor shortcut contract: map `Ctrl+R` to top/bottom mirror,
`P` to ordinary Port placement, `Ctrl+D` to safe deselection, and replace the
temporary drag-after-`M` interaction with a Virtuoso-style click-to-place Move
session. Browser defaults must be suppressed without disabling valid editor
commands.

## State and Ownership

Start state from `git status --short --branch`:

```text
## main...origin/main
?? .worktrees/
```

The untracked `.worktrees/` directory is unrelated local workspace state and
will not be touched. This target begins from merged `main` on
`codex/command-move-shortcuts`.

Owned paths:

- `apps/editor/src/app/App.tsx`
- `apps/editor/src/interaction/editor-shortcuts.ts`
- `apps/editor/src/interaction/editor-shortcuts.test.ts`
- `apps/editor/src/interaction/interaction-state.ts`
- `apps/editor/src/interaction/interaction-state.test.ts`
- `apps/editor/src/components/editor-help-dialog.tsx`
- `apps/editor/e2e/manual-editor.spec.ts`
- `apps/editor/e2e/component-insert.spec.ts`
- `plan/2026-08-16-command-move-shortcuts/plan.md`
- `plan/log.md`

Shared dependencies:

- visual selection and selection move plan
- grid-coordinate and edit-engine transaction contracts
- existing component placement and route stretch behavior

## Work

1. Centralize browser-conflicting key arbitration so `Ctrl+R` executes the
   editor mirror command when valid and otherwise blocks refresh; `Ctrl+D`
   clears only idle selection while always blocking browser bookmarking.
2. Add `P` as a direct `port` placement request using the ordinary component
   placement state and existing orientation controls.
3. Replace drag-after-`M` with a snapshot-based command move session: mouse
   move previews, one click commits, and Esc/document or transaction changes
   cancel cleanly. Reuse the existing selection planner and typed-edit commit
   helpers rather than creating a second electrical move path.
4. Remove obsolete armed-drag paths, update Help, and add focused unit and
   Playwright coverage for the four shortcut contracts.

Remote CI subsequently found two existing browser contracts that still
expected the intentionally retired `Shift+V` mirror shortcut. Update those
contracts to `Ctrl+R` and repeat the affected checks before delivery.

## Validation

- `pnpm test:local apps/editor/src/interaction/editor-shortcuts.test.ts apps/editor/src/interaction/interaction-state.test.ts apps/editor/src/app/App.test.tsx`
- `pnpm test:e2e:local apps/editor/e2e/manual-editor.spec.ts --grep "command move|Ctrl\+R|Port shortcut|Ctrl\+D"`
- `pnpm typecheck`
- `git diff --check`
- `git status --short --branch`

## Commit Intent

Commit as:

```text
feat(editor): complete command move shortcuts
```

## Outcome

Implemented browser-safe shortcut arbitration: `Ctrl+R` performs top/bottom
mirror where valid and otherwise blocks refresh; `Ctrl+D` deselects only while
idle and always blocks browser bookmarking. `P` now enters the existing `port`
component-placement flow.

Replaced the prior `M → drag` bridge with a frozen command session whose
imperative preview follows canvas pointer movement and commits on one click.
It reuses the existing instance stretch, loose-route, and visual edit helpers;
Esc and every existing transient-interaction reset restore the preview.

Focused unit tests (24), App tests (37 total), and the four dedicated
Playwright contracts passed, along with typecheck and `git diff --check`.
The full manual-editor suite was started after those checks; the local runner
did not return a final result through this host, so it is not claimed here.

The first remote browser run found two stale `Shift+V` assertions. Both were
migrated to `Ctrl+R`; their focused Playwright contracts and typecheck passed.
Remote mainline checks are being repeated before merge.
