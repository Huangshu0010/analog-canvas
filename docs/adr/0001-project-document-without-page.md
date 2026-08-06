# 0001 - Persist Project and Document Without a Page Layer

Status: `accepted`

Date: `2026-08-07`

Owners: `packages/model`, `packages/edit-engine`

## Context

The first product version has one unbounded schematic canvas per subcircuit.
A persisted Page between Project and Document would add identity, query scope,
migration, and Agent API nesting without representing a current user concept.
Rendering still needs transient scene and viewport data, but those are not
electrical or editing truth.

## Decision

The version-1 persistent hierarchy is exactly:

```text
CircuitProject
└── SchematicDocument[]
```

There is no persisted `Page`, `View`, or rendered scene. Session viewport data
and render scenes are transient. A future multi-page requirement must add a new
schema version and an ADR before implementation.

## Alternatives considered

### Persist Project, Document, and Page

- Benefits: natural support for multi-page schematics.
- Costs: additional IDs, query nesting, storage structure, and migrations now.
- Reason not selected: no Phase 0–7 acceptance scenario requires more than one
  canvas per Document.

### Treat SVG as the page model

- Benefits: fewer explicit geometry types.
- Costs: connectivity and editing truth would depend on a derived format.
- Reason not selected: it contradicts explicit connectivity and deterministic
  typed edits.

## Consequences

### Positive

- Project files and Agent scopes remain shallow.
- Connectivity, visible geometry, and presentation intent share one Document
  revision.
- Renderers remain replaceable derived consumers.

### Negative or limiting

- Multi-page work requires a future migration.
- Export page bounds must be derived or supplied as export options.

## Compatibility and migration

Version 1 rejects unknown persisted Page fields. A future schema may introduce
views or pages only with an explicit migration from version 1.

## Validation

- Project schema fixtures contain Documents directly.
- Save/load tests reject unknown persistent view state.
- Renderer and editor tests must not add viewport or SVG state to Project JSON.

## Related documents

- [`schematic-model.md`](../specs/schematic-model.md)
- [`project-file-format.md`](../specs/project-file-format.md)
- [`Phase 0`](../roadmap/phase-0-contracts-and-scaffold.md)
