---
status: completed
experience: none
---

# External Subcircuit Definition Authoring

## Goal

Turn project-scoped external subcircuit interfaces into stable, manually
authorable and placeable components. Preserve their structural `X`-call
semantics through import, Project editing, preflight and DesignNetlistIR without
introducing PDK runtime, simulator models or generated external `.subckt` bodies.

## State and Ownership

Start state from `git status --short --branch`:

```text
## codex/external-subcircuit-definition
```

The worktree is clean. This target owns the external-definition protocol and
its authoring/import path. It intentionally excludes simulation profiles,
foundry model files, PDK installation, netlist download UI and source-aware
round-trip printing.

- `docs/adr/0029-external-subcircuit-definition-protocol.md`
- `docs/adr/README.md`
- current schematic/netlist specifications affected by the new contract
- `packages/model/src/schema/{project,instance}.ts` and schema tests
- `packages/project-protocol/src/{version,previous-to-current,persistence,protocol}.test.ts`
- `packages/project-protocol/src/transforms/project.ts` and schema fixtures
- `packages/symbols/src/{hierarchical-block,hierarchical-block-geometry,resolver}.ts`
- `packages/edit-engine/src/{edit-schema,hierarchy-planner,project-transaction}.ts`
- `packages/spice/src/{compiler,importer}.ts` and focused import tests
- `packages/netlist/src/{extract,current-contract}.test.ts`
- `apps/editor/src/app/App.tsx`
- `apps/editor/src/features/component-insert/*`
- `apps/editor/src/features/hierarchy/*`
- focused editor and browser tests for external definition authoring
- this plan and `plan/log.md`

Shared dependencies: the schema rolling-previous-version policy, `Net.terminals`
as the sole connectivity authority, the typed Edit Engine union, the Symbol
resolver and the one `analyzeDesignNetlist` analyzer. Existing internal Cell
behavior and built-in Device Descriptors are read-only compatibility surfaces.

## Work

1. Accept and document a dedicated external-subcircuit protocol: stable
   definition/terminal identities, ordered interfaces, raw formal parameters,
   definition-level presentation, project-local authority and non-emitting
   external masters.
2. Advance the Project schema once with a deterministic previous-version
   adapter; retain current external definitions and existing caller connectivity
   without guessing terminal meaning.
3. Add typed, caller-aware Definition operations for create, instantiate,
   rename, reorder, remove and rebind. Interface changes must preview impact
   and atomically reconcile safe pin-name projections.
4. Expose all external definitions in the component catalog, place an external
   `X` instance from an empty project, and provide an editable external target
   workflow without creating a fake internal Cell body.
5. Preserve unknown imported `X` masters as external-subcircuit bindings and
   create a generic block fallback; a reviewed Symbol mapping may alter display
   only, never invocation semantics.
6. Extend preflight/IR and tests for manual authoring, interface changes,
   SKY130-style external calls, schema migration and import-to-IR correctness.

## Validation

- focused model, project-protocol, symbols, edit-engine, spice and netlist tests
- focused editor component tests and external-subcircuit Playwright workflow
- `pnpm typecheck`
- `pnpm build`
- `pnpm test:impact -- --base origin/main`
- `pnpm docs:check`
- `git diff --check`
- `git status --short --branch`

## Test Impact

- Decision: tests-updated
- Contracts: project-local external master identity, terminal order and caller
  reconciliation; explicit `X` binding semantics; generic external placement;
  no conversion of external calls into model primitives.
- Primary checks: schema/migration, hierarchy planner, symbol resolver,
  importer, DesignNetlistIR and one browser authoring flow.

## Commit Intent

Commit as:

```text
feat(netlist): author external subcircuit definitions
```

## Outcome

Implemented schema 15 external definitions with stable terminal IDs/directions,
definition-level presentation, and a deterministic schema-14 adapter. External
symbols now exist before their first Instance and are keyed by immutable
definition ID. The editor catalog can place a project-local external master as
an `X` Instance; the Cell Manager can author its interface without a fake
Document body. The planner supports atomic connected-terminal rename and
explicit terminal reordering.

Unknown imported `X` calls now become `external-subcircuit` bindings with a
generic positional block. Reviewed PDK mappings may provide pin labels such as
`D/G/S/B`, but leave invocation semantics as an external `X` call. The SKY130
thermometer resistor fixture imports successfully with inferred external
masters. Current Project fixtures, bundled examples, editor persistence tests
and current specs advance to schema 15.

Validation passed: focused unit/UI suite (12 files / 91 tests), focused
Playwright project-file suite (8 tests), `pnpm typecheck`, `pnpm build`,
`pnpm format:check`, `pnpm docs:check`,
`pnpm test:impact -- --base origin/main`, and `git diff --check`.
