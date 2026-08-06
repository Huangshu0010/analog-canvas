# 0002 - Use a TypeScript Product Core and Isolate Offline Tools

Status: `accepted`

Date: `2026-08-07`

Owners: `apps/editor`, `packages/*`, `tools/*`

## Context

Human GUI gestures and Agent edits must share one in-process Edit Engine.
Introducing a Python service between the editor and circuit model would create
an avoidable serialization protocol and split validation, history, and revision
ownership. Some development-only tasks, especially Visio extraction, may still
need platform-specific tooling.

## Decision

The product model, SPICE frontend, Edit Engine, derived state, renderer, and
Agent adapter are TypeScript packages in this repository. The React editor
calls those packages in process. No Python or Reference checkout is a runtime,
build, CI, or release dependency.

Offline tools may use another language when required by a platform API. Their
outputs must cross a versioned file contract such as Symbol DSL and must be
compiled into product-owned assets before release.

The previous `net-painting-converter` is not a product architecture baseline.
Only its SPICE parsing, source handling, diagnostics, and fixtures may be
studied during bounded migration work.

## Alternatives considered

### Keep the previous Python converter as a runtime sidecar

- Benefits: immediate reuse of existing converter behavior.
- Costs: IPC, duplicate models, packaging complexity, and an architecture aimed
  at one-shot automatic output instead of collaborative editing.
- Reason not selected: it conflicts with the shared GUI/Agent Edit Engine.

### Rewrite every tool in TypeScript

- Benefits: one language everywhere.
- Costs: unnecessary friction for Visio COM and one-time asset conversion.
- Reason not selected: offline tool implementation language does not affect the
  runtime when outputs use owned contracts.

## Consequences

### Positive

- Human and Agent paths share exact transaction semantics.
- The persisted model never crosses a hidden service boundary.
- Runtime packaging remains browser-technology based.

### Negative or limiting

- Useful parsing algorithms may need a deliberate TypeScript migration.
- Offline tools require separate validation and provenance.

## Compatibility and migration

Migrated behavior is reimplemented inside the destination package and proven
with product-owned tests. Production code never imports `.reference-src/`.

## Validation

- Workspace dependency inspection finds no runtime Python package.
- CI succeeds without fetched Reference repositories.
- GUI and Agent parity tests call the same Edit Engine in later phases.

## Related documents

- [`0003-isolate-reference-sources.md`](0003-isolate-reference-sources.md)
- [`edit-engine.md`](../specs/edit-engine.md)
- [`Phase 0`](../roadmap/phase-0-contracts-and-scaffold.md)
