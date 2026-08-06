# Persistence and Recovery

Status: `accepted`

Version: `1.0-boundary`

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

| Term | Meaning |
|---|---|
| Formal Project | User-selected `project.icproj.json` |
| Atomic write | Temporary write, flush where supported, and same-volume replace |
| Recovery snapshot | Validated AppData copy offered after interrupted work |

## Data model or interface

The core package depends only on:

```typescript
interface ProjectStorage {
  readText(path: string): Promise<string>;
  writeTextAtomically(path: string, content: string): Promise<void>;
}
```

Platform adapters implement filesystem or browser capabilities. They must not
expose partial writes as successful saves.

## Invariants

- Validate before serialization and writing.
- Formal saves use canonical JSON and atomic replacement.
- Autosave never overwrites the formal Project directly.
- Cache, session, and recovery data remain outside the user project directory.
- A recovery snapshot is validated before it is offered or promoted.
- Failed migration or validation leaves the original file untouched.

## Operations and state transitions

Phase 0 implements validation, canonical serialization, migration registration,
and the atomic-write adapter boundary. Phase 7 implements platform fault tests,
AppData recovery, restoration UI, and cleanup policy.

## Persistence boundary

Formal data belongs in `project.icproj.json` and copied `sources/` or custom
`symbols/`. Viewport, selection, caches, thumbnails, and recovery snapshots
belong under the platform application-data location.

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

## Open decisions

- Desktop packaging and the exact AppData adapter are selected in Phase 7.
