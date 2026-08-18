---
status: completed
experience: none
---

# WP-4 - Recovery UX and Operational Visibility

## Goal

Let a non-technical user understand and control local safety copies: a
non-blocking startup banner, a File-menu entry and dialog with per-session
cards (Project name, timestamp, source, latest/previous availability) and
Restore / Download backup / Delete actions, a persistent recovery-failure
banner with a direct download action, a concise statusbar recovery label, and
updated Help and troubleshooting guidance.

## State and Ownership

Start state from `git status --short --branch`:

```text
## agent/robust-page-persistence-recovery
```

Clean after WP-3 commit `3e83191`.

Owned paths:

- `apps/editor/src/components/recent-recovery-dialog.tsx` (new)
- `apps/editor/src/components/recovery-banners.tsx` (new)
- `apps/editor/src/document/project-file-service.ts` (add a raw-text backup
  download helper plus its test)
- `apps/editor/src/app/App.tsx` (menu entry, dialog/banner state and
  handlers, statusbar recovery label, removal of the WP-2 interim
  Restore/Discard menu buttons)
- `apps/editor/src/components/editor-help-dialog.tsx`, `apps/editor/src/styles.css`
- `docs/user/troubleshooting.md`
- `apps/editor/e2e/recovery-dialog.spec.ts` (new), recovery-flow updates in
  `manual-editor.spec.ts`
- this plan and `plan/log.md`

Read-only: recovery coordinator/contract/store APIs (consumed as-is),
`packages/model`, Replace guard dialog (pattern reference).

## Work

1. Dialog: one card per stored session with typed availability for both
   generations; Restore picks the newest valid generation (latest, else
   previous) and is disabled with a reason for corrupt records; incompatible
   (unsupported-schema) records offer Download only; Delete removes exactly
   one session; Escape/backdrop/focus and aria labels per the existing dialog
   conventions.
2. Banners: dismissible non-blocking startup banner (overlay, no canvas
   resize) and a persistent failure banner with a direct Project download.
3. Statusbar concise recovery label derived from coordinator state; recovery
   and file states never overwrite each other.
4. App wiring: File / Recover recent work entry replaces the interim menu
   buttons; restore forks a working copy and refreshes summaries; downloads
   use the stored raw text; explicit-refresh auto-restore suppresses the
   banner.
5. Help and troubleshooting updates, including the reload-inside-debounce
   caveat from the WP-3 investigation.
6. E2E: banner → dialog → restore; corrupt-latest falls back to previous;
   incompatible record downloadable but not restorable; delete leaves other
   sessions intact; Escape/keyboard behavior; failure banner with download.

## Validation

- `git diff --check`
- `git status --short --branch`
- `pnpm test:local apps/editor/src/document`
- `corepack pnpm typecheck`
- `pnpm test:e2e:local apps/editor/e2e/recovery-dialog.spec.ts`
- `pnpm test:e2e:local apps/editor/e2e/manual-editor.spec.ts --grep "recovery"`

## Commit Intent

Commit as:

```text
feat(editor): add recent-work recovery UX
```

## Outcome

Implemented `recent-recovery-dialog.tsx` (per-session cards with typed
latest/previous availability; Restore installs the newest valid generation
and is labeled `Restore previous copy of <name>` when falling back; a
newer-schema record is downloadable but never installable; Delete removes
exactly one session; Escape/backdrop/focus and full aria labels per the
existing dialog conventions) and `recovery-banners.tsx` (dismissible
fixed-overlay startup banner that never resizes the canvas; persistent
storage-failure warning with a direct Project download). App gained the
File / Recover recent work… entry replacing the interim menu buttons, a
dialog that refreshes summaries when opened, download of the exact stored
raw text via a new `downloadTextArtifact` service helper, a concise
statusbar `recovery-state` label orthogonal to file state, and banner
suppression after explicit-refresh auto-restore. Help and troubleshooting
documentation updated, including the reload-inside-debounce caveat. Six new
`recovery-dialog.spec.ts` tests cover banner→dialog→restore, damaged-latest
fallback to previous, newer-schema download-only with the record retained,
scoped deletion, Escape/focus, and the failure banner with download; the
three interim recovery flows in manual-editor moved to the dialog. Fixes
found during the run: menu-entry visibility depends on startup discovery
(specs now reload after seeding/editing), a Restore button's aria label
originally hid the previous-copy fallback wording, and the banner/menu share
a button label so menu locators are menu-scoped. Validation: 106 unit tests
green; 90 E2E tests across manual-editor/recovery-dialog/project-file/
component-insert green; typecheck, prettier, `git diff --check` clean.

status: completed
experience: none
