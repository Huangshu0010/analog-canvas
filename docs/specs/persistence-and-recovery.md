# Persistence and Recovery

Status: `accepted`

Version: `2.0-page-v1`

Owning phase: `Phase 0/7`

Primary owner: `packages/model`, editor project lifecycle

## Purpose

Separate validated formal saves from session, cache, and crash-recovery data so
an interruption cannot silently corrupt a valid Project file.

## Consumers

- editor open/save lifecycle
- platform storage adapter
- autosave and crash recovery
- project migrations

## Terminology

| Term           | Meaning                                                                 |
| -------------- | ----------------------------------------------------------------------- |
| Formal Project | User-owned `<project-name>.icproj.json`, the only authoritative Project |
| Atomic write   | Temporary write, flush where supported, and same-volume replace         |
| Recovery copy  | Validated origin-local browser copy offered after interrupted work      |

## Data model or interface

The core package depends only on:

```typescript
interface ProjectStorage {
  readText(path: string): Promise<string>;
  writeTextAtomically(path: string, content: string): Promise<void>;
}
```

Platform adapters implement filesystem or browser capabilities. A native
filesystem adapter may provide an atomic replacement. A baseline browser cannot
replace an arbitrary user file: formal browser save is an explicit canonical
download, with File System Access write-back only as an optional enhancement.

## Invariants

- Validate before serialization and writing.
- Formal saves use canonical JSON. Native adapters use atomic replacement;
  baseline browser saves are explicit downloads.
- Autosave never overwrites the formal Project directly.
- Cache, session, and recovery data remain outside the user project directory.
- A recovery snapshot is validated before it is offered or promoted.
- Failed migration or validation leaves the original file untouched.

## Operations and state transitions

Phase 0 implements validation, canonical serialization, migration registration,
and the atomic-write adapter boundary. Phase 7 implements a root-bounded Node
adapter, forced pre-replace failure tests, validated AppData recovery, and
browser restoration UI.

## Persistence boundary

Formal data belongs in one `.icproj.json`. The Page release does not create a
hidden project directory, copy source files, or persist custom symbol files
next to it. Viewport, selection, caches, thumbnails, File System Access
handles, and recovery copies remain outside the Project file. Browser recovery
is stored in IndexedDB when available, is keyed by Project ID, and can be lost
when the user clears site data or the browser evicts storage.

## Valid example

Saving a valid Project calls `writeTextAtomically` exactly once with canonical
JSON. Reopening and saving again produces identical bytes.

## Rejected example

A Project with an unsupported schema version is rejected before the storage
adapter is asked to replace the formal file.

## Compatibility and migration

Migrations advance one integer version at a time. The registry rejects missing,
non-advancing, and future-version paths. Released migration fixtures are kept
through Phase 7.

## Deterministic validation

- in-memory atomic storage contract tests
- save-load-save byte equality
- invalid/future-version tests
- Phase 7 interruption and corrupt-recovery fault tests

## Platform decisions

- The Node adapter uses `%LOCALAPPDATA%/InteractiveCircuitMaker` on
  Windows, the standard Application Support directory on macOS, and
  `$XDG_STATE_HOME` (or `~/.local/state`) on Linux.
- Browser recovery uses origin-local IndexedDB application data. It is not
  "autosave" and never overwrites a formal Project file.
- The static Page build has no backend, no server-side Project storage, and no
  Agent API surface.
- Native-shell storage integration is deferred by ADR 0006 without changing
  this contract.

## Agent v3 extension (ADR 0018)

[ADR 0018](../adr/0018-agent-project-lifecycle-and-v3-api.md) distinguishes four
states that the v2 recovery contract treats together:

- **commit** — a successful typed transaction (Document or Project) is the only
  point that schedules recovery, exactly as `applyResult()` is today;
- **recovery** — origin-local IndexedDB only, never a formal save, coalesced to
  the newest Project;
- **artifact export** — a bounded, scoped, byte-stable artifact produced on
  demand (canonical `.icproj.json`, SVG, PNG, PDF); it is never a save or a
  recovery source;
- **browser download** — a visible side effect the user may request alongside an
  artifact; it is not a persistence authority.

Runtime `projectRevision` is session-only and is not persisted. Project
replacement (Agent-staged import or GUI Open/Import/Restore) cancels any pending
recovery write for the outgoing Project before activation; the imported Project
is revalidated immediately before activation and then stages its own recovery
state. No state here authorizes server-side Project persistence.
