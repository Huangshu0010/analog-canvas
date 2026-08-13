# Project File Format

Status: `accepted`

Version: `4.0`

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

| Term                  | Meaning                                                                                                                |
| --------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| Project file          | `<project-name>.icproj.json`, containing the complete persisted Project                                                |
| Canonical JSON        | UTF-8 JSON with recursively sorted object keys, two-space indentation, preserved array order, and one trailing newline |
| Migration             | An explicit function that advances one older integer schema version                                                    |
| Browser recovery copy | Origin-local, non-authoritative crash-recovery data; never a Project file                                              |

## Data model or interface

The authoritative runtime contract is `CircuitProjectSchema` in
`packages/model`. The current released version is 4:

```typescript
interface CircuitProject {
  schemaVersion: 4;
  id: string;
  name: string;
  source: SourceManifest;
  symbolLibrary: SymbolLibraryLock;
  topDocumentId: string;
  documents: SchematicDocument[];
}
```

`SourceManifest` records imported-source provenance: entry path, dialect,
declared policy, and selected source file IDs, paths, and hashes. In the Page
release it does **not** mean that SPICE source text was copied into the Project
file or a browser-created `sources/` directory. `SymbolLibraryLock` owns
library ID, version, and content hash. Documents are embedded; version 4 has
no separate document, source-lock, symbol-lock, cache, session, recovery, or
export files. Version 3 adds a first-class `NoConnect` collection to each
Document; migration never infers NoConnect intent.

## Invariants

- `schemaVersion` is exactly `4` after migration.
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
versions. Writers always emit the current version. The static Page layer does
not change this file contract. Splitting Documents into files or embedding a
source bundle requires a new schema version and ADR.

Version 4 persists optional Cell interfaces and Instance electrical export
facts. A schema-3 migration creates deterministic Cell names and Port order,
copies only unambiguous source facts, and never invents a model or simulation
setup. The authority and failure policy are defined by
[`netlist-export.md`](netlist-export.md) and
[`ADR 0017`](../adr/0017-deterministic-design-netlist-boundary.md).

## Deterministic validation

- Zod and generated JSON Schema inspection
- valid and rejected fixtures
- save-load-save byte equality
- unsupported-version tests

## Open decisions

- Project splitting remains deferred until measured scale or collaboration
  requirements justify it.

## Agent v3 extension (ADR 0018)

[ADR 0018](../adr/0018-agent-project-lifecycle-and-v3-api.md) adds no persisted
field. Runtime `projectRevision` is a browser-session value owned by the
`EditorProjectController`; it is not written to `.icproj.json` and does not
change `schemaVersion` 4. Canonical Project export uses `serializeProject()` and
must be byte-stable across save/load/save; an Agent retrieves it as a scoped
`artifact` (see [`export.md`](export.md)), never by filesystem path. Import
candidates are validated in browser memory before any replacement and never
imply a new schema version or an embedded source bundle.
