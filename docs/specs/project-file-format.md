# Project File Format

Status: `accepted`

Version: `1.0`

Owning phase: `Phase 0`

Primary owner: `packages/model`

## Purpose

Define the single editable project file used by the first product version and
its validation, canonical serialization, and migration behavior.

## Consumers

- Editor project lifecycle
- Schematic Edit Engine
- SPICE importer
- Agent adapter
- Exporters and recovery tools

## Terminology

| Term | Meaning |
|---|---|
| Project file | `project.icproj.json`, containing the complete persisted Project |
| Canonical JSON | UTF-8 JSON with recursively sorted object keys, two-space indentation, preserved array order, and one trailing newline |
| Migration | An explicit function that advances one older integer schema version |

## Data model or interface

The authoritative runtime contract is `CircuitProjectSchema` in
`packages/model`. Version 1 contains:

```typescript
interface CircuitProject {
  schemaVersion: 1;
  id: string;
  name: string;
  source: SourceManifest;
  symbolLibrary: SymbolLibraryLock;
  topDocumentId: string;
  documents: SchematicDocument[];
}
```

`SourceManifest` owns entry path, dialect, copy/reference policy, and source
file IDs, paths, and hashes. `SymbolLibraryLock` owns library ID, version, and
content hash. Documents are embedded; version 1 has no separate document,
source-lock, symbol-lock, cache, session, or export files.

## Invariants

- `schemaVersion` is exactly `1` after migration.
- At least one Document exists and `topDocumentId` resolves to it.
- Document IDs are unique.
- Unknown object fields are rejected.
- Array order is preserved by canonical serialization.
- Session, viewport, selection, syntax tree, Circuit IR, diagnostics cache,
  flightlines, and SVG are never persisted.

## Operations and state transitions

```text
read text → parse JSON → migrate → validate → open
validate → canonicalize → atomic storage write
```

An unsupported future version is rejected. An older version is rejected unless
every required advancing migration is registered. Migration never guesses a
missing electrical relationship.

## Persistence boundary

The Project file persists logical connectivity, visible geometry, presentation
intent, source manifest, symbol lock, and Document revisions. Parser and render
intermediates remain transient.

## Valid example

`fixtures/projects/minimal/project.icproj.json` contains one empty valid
Document and round-trips canonically.

## Rejected example

A Project whose `topDocumentId` is not present in `documents` is rejected with
`INVALID_PROJECT` and a path containing `topDocumentId`.

## Compatibility and migration

Readers accept only the current version plus explicitly registered older
versions. Writers always emit the current version. Adding a Page layer or
splitting Documents into files requires a new schema version and ADR.

## Deterministic validation

- Zod and generated JSON Schema inspection
- valid and rejected fixtures
- save-load-save byte equality
- unsupported-version tests

## Open decisions

- Project splitting remains deferred until measured scale or collaboration
  requirements justify it.
