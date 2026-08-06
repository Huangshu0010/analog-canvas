# Phase 0 - Contracts and Scaffold

Status: `complete`

## Objective

Establish the smallest stable repository and cross-module contracts needed for
the editor, SPICE frontend, symbol system, renderer, and later Agent API to be
developed without inventing incompatible models.

## User-visible outcome

A reviewer can create a minimal empty circuit Project, add one Document through
a fixture, save it as canonical JSON, reopen it, and verify that its meaning is
unchanged. No interactive editor is promised yet.

## In scope

- pnpm workspace and TypeScript build/test baseline;
- `apps/editor`, `packages/model`, `packages/edit-engine`, `packages/spice`,
  and `packages/symbols`; `packages/render-svg` begins in Phase 1;
- stable ID, Point, Rect, orientation, grid, and integer-coordinate contracts;
- `CircuitProject` and `SchematicDocument` version-1 schemas;
- canonical JSON serialization and migration framework;
- minimal Symbol Resolver interface;
- Edit Transaction, revision, and typed-edit envelope;
- transient Circuit IR boundary sufficient for Phase 2;
- focused CI for type checking, unit tests, and format checks.

## Out of scope

- interactive placement or routing;
- complete Symbol DSL artwork;
- production SPICE parsing;
- Agent transport;
- PNG/PDF export;
- multi-page Documents and split Project storage.

## Dependencies

- [`Overall product plan`](../overall-product-plan.md)
- Current `netlists/` fixtures as read-only contract evidence
- Current `lib/circuit.vss` as a read-only binary source asset
- Specifications owned by this phase in [`docs/specs`](../specs/README.md)

## Work packages

### WP-0.0 - Reference governance

- Goal: make selected external and previous repositories reproducible research
  inputs without creating a source, build, runtime, or CI dependency.
- Main modules: `references/`, `.reference-src/`, and the fetch script.
- Required ADR: `0003-isolate-reference-sources.md`.
- Validation surface: immutable pins, ignored checkouts, repeatable fetch, and
  successful clean builds without fetched sources.

### WP-0.1 - Workspace baseline

- Goal: introduce only the workspaces needed by the first executable target.
- Main modules: repository root, editor shell, core package.
- Required specs: none beyond repository rules.
- Validation surface: install, type check, one smoke test, clean build output.

### WP-0.2 - Primitive and identity contracts

- Goal: define coordinates, orientation, IDs, source spans, and error types.
- Main modules: `packages/model` and shared schema helpers.
- Required specs: `schematic-model.md`.
- Validation surface: schema and property tests for transforms and IDs.

### WP-0.3 - Project persistence

- Goal: define Project/Document v1, canonical JSON, atomic-save boundary, and
  migration registration.
- Main modules: `packages/model` schema and storage boundaries.
- Required specs: `project-file-format.md`, `persistence-and-recovery.md`.
- Validation surface: save-load-save semantic equality and rejected fixtures.

### WP-0.4 - Edit and revision envelope

- Goal: freeze transaction metadata and edit result/error shapes without
  implementing every edit.
- Main modules: `packages/edit-engine`; history implementation begins in Phase
  1.
- Required specs: `edit-engine.md`.
- Validation surface: stale revision and atomic no-op transaction tests.

### WP-0.5 - Import and symbol boundaries

- Goal: define the transient Circuit IR and Symbol Resolver interfaces.
- Main modules: `packages/spice`, `packages/symbols`, importer boundary.
- Required specs: `circuit-ir.md`, `symbol-dsl.md`.
- Validation surface: compile-time consumer fixtures and minimal valid data.

## Deliverables

- Workspace manifests and focused CI configuration;
- pinned reference manifest and isolated fetch script;
- Project/Document v1 schemas;
- primitive geometry and identity types;
- canonical save/load and migration skeleton;
- Edit Transaction and result types;
- minimal Circuit IR and Symbol Resolver contracts;
- accepted Phase 0 specifications and contract fixtures.

## Acceptance scenarios

```text
Construct a minimal Project with one empty Document
→ validate schema
→ save canonical project.icproj.json
→ reload and migrate
→ compare semantic model
→ obtain no diagnostics
```

```text
Submit an edit with the wrong expectedRevision
→ reject with STALE_REVISION
→ leave Document byte-for-byte unchanged in memory
```

## Deterministic validation

- TypeScript type check and focused unit tests;
- JSON Schema/Zod valid and rejected fixtures;
- canonical JSON snapshot;
- save-load-save semantic equality;
- coordinate transform property tests;
- `git diff --check` and repository status review.

## Risks and decisions

| Risk or decision | Handling |
|---|---|
| Schema becomes coupled to React | Core package must have no React or DOM dependency |
| Page layer reappears prematurely | Record an ADR before adding persisted Page/View data |
| Too many empty packages | Create a workspace only with its first owned implementation target |
| Circuit IR overfits current fixtures | Keep it terminal- and hierarchy-oriented, not renderer-oriented |

## Exit gate

- Project/Document, primitive geometry, Symbol Resolver, Edit Transaction, and
  Circuit IR contracts are accepted and tested;
- canonical save/load succeeds for valid fixtures and rejects invalid ones;
- Phase 1 and Phase 2 can consume the contracts without depending on each
  other's implementation.

## Completion evidence

Completed on `2026-08-07`.

- `pnpm install --frozen-lockfile`, `pnpm format:check`,
  `pnpm references:check`, `pnpm typecheck`, `pnpm test`, and `pnpm build`
  passed from the repository root.
- Eight test files with 30 tests passed across the editor shell, Project model,
  persistence, geometry, identity, Edit Transaction, Circuit IR, and Symbol
  Resolver boundaries.
- Built ESM outputs loaded directly in Node and completed a model/edit package
  runtime smoke test.
- The pinned reference fetch was verified for unknown-name rejection, initial
  detached checkout, and idempotent re-verification at the recorded commit.
- Product-source inspection found no dependency on `.reference-src/` or the
  previous converter repository.
- Markdown links and fenced blocks were validated, followed by
  `git diff --check` and repository status review.
