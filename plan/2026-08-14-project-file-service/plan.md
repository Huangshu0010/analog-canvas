---
status: active
experience: none
---

# WP-3 - Robust Project File Service and Replacement Protection

## Goal

Make Save/Open semantics truthful and non-destructive: one Project file
service owning canonical serialization, progressive-enhancement File System
Access saves with a canonical download fallback, staged open with typed
diagnostics, distinct confirmed-write versus download-requested file state,
and outgoing dirty-Project protection before Open/Import/Agent-Replace.

## State and Ownership

Start state from `git status --short --branch`:

```text
## agent/robust-page-persistence-recovery
```

Clean after WP-2 commit `88f0b63`.

Owned paths:

- `apps/editor/src/document/project-file-service.ts` (new) and its test
- `apps/editor/src/app/App.tsx` (file-state tracking, save/open handlers,
  replacement guard dialog, File-menu wiring)
- `apps/editor/e2e/project-file.spec.ts` (new), plus `beforeEach` download-only
  emulation in `manual-editor.spec.ts` and `drafting.spec.ts` (their Save
  Project flows assert the download fallback deterministically; headless
  Chrome otherwise aborts the native save picker)
- this plan and `plan/log.md`

Read-only: recovery coordinator/contract/store (consumed via existing
methods), `packages/model` parse/serialize/diagnostics, symbol support
checking, edit-engine, PWA assets.

Empirical input recorded from the local environment: headless Chrome exposes
`showSaveFilePicker` but rejects the call with AbortError, so default E2E
specs emulate download-only browsers and File System Access paths are tested
through injected JavaScript mocks.

## Work

1. `project-file-service.ts`: `saveProjectArtifact` (serialize → picker when
   available → typed write-confirmed / picker-cancelled / permission-denied /
   write-failed(open|write|close) / serialization-failed; anchor download
   fallback returns download-requested and never touches recovery),
   `requestProjectDownload`, and `stageProjectFile` (read → JSON/schema
   diagnostics with code/path → approved-symbol callback → staged Project,
   rejected input changes nothing).
2. App file-state machine (`new | opened | dirty | write-confirmed |
   download-requested | write-failed`) driven by revision/session tracking and
   explicit transitions at save/open/replacement boundaries.
3. `guardDirtyReplacement`: on dirty work, confirm the newest recovery write
   first; on storage failure show a dialog offering Download current Project /
   Replace anyway / Cancel with Escape support, defaulting to Cancel.
4. Route Open, SPICE import, and Agent candidate replacement through the
   guard; attach formal-file hints to seeded recovery records after confirmed
   writes, downloads, and opens.
5. Unit tests for every service outcome with fake picker/document seams; E2E
   for fallback download, confirmed FSA save, permission-denied fallback,
   write failure with intact recovery, invalid-open no-op, and dirty-guard
   cancel/replace flows.

## Validation

- `git diff --check`
- `git status --short --branch`
- `pnpm test:local apps/editor/src/document`
- `corepack pnpm typecheck`
- `pnpm test:e2e:local apps/editor/e2e/project-file.spec.ts`
- `pnpm test:e2e:local apps/editor/e2e/manual-editor.spec.ts --grep "Save Project|recovery|Opened"`
- `pnpm test:e2e:local apps/editor/e2e/drafting.spec.ts`

## Commit Intent

Commit as:

```text
feat(editor): harden project open and save
```

## Outcome

Implemented `project-file-service.ts` with typed save outcomes (only a
completed File System Access write/close reports `write-confirmed`; the
anchor-download fallback reports `download-requested`; picker cancellation,
permission denial, and open/write/close stream failures are distinct) and
`stageProjectFile` (read → JSON/schema diagnostics with code and path →
approved-symbol callback → staged Project). App.tsx gained the orthogonal
`ProjectFileState` machine (revision/session-tracked), a rewritten async
`saveProjectFile` that records formal-file hints on seeded recovery records,
`guardDirtyReplacement` (confirm the newest recovery write first; on storage
failure show a Download/Replace-anyway/Cancel dialog defaulting to Cancel with
Escape and focus handling, in the new `replace-guard-dialog.tsx`), and guard
routing for Open, SPICE import, and Agent candidate replacement. Legacy
Save/Open paths that cleared recovery are gone (Save/Open had already stopped
clearing in WP-2). Default E2E specs emulate download-only browsers; the File
System Access paths are covered by seven new `project-file.spec.ts` tests
through injected JS pickers. During the run, the old "reload inside the
400 ms debounce window keeps the last edit" contract was investigated with
in-page probes: even puts dispatched synchronously inside a `pagehide`
handler on an open connection are aborted by Chrome when the document
unloads, so no async IndexedDB strategy can preserve it; a trusted-snapshot
fast-write attempt was built, disproven, and reverted. The affected spec now
waits for the debounced write to settle before reloading, matching the
accepted durability contract (the plan's documented risk: a hard kill may
lose the very last edit, never the session). Validation: 106 unit tests
green; 92 drafting/manual-editor/project-file plus 19
component-insert/web-agent/chrome-isolation E2E green; typecheck, prettier,
`git diff --check` clean.

status: completed
experience: candidate
