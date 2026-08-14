---
status: active
experience: none
---

# Robust Page Project Persistence and Recovery

## Goal

Make the static, local-first editor safe against ordinary tab crashes, browser
restarts, failed downloads, accidental Project replacement, storage denial,
quota exhaustion, corrupt recovery data, and multiple open tabs without adding
server-side storage or changing the canonical `.icproj.json` Project format.

The result must preserve a flat product boundary:

- the canonical Project JSON remains the portable user-owned source of truth;
- browser recovery is a bounded, origin-local safety copy;
- PWA asset cache remains unrelated to Project data;
- file/recovery services do not become a second edit engine or Project model;
- Agent credentials, selection, viewport, previews, and undo history never
  enter Project files or recovery records.

## State and Ownership

Start state from `git status --short --branch`:

```text
## codex/fix-fit-view-grid-bounds
 M apps/editor/e2e/drafting.spec.ts
 M apps/editor/src/app/App.tsx
 M plan/log.md
?? apps/editor/src/canvas/fit-view.test.ts
?? apps/editor/src/canvas/fit-view.ts
?? plan/2026-08-14-fix-fit-view-grid-bounds/
```

The dirty files belonged to the Fit View target and did not overlap this new
planning file. While this plan was being written, that target committed and
pushed `242839f`, releasing `App.tsx`, `drafting.spec.ts`, and `plan/log.md`.
Implementation must still start from a dedicated review branch after the Fit
View change reaches the accepted mainline; it must not be mixed into the Fit
View branch.

The overall delivery may own, through separately bounded work packages:

- `apps/editor/src/document/browser-recovery-store.ts` and focused tests
- `apps/editor/src/document/recovery-coordinator.ts` and focused tests
- `apps/editor/src/document/project-file-service.ts` and focused tests
- `apps/editor/src/document/project-recovery.ts` and its tests
- `apps/editor/src/document/document-controller.ts` only where the existing
  successful-commit notification contract needs a typed persistence state
- `apps/editor/src/app/App.tsx` for final command/state/UI integration only
- a small recovery presentation component under `apps/editor/src/components/`
- focused editor E2E specifications
- persistence, Project compatibility, help, and troubleshooting documentation
- one work-package plan and factual log entry per implementation boundary

Shared/read-only contracts unless a work-package plan explicitly expands
ownership:

- `packages/model`: canonical schema-9 parse, validation, and serialization
- Project electrical/model schema and Edit Engine transaction semantics
- PWA service-worker asset cache
- Agent session credentials and File Resource staging
- `packages/platform-node` atomic filesystem adapter

Do not revive the retired `@icm/platform-web` package as disconnected
scaffolding. Its historical IndexedDB and File System Access implementation is
reference evidence only. Active browser persistence belongs in the editor's
existing `document/` lifecycle unless a second real runtime consumer appears.

## Frozen Product Decisions

### Data authority

1. `.icproj.json` is the only portable, user-owned formal Project artifact.
2. Recovery records are non-authoritative working copies and never silently
   replace the live Project.
3. A successful edit commit schedules recovery; rejected edits, previews,
   selection, camera movement, and dry runs do not.
4. Save, Save As, Download, Open, Import, Restore, and Replace are distinct
   lifecycle outcomes. A handler must not report one as another.

### Browser storage policy

1. Store complete recovery JSON in IndexedDB, not `localStorage`,
   `sessionStorage`, Cache Storage, or the service worker cache.
2. Retain at most two recent working-copy sessions.
3. Retain at most `latest` and `previous` for each session.
4. Reject a recovery snapshot above 4 MB without deleting the last good one.
5. Cap this application's recovery records at 12 MB total. Prune only records
   owned by this database/store, oldest inactive session first.
6. Deduplicate identical canonical Project text; an unchanged commit must not
   consume another generation.
7. Storage or quota failure is visible and non-destructive: keep the previous
   record and tell the user to download a Project.
8. Never clear all IndexedDB databases or origin storage. The database and
   store names must be application-specific.

The current repository Project corpus is 0.9-41.8 KB, so these limits leave
roughly two orders of magnitude of growth while preventing unbounded use.

### Session identity and multi-tab behavior

1. Key recovery by a random `workingCopyId`, not only `project.id`.
2. Keep `projectId` as descriptive validation metadata, not the storage key.
3. Persist the active `workingCopyId` in `sessionStorage` so an ordinary reload
   continues the same working copy.
4. Opening/importing/replacing a Project starts a new working-copy identity.
5. Restoring an old record forks a new working copy. It does not let two tabs
   overwrite the same record.
6. Multiple tabs may coexist without last-writer-wins data loss. Cross-tab
   presence warnings may use `BroadcastChannel`, but correctness must not
   depend on that optional advisory channel.

### Save semantics

1. Never clear recovery before serialization or file output.
2. Prefer File System Access only as progressive enhancement initiated by a
   user gesture. A successful `createWritable/write/close` is a confirmed save.
3. Fall back to a canonical Blob download everywhere else. Because the browser
   does not confirm durable download completion, report `Download requested`,
   not `Saved`.
4. Save/Download retains recovery. Explicit user deletion or bounded retention
   policy is the only recovery removal path.
5. A failed write aborts the writable stream where supported, preserves the
   recovery records, keeps the Project dirty, and shows a persistent action.
6. File handles are transient runtime capabilities in the first release. Do
   not serialize them into Project JSON or recovery records.

### Open and replacement semantics

1. Read and fully stage a candidate before changing the live Project:

   ```text
   read bytes
   -> JSON/schema validation
   -> approved-symbol validation
   -> Project preparation/preflight
   -> only then replace the live Project
   ```

2. Invalid or unsupported input leaves Project, selection, history, recovery,
   and file state unchanged.
3. Before replacing dirty work, first obtain a confirmed recovery write. If
   recovery fails, offer `Download current Project`, `Replace anyway`, and
   `Cancel`; default to Cancel.
4. A successful replacement retains the outgoing Project in recent recovery
   and immediately seeds the incoming Project's working copy.
5. File-open diagnostics must be durable and actionable, including diagnostic
   code/path where the model parser provides them; a transient status line is
   insufficient for a rejected user file.

### Recovery and compatibility semantics

1. Startup recovery discovery is asynchronous and must not block the empty
   editor shell.
2. An explicit in-app Refresh may automatically restore only the exact
   validated working-copy ID recorded for that refresh.
3. All other startup records require an explicit human `Restore` action.
4. Restoring prepares and installs the Project before changing or pruning the
   source recovery record.
5. If `latest` is invalid, validate and offer `previous`; do not silently
   delete both.
6. Distinguish `corrupt`, `unsupported-schema`, `unsupported-symbol`,
   `quota-exceeded`, `storage-unavailable`, and `storage-failed`.
7. Unsupported-version bytes remain downloadable. A future schema bump must
   not classify an older recovery record as corrupt and erase it.
8. On first upgraded launch, migrate `icm.recovery.v1` into IndexedDB. Remove
   the old localStorage key only after the IndexedDB transaction commits. If it
   cannot be migrated, retain it and allow raw download/discard.

## Recovery Record Contract

Use a versioned envelope separate from the canonical Project schema:

```ts
interface BrowserRecoveryRecordV2 {
  format: "analog-canvas-browser-recovery-v2";
  recordId: string;
  workingCopyId: string;
  generation: "latest" | "previous";
  projectId: string;
  projectName: string;
  projectSchemaVersion: number;
  topDocumentId: string;
  documentRevisions: Record<string, number>;
  source: "new" | "opened-file" | "spice-import" | "recovered";
  updatedAt: string;
  byteLength: number;
  projectText: string;
  formalFileHint?: {
    name: string;
    lastConfirmedWriteAt?: string;
    lastDownloadRequestedAt?: string;
  };
}
```

Contract requirements:

- Decode untrusted storage structurally before parsing `projectText`.
- Recompute UTF-8 byte length; never trust persisted `byteLength`.
- Require envelope `projectId`, schema version, and top Document to agree with
  the parsed Project.
- Validate timestamps and generation values.
- Preserve raw text for an unsupported schema; never install it as a Project.
- Do not add this envelope to `packages/model` or `.icproj.json`.

## Runtime State Model

Expose explicit orthogonal state instead of one ambiguous status string:

```ts
type RecoveryState =
  "idle" | "pending" | "stored" | "unavailable" | "quota-exceeded" | "failed";

type FileState =
  | "new"
  | "opened"
  | "dirty"
  | "write-confirmed"
  | "download-requested"
  | "write-failed";
```

The UI may derive concise labels such as `Recovery saved`, `Saving recovery`,
`Downloaded revision 12`, or `Recovery unavailable - download now`. File state
and recovery state must not overwrite each other.

## Work Packages

Each work package gets its own target plan, ownership boundary, validation,
commit, and review branch. Do not combine all work into one large commit.

### WP-0 - Contract and deterministic retention core

Goal: freeze recovery semantics before changing the GUI.

Owned work:

- update `docs/specs/persistence-and-recovery.md` and user-facing compatibility
  statements;
- define envelope decoding, typed results, byte limits, generation rotation,
  deduplication, and pruning as pure functions;
- unit-test retention ordering and all typed failures without browser APIs.

Acceptance:

- exact maximums are executable constants, not prose only;
- a failed proposed write returns the unchanged prior record set;
- unsupported schema remains exportable raw data;
- two tabs with different `workingCopyId` values cannot target the same key.

Suggested commit:

```text
feat(editor): define bounded recovery records
```

### WP-1 - IndexedDB store and legacy migration

Goal: implement one transactional browser storage adapter under `document/`.

Owned work:

- application-specific IndexedDB open/upgrade path;
- atomic latest/previous rotation and pruning;
- list/read/write/delete-one/delete-all-owned-records operations;
- `icm.recovery.v1` one-time migration;
- injectable clock/ID/backend seams for deterministic tests;
- quota and unavailable result mapping.

Acceptance:

- a transaction abort or quota error leaves all previous records readable;
- only this application's object store is pruned;
- an invalid latest does not hide a valid previous;
- migration deletes localStorage only after a confirmed IndexedDB commit;
- database upgrade is idempotent.

Suggested commit:

```text
feat(editor): persist bounded browser recovery
```

### WP-2 - Recovery coordinator and Project lifecycle

Goal: replace the synchronous localStorage hook without changing edit
semantics.

Owned work:

- coalesce committed Projects without losing the newest revision;
- serialize/validate before enqueueing the IndexedDB transaction;
- publish typed pending/stored/failed state to React;
- reset/fork working copies at replacement boundaries;
- preserve explicit-refresh exact restore behavior;
- remove the old full-Project localStorage writer after migration coverage is
  green.

Acceptance:

- only successful human/Agent commits schedule recovery;
- rapid edits store the newest canonical Project;
- hidden/pagehide initiates the newest pending write, while normal periodic
  writes keep correctness independent of last-moment page events;
- unmount/replacement cannot revive an outgoing Project;
- recovery failure never changes the live Project.

Suggested commit:

```text
refactor(editor): coordinate durable working copies
```

### WP-3 - Robust file service and replacement protection

Goal: make Save/Open semantics truthful and non-destructive.

Owned work:

- a single Project file service for canonical serialization, optional File
  System Access, and download fallback;
- staged open/preflight with typed diagnostics;
- confirmed-write versus download-requested state;
- outgoing dirty-Project protection before Open/Import/Replace;
- removal of every Save/Open path that clears recovery preemptively.

Acceptance:

- serialization, picker cancellation, permission denial, stream write failure,
  stream close failure, and download fallback have distinct results;
- failed open or save leaves the live Project and latest recovery intact;
- only confirmed handle close produces `write-confirmed`;
- fallback browsers retain full editor functionality.

Suggested commit:

```text
feat(editor): harden project open and save
```

### WP-4 - Recovery UX and operational visibility

Goal: let a non-technical user understand and control local safety copies.

Owned work:

- non-blocking startup recovery banner;
- File-menu `Recover recent work` entry;
- compact recovery dialog/cards with Project name, timestamp, source, and
  latest/previous availability;
- `Restore`, `Download backup`, and `Delete` actions;
- persistent recovery-failure banner with direct Download action;
- Help and troubleshooting updates.

Acceptance:

- no recovery silently replaces normal startup;
- incompatible records remain downloadable but cannot be restored;
- deleting one record cannot delete another Project's working copy;
- keyboard focus, Escape, and screen-reader labels are covered;
- the recovery UI does not resize the canvas or become a permanent debug pane.

Suggested commit:

```text
feat(editor): add recent-work recovery UX
```

### WP-5 - Browser hardening and release delivery

Goal: prove the complete failure matrix and deliver through the mainline gate.

Owned work:

- real IndexedDB Playwright tests;
- multiple-page/context collision test;
- storage-denied/quota simulations;
- production Pages/PWA smoke coverage;
- removal of stale localStorage-only documentation and selectors;
- final release notes and compatibility statement.

Acceptance:

- ordinary crash/reload restores the latest committed Project;
- corrupt latest falls back to previous;
- simultaneous tabs retain separate working copies;
- Save/Download and successful Open retain recoverable outgoing work;
- storage failure produces a persistent warning and never crashes the editor;
- no Project content appears in Cache Storage or service-worker assets.

Suggested commit:

```text
test(editor): prove project recovery failure modes
```

## Validation Matrix

### Pure/unit contracts

- canonical record encode/decode and byte accounting;
- latest/previous rotation and identical-content deduplication;
- two-session LRU pruning and 12 MB total cap;
- oversized-record rejection preserving last good state;
- quota/abort/unavailable typed results;
- corrupt, unsupported-schema, and mismatched-envelope classification;
- legacy localStorage migration success, failure, and retry;
- coordinator coalescing, replacement cancellation, and status transitions;
- File System Access permission, write, close, abort, and cancellation paths;
- download fallback never clears recovery.

Use focused commands during implementation:

```text
pnpm test:local apps/editor/src/document/<affected-tests>
```

### Browser behavior

- successful edit -> IndexedDB -> reload -> explicit restore;
- explicit Refresh -> exact automatic restore;
- two edits -> corrupt latest -> restore previous;
- two tabs/new Projects do not overwrite each other;
- download retains recovery;
- confirmed handle save retains recovery and updates file state;
- invalid Open leaves the original Project and recovery untouched;
- successful Open retains outgoing recent work and seeds incoming work;
- storage unavailable/quota exceeded shows a persistent warning;
- legacy `icm.recovery.v1` migrates once;
- recovery dialog download/delete/keyboard/accessibility behavior.

Use capped browser commands during implementation:

```text
pnpm test:e2e:local apps/editor/e2e/<affected-specs> --grep <behavior>
```

### Branch and mainline gates

Each work package closes with:

- changed-file formatting;
- `git diff --check`;
- `git status --short --branch`;
- focused unit and browser checks declared in its plan.

Because this is a non-document, cross-cutting release feature, the completed
integration branch must additionally run:

```text
pnpm verify:branch
```

Before delivery to `main`, from a clean dependency/build state:

```text
pnpm install --frozen-lockfile
pnpm ci:check
```

Push the review branch and wait for required GitHub Actions checks to pass.
Remote failure keeps the final target active until repaired and reverified.

## Explicit Non-Goals

- cloud sync, accounts, collaboration, or server-side Project storage;
- a virtual folder tree inside the browser;
- persisting undo history, viewport, selection, or transient tools;
- storing Project data in the service worker/PWA asset cache;
- silently migrating formal Project files during this target;
- guaranteeing survival after the user explicitly clears site data;
- using browser recovery as evidence that a formal file was saved;
- resurrecting a generic platform package before it has multiple consumers.

## Risks and Mitigations

### Async IndexedDB cannot be guaranteed during forced termination

Mitigation: enqueue recovery shortly after every successful commit and
coalesce in-flight writes; lifecycle events are an extra flush opportunity,
not the only durability mechanism. The user may lose the last very recent
edit under a hard process kill, but not the entire session.

### Serialization cost on large Projects

Mitigation: deduplicate/coalesce first, measure serialization and write times,
and keep the 4 MB recovery limit. Move serialization to a Worker only if
measured performance crosses the accepted interaction budget; do not add a
Worker speculatively.

### Browser-origin eviction

Mitigation: bounded storage, `navigator.storage.estimate()` for warning, and
clear user language that formal Project files remain authoritative. Do not
claim that IndexedDB survives explicit site-data deletion.

### Future Project schema upgrade

Mitigation: recovery decode preserves unsupported raw bytes and never deletes
them as corrupt. A formal Project migration registry is a separate product
decision before the first post-release schema bump.

## Commit Intent

This coordination plan is not one implementation commit. Execute WP-0 through
WP-5 as separately reviewable commits/targets on a review branch, then merge
only after the mainline delivery gate and remote required checks pass.

## Outcome

Pending implementation. The plan is ready. Start WP-0 from a dedicated review
branch after the Fit View change is accepted into mainline.
