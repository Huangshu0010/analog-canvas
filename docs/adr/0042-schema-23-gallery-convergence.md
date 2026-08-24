# ADR 0042: Schema 23 and Gallery Storage Convergence

Status: accepted

Date: 2026-08-24

Owners: `packages/model`, `packages/project-protocol`, `worker/gallery.ts`

## Context

ADR 0040 made Connectivity Evidence the sole logical authority but retained
schema-21 `Net.name`, `Net.scope`, `Net.powerDomain`, and `Net.origin` fields as
inert schema-22 projections. The public Gallery still contains both schema 21
and schema 22 Projects, while Gallery history and private workspace slots keep
independent Project texts. Advancing the file format before converging every
storage surface would make some published or restored work unreadable.

## Decision

Schema 23 makes a persisted Base Net exactly `{ id, terminals }`. Naming,
scope, supply role, source membership, and explicit equivalence remain in the
single Connectivity Evidence list and resolve through the existing Logical-Net
resolver.

The convergence release temporarily accepts schemas 21, 22, and 23 and always
returns and writes schema 23. Gallery administration exposes an authenticated
full backup, a no-write migration report, and an atomic apply operation over
current entries, entry history, and private workspace slots. Version restore
and workspace save also canonicalize through the Project protocol boundary so
old text cannot be reintroduced after migration.

After online storage contains only schema 23, the temporary schema-21 hop and
the convergence-only Base-Net projections are removed. The normal rolling
reader then accepts schemas 22 and 23.

## Alternatives considered

### Stop at schema 22 before advancing

- Benefits: preserves the ordinary one-version reader during every release.
- Costs: rewrites all online data twice and keeps inert Base-Net fields longer.
- Reason not selected: the same validated 21-to-22 transform composes safely
  with the field-removal transform, so an intermediate stored state adds risk
  without adding electrical evidence.

### Migrate only current public entries

- Benefits: smaller maintenance operation.
- Costs: restoring history or opening a workspace can reintroduce an old
  schema after cleanup.
- Reason not selected: all persisted Project-bearing tables are one
  compatibility boundary.

## Consequences

### Positive

- Base Nets are physically and structurally topology-only.
- Gallery data, history, workspaces, fixtures, and new saves converge on one
  canonical format.
- Migration is reversible from an administrator backup and cannot partially
  apply after a validation failure.

### Negative or limiting

- One deployment temporarily carries a three-version ingestion bridge.
- Schema-21 files kept offline must be opened during that bridge release or
  upgraded separately after the bridge is removed.

## Compatibility and migration

The migration changes Project JSON only. It preserves IDs, terminal
membership, Connectivity Evidence, geometry, annotations, and stored Gallery
SVG previews. Every source record is parsed and serialized before any write;
all writes then occur in one Durable Object transaction.

## Validation

- The current reader must converge every public Gallery Project to schema 23.
- Unit tests cover the object-anchored legacy VDD label that previously failed.
- Gallery tests cover backup, dry-run, atomic migration of all three tables,
  canonical workspace save, and canonical history restore.
- Online acceptance requires zero stored schema-21/schema-22 records and a
  second dry-run with no failures.

## Related documents

- [ADR 0040](0040-connectivity-evidence.md)
- [Project file format](../specs/project-file-format.md)
- [Persistence and recovery](../specs/persistence-and-recovery.md)
