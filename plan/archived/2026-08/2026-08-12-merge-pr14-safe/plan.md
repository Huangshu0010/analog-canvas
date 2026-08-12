---
status: completed
experience: none
---

# Merge Safe PR 14 Improvements

## Goal

Port the independently useful, reviewable parts of PR #14 onto the current
post-PR-#15 mainline without adopting its whole editor-shell redesign.

## State and Ownership

Start state from `git status --short --branch`:

```text
## main...origin/main
```

The worktree was clean. PR #15 is already merged into `main`; PR #14 now
conflicts with it, so this target owns a manual forward-port rather than a
merge of the stale application shell.

- `apps/editor/src/app/App.tsx`
- `apps/editor/src/features/component-insert/insert-component-dialog.tsx`
- `apps/editor/src/features/component-insert/component-insert-request.ts`
- `apps/editor/src/features/component-insert/symbol-artwork.tsx`
- `apps/editor/src/features/editor-shell/shapes-panel.tsx`
- `apps/editor/src/features/editor-shell/shapes-panel.test.ts`
- `apps/editor/src/features/editor-shell/tool-icon.tsx`
- `apps/editor/src/styles.css`
- `apps/editor/e2e/component-insert.spec.ts`
- `apps/editor/e2e/drafting.spec.ts`
- `docs/specs/editor-interaction.md`
- `plan/2026-08-12-merge-pr14-safe/plan.md`
- `plan/log.md`

Read-only shared dependencies include the post-#15 connectivity/routing paths
and the existing Analytics component/CSS. The port must preserve both.

## Work

1. Port the Library starter/recent panel with empty parameter values, its
   existing full-catalog entry, and persisted open state.
2. Port configurable symbol-preview padding, ordinary-device double-click to
   Properties, the Guide hit-target fix, and the platform-neutral text test.
3. Add focused browser coverage for quick-place, recents, reload persistence,
   and the narrow-screen Library layout.
4. Update only the accepted interaction contract affected by the retained
   behavior; exclude the rejected full shell, status bar, and Properties
   reflow redesign.

## Validation

- Focused unit tests for ShapesPanel and App
- Focused Playwright component insertion and drafting tests
- `pnpm install --frozen-lockfile`
- `pnpm ci:check`
- `git diff --check`
- `git status --short --branch`
- Required GitHub Actions checks on the review branch

The full canonical gate is required because the change affects editor canvas
interaction and will be delivered to `main`.

## Commit Intent

Commit as:

```text
feat(editor): integrate safe library quick-place improvements
```

## Outcome

Ported the useful PR #14 behavior onto the post-#15 mainline without its stale
whole-shell rewrite. The result adds a persisted collapsible starter/recent
Library, blank-value quick placement, ordinary-device double-click Properties,
configurable symbol-preview padding, reliable Guide hit targets, and
platform-neutral text-selection tests. It preserves the floating Properties
overlay, the accepted connectivity/routing implementation, and the Analytics
CSS byte-for-byte from `main`.

Validation passed: focused unit tests (14), focused component/drafting browser
tests (34), frozen install, and complete `pnpm ci:check` including 599 unit tests,
release/performance/export/PWA/smoke gates, and 88 browser tests. `git diff
--check` is clean.
